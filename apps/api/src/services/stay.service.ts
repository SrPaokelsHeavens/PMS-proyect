import type { AddChargeInput, CheckInInput, CheckOutInput } from "@hotel-os/shared";
import { audit } from "../audit.js";
import { prisma } from "../db.js";
import { calculateOvertime } from "../domain/overtime.js";
import { selectCurrentRate, selectOvertimeRule, selectRateForRoom } from "../domain/rates.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { findRoomById } from "../repositories/room.repository.js";
import { publishDomainEvent } from "../realtime/event-bus.js";
import { calculateExtraMinutes, calculateTimingStatus, getOrCreateCurrentShift } from "../shift.js";
import { upsertGuest } from "./guest.service.js";

export async function checkIn(input: CheckInInput, userId?: string) {
  const room = await findRoomById(input.roomId);
  if (!room) throw new NotFoundError("Room not found");
  if (room.stays.length > 0 || room.status === "OCCUPIED") throw new ConflictError("Room already has an open stay");
  if (room.status !== "AVAILABLE") throw new ConflictError("Room must be available before check in");

  const configuredRate = input.rateId ? selectRateForRoom(room, input.rateId) : null;
  if (input.rateId && !configuredRate) throw new ConflictError("Selected rate is not valid for this room today");

  const activeRate = selectCurrentRate(room.ratePlans);
  const stayHours = configuredRate?.hourPlan.hours ?? activeRate?.stayHours ?? input.stayHours;
  const rateCents = configuredRate?.priceCents ?? activeRate?.priceCents ?? input.rateCents;
  if (!stayHours || rateCents === undefined) throw new ConflictError("No valid rate is configured for this room");

  const overtimeRule = selectOvertimeRule(room, configuredRate?.hourPlanId || null);
  const plannedCheckOutAt = new Date(Date.now() + stayHours * 60 * 60 * 1000);
  const shift = await getOrCreateCurrentShift(userId);
  const guest = await upsertGuest(input.guest);
  const companion = input.companion ? await upsertGuest(input.companion) : null;

  const result = await prisma.$transaction(async (tx) => {
    const stay = await tx.stay.create({
      data: {
        roomId: input.roomId,
        guestId: guest.id,
        checkInShiftId: shift.id,
        checkedInByUserId: userId,
        stayHours,
        rateCents,
        rateId: configuredRate?.id,
        hourPlanId: configuredRate?.hourPlanId,
        overtimeRuleId: overtimeRule?.id,
        overtimeGraceMinutes: overtimeRule?.graceMinutes || 0,
        extraHourCents: overtimeRule?.extraHourCents || 0,
        plannedCheckOutAt,
        notes: input.notes,
        stayGuests: {
          create: [
            { guestId: guest.id, role: "PRIMARY" },
            ...(companion ? [{ guestId: companion.id, role: "COMPANION" }] : [])
          ]
        },
        charges: {
          create: {
            roomId: input.roomId,
            guestId: guest.id,
            chargeType: "ROOM_RATE",
            description: `Room ${room.number}`,
            quantity: 1,
            unitPriceCents: rateCents,
            totalCents: rateCents,
            paymentMethod: input.paymentMethod
          }
        },
        payments: {
          create: {
            shiftId: shift.id,
            receivedByUserId: userId,
            type: "INITIAL_RATE",
            method: input.paymentMethod,
            amountCents: rateCents,
            notes: `Initial room payment for ${room.number}`
          }
        }
      }
    });
    await tx.room.update({ where: { id: input.roomId }, data: { status: "OCCUPIED" } });
    return stay;
  });

  await audit({ userId, action: "STAY_CHECKED_IN", entity: "Stay", entityId: result.id, metadata: { roomId: input.roomId } });
  publishDomainEvent({ type: "stay.checkedIn", stayId: result.id, roomId: input.roomId });
  publishDomainEvent({ type: "room.statusChanged", roomId: input.roomId, status: "OCCUPIED" });
  publishDomainEvent({ type: "shift.changed", shiftId: shift.id });
  return { stayId: result.id };
}

export async function checkOut(stayId: string, input: CheckOutInput, userId?: string) {
  const stay = await prisma.stay.findUnique({ where: { id: stayId } });
  if (!stay || stay.status !== "OPEN") throw new NotFoundError("Open stay not found");

  const shift = await getOrCreateCurrentShift(userId);
  const checkOutAt = new Date();
  const overtime = calculateOvertime(stay.plannedCheckOutAt, checkOutAt, stay.overtimeGraceMinutes, stay.extraHourCents);
  const extraMinutes = overtime.overtimeMinutes || calculateExtraMinutes(stay.plannedCheckOutAt, checkOutAt);
  const shouldChargeOvertime = overtime.overtimeChargeCents > 0 && !input.waiveOvertime;

  await prisma.$transaction(async (tx) => {
    await tx.stay.update({
      where: { id: stayId },
      data: {
        status: "CLOSED",
        checkOutAt,
        checkOutShiftId: shift.id,
        checkedOutByUserId: userId,
        extraMinutes,
        overtimeMinutes: overtime.overtimeMinutes,
        overtimeChargeCents: input.waiveOvertime ? 0 : overtime.overtimeChargeCents,
        overtimeWaivedAt: input.waiveOvertime && overtime.overtimeChargeCents > 0 ? checkOutAt : null,
        overtimeWaivedByUserId: input.waiveOvertime && overtime.overtimeChargeCents > 0 ? userId : null,
        overtimeWaiverReason: input.waiveOvertime && overtime.overtimeChargeCents > 0 ? input.overtimeWaiverReason : "",
        timingStatus: calculateTimingStatus(stay.plannedCheckOutAt, checkOutAt)
      }
    });

    if (shouldChargeOvertime) {
      await tx.charge.create({
        data: {
          stayId: stay.id,
          roomId: stay.roomId,
          guestId: stay.guestId,
          chargeType: "OVERTIME",
          description: `Overtime ${overtime.billableHours} hour(s)`,
          quantity: overtime.billableHours,
          unitPriceCents: stay.extraHourCents,
          totalCents: overtime.overtimeChargeCents,
          paymentMethod: "CASH"
        }
      });
      await tx.payment.create({
        data: {
          stayId: stay.id,
          shiftId: shift.id,
          receivedByUserId: userId,
          type: "OVERTIME",
          method: "CASH",
          amountCents: overtime.overtimeChargeCents,
          notes: `Overtime payment for ${overtime.overtimeMinutes} min`
        }
      });
    }

    await tx.room.update({ where: { id: stay.roomId }, data: { status: "CLEANING" } });
  });

  await audit({ userId, action: "STAY_CHECKED_OUT", entity: "Stay", entityId: stayId, metadata: { roomId: stay.roomId } });
  publishDomainEvent({ type: "stay.checkedOut", stayId, roomId: stay.roomId });
  publishDomainEvent({ type: "room.statusChanged", roomId: stay.roomId, status: "CLEANING" });
  publishDomainEvent({ type: "shift.changed", shiftId: shift.id });
  return { ok: true };
}

export async function addCharge(input: AddChargeInput, userId?: string) {
  const stay = await prisma.stay.findUnique({ where: { id: input.stayId } });
  if (!stay || stay.status !== "OPEN") throw new NotFoundError("Open stay not found");

  const product = input.productId ? await prisma.product.findUnique({ where: { id: input.productId } }) : null;
  if (input.productId && (!product || !product.active)) throw new NotFoundError("Product not found");
  if (product && product.stock < input.quantity) throw new ConflictError("Insufficient product stock");

  const unitPriceCents = product?.unitPriceCents ?? input.unitPriceCents;
  const description = product?.name ?? input.description;
  const totalCents = input.quantity * unitPriceCents;
  const shift = input.paymentMethod === "ROOM_ACCOUNT" ? null : await getOrCreateCurrentShift(userId);

  const charge = await prisma.$transaction(async (tx) => {
    const createdCharge = await tx.charge.create({
      data: {
        stayId: stay.id,
        roomId: stay.roomId,
        productId: input.productId,
        guestId: stay.guestId,
        chargeType: input.productId ? "PRODUCT" : "OTHER",
        description,
        quantity: input.quantity,
        unitPriceCents,
        totalCents,
        paymentMethod: input.paymentMethod
      }
    });

    if (product) {
      const stockUpdate = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: input.quantity } },
        data: { stock: { decrement: input.quantity } }
      });
      if (!stockUpdate.count) throw new ConflictError("Insufficient product stock");
    }

    if (shift) {
      await tx.payment.create({
        data: {
          stayId: stay.id,
          shiftId: shift.id,
          receivedByUserId: userId,
          type: "PRODUCT",
          method: input.paymentMethod,
          amountCents: totalCents,
          notes: `Product payment: ${description}`
        }
      });
    }

    return createdCharge;
  });

  await audit({ userId, action: "CHARGE_CREATED", entity: "Charge", entityId: charge.id, metadata: input });
  publishDomainEvent({ type: "charge.created", chargeId: charge.id, stayId: stay.id, roomId: stay.roomId });
  if (shift) publishDomainEvent({ type: "shift.changed", shiftId: shift.id });
  return { charge };
}
