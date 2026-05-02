import type { FastifyInstance } from "fastify";
import { addChargeSchema, checkInSchema, checkOutSchema, roomConfigSchema, updateRoomConfigSchema, updateRoomStatusSchema } from "@hotel-os/shared";
import { audit } from "../audit.js";
import { prisma } from "../db.js";
import { toApiRoom } from "../mapper.js";
import { requireAuth } from "../auth.js";
import { calculateOvertime, selectAvailableRates, selectCurrentRate, selectOvertimeRule, selectRateForRoom } from "../rates.js";
import { calculateExtraMinutes, calculateTimingStatus, getOrCreateCurrentShift } from "../shift.js";

const roomInclude = {
  stays: {
    where: { status: "OPEN" },
    include: { guest: true, charges: true, payments: true }
  },
  ratePlans: {
    include: { ratePlan: true }
  },
  rates: {
    include: { dayGroup: true, hourPlan: true }
  },
  overtimeRules: {
    include: { dayGroup: true }
  },
  roomGroup: {
    include: {
      rates: {
        include: { dayGroup: true, hourPlan: true }
      },
      overtimeRules: {
        include: { dayGroup: true }
      }
    }
  }
};

async function upsertGuest(input: {
  documentType: string;
  documentNumber: string;
  fullName: string;
  birthDate?: Date;
  district?: string;
  occupation?: string;
  phone?: string;
  email?: string;
}) {
  const existing = await prisma.guest.findFirst({
    where: {
      documentType: input.documentType,
      documentNumber: input.documentNumber
    },
    orderBy: { updatedAt: "desc" }
  });

  const data = {
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    fullName: input.fullName,
    birthDate: input.birthDate,
    district: input.district || "",
    occupation: input.occupation || "",
    phone: input.phone || "",
    email: input.email || ""
  };

  if (!existing) return prisma.guest.create({ data });
  return prisma.guest.update({ where: { id: existing.id }, data });
}

export async function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", { preHandler: requireAuth }, async () => {
    const rooms = await prisma.room.findMany({
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      include: roomInclude
    });

    return { rooms: rooms.map(toApiRoom) };
  });

  app.get("/rooms/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = await prisma.room.findUnique({ where: { id }, include: roomInclude });
    if (!room) return reply.code(404).send({ message: "Room not found" });
    return { room: toApiRoom(room) };
  });

  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const input = roomConfigSchema.parse(request.body);
    if (input.status === "OCCUPIED") {
      return reply.code(409).send({ message: "Use check-in to mark a room as occupied" });
    }

    const room = await prisma.room.create({
      data: {
        ...input,
        roomGroupId: input.roomGroupId || null
      },
      include: roomInclude
    });

    await audit({ userId: request.user?.id, action: "ROOM_CREATED", entity: "Room", entityId: room.id, metadata: input });
    return reply.code(201).send({ room: toApiRoom(room) });
  });

  app.patch("/rooms/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateRoomConfigSchema.parse(request.body);
    const existingRoom = await prisma.room.findUnique({ where: { id }, include: roomInclude });
    if (!existingRoom) return reply.code(404).send({ message: "Room not found" });
    if (existingRoom.stays.length === 0 && input.status === "OCCUPIED") {
      return reply.code(409).send({ message: "Use check-in to mark a room as occupied" });
    }
    if (existingRoom.stays.length > 0 && input.status && input.status !== "OCCUPIED") {
      return reply.code(409).send({ message: "Room has an open stay and cannot be marked as available, cleaning, or maintenance" });
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        ...input,
        roomGroupId: input.roomGroupId === undefined ? undefined : input.roomGroupId || null
      },
      include: roomInclude
    });
    await audit({ userId: request.user?.id, action: "ROOM_UPDATED", entity: "Room", entityId: id, metadata: input });
    return reply.send({ room: toApiRoom(room) });
  });

  app.patch("/rooms/:id/status", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateRoomStatusSchema.parse(request.body);
    const existingRoom = await prisma.room.findUnique({ where: { id }, include: roomInclude });
    if (!existingRoom) return reply.code(404).send({ message: "Room not found" });
    if (existingRoom.stays.length === 0 && input.status === "OCCUPIED") {
      return reply.code(409).send({ message: "Use check-in to mark a room as occupied" });
    }
    if (existingRoom.stays.length > 0 && input.status !== "OCCUPIED") {
      return reply.code(409).send({ message: "Room has an open stay and cannot be marked as available, cleaning, or maintenance" });
    }

    const room = await prisma.room.update({ where: { id }, data: { status: input.status }, include: roomInclude });
    await audit({ userId: request.user?.id, action: "ROOM_STATUS_UPDATED", entity: "Room", entityId: id, metadata: input });
    return reply.send({ room: toApiRoom(room) });
  });

  app.get("/rooms/:id/available-rates", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = await prisma.room.findUnique({ where: { id }, include: roomInclude });
    if (!room) return reply.code(404).send({ message: "Room not found" });

    const rates = selectAvailableRates(room).map((rate) => {
      const overtimeRule = selectOvertimeRule(room, rate.hourPlanId);
      return {
        id: rate.id,
        name: rate.name,
        hours: rate.hourPlan.hours,
        priceCents: rate.priceCents,
        extraHourCents: overtimeRule?.extraHourCents || 0,
        graceMinutes: overtimeRule?.graceMinutes || 0,
        priority: rate.priority
      };
    });

    return { rates };
  });

  app.post("/stays/check-in", { preHandler: requireAuth }, async (request, reply) => {
    const input = checkInSchema.parse(request.body);
    const room = await prisma.room.findUnique({ where: { id: input.roomId }, include: roomInclude });
    if (!room) return reply.code(404).send({ message: "Room not found" });
    if (room.stays.length > 0 || room.status === "OCCUPIED") {
      return reply.code(409).send({ message: "Room already has an open stay" });
    }
    if (room.status !== "AVAILABLE") {
      return reply.code(409).send({ message: "Room must be available before check in" });
    }

    const configuredRate = input.rateId ? selectRateForRoom(room, input.rateId) : null;
    if (input.rateId && !configuredRate) {
      return reply.code(409).send({ message: "Selected rate is not valid for this room today" });
    }

    const activeRate = selectCurrentRate(room.ratePlans);
    const stayHours = configuredRate?.hourPlan.hours ?? activeRate?.stayHours ?? input.stayHours;
    const rateCents = configuredRate?.priceCents ?? activeRate?.priceCents ?? input.rateCents;
    if (!stayHours || rateCents === undefined) {
      return reply.code(409).send({ message: "No valid rate is configured for this room" });
    }

    const overtimeRule = selectOvertimeRule(room, configuredRate?.hourPlanId || null);
    const plannedCheckOutAt = new Date(Date.now() + stayHours * 60 * 60 * 1000);
    const shift = await getOrCreateCurrentShift(request.user?.id);
    const guest = await upsertGuest(input.guest);
    const companion = input.companion ? await upsertGuest(input.companion) : null;
    const result = await prisma.$transaction(async (tx) => {
      const stay = await tx.stay.create({
        data: {
          roomId: input.roomId,
          guestId: guest.id,
          checkInShiftId: shift.id,
          checkedInByUserId: request.user?.id,
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
              receivedByUserId: request.user?.id,
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

    await audit({ userId: request.user?.id, action: "STAY_CHECKED_IN", entity: "Stay", entityId: result.id, metadata: { roomId: input.roomId } });
    return reply.code(201).send({ stayId: result.id });
  });

  app.post("/stays/:id/check-out", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = checkOutSchema.parse(request.body);
    const stay = await prisma.stay.findUnique({ where: { id } });
    if (!stay || stay.status !== "OPEN") return reply.code(404).send({ message: "Open stay not found" });
    const shift = await getOrCreateCurrentShift(request.user?.id);
    const checkOutAt = new Date();
    const overtime = calculateOvertime(stay.plannedCheckOutAt, checkOutAt, stay.overtimeGraceMinutes, stay.extraHourCents);
    const extraMinutes = overtime.overtimeMinutes || calculateExtraMinutes(stay.plannedCheckOutAt, checkOutAt);
    const shouldChargeOvertime = overtime.overtimeChargeCents > 0 && !input.waiveOvertime;

    await prisma.$transaction(async (tx) => {
      await tx.stay.update({
        where: { id },
        data: {
          status: "CLOSED",
          checkOutAt,
          checkOutShiftId: shift.id,
          checkedOutByUserId: request.user?.id,
          extraMinutes,
          overtimeMinutes: overtime.overtimeMinutes,
          overtimeChargeCents: input.waiveOvertime ? 0 : overtime.overtimeChargeCents,
          overtimeWaivedAt: input.waiveOvertime && overtime.overtimeChargeCents > 0 ? checkOutAt : null,
          overtimeWaivedByUserId: input.waiveOvertime && overtime.overtimeChargeCents > 0 ? request.user?.id : null,
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
            receivedByUserId: request.user?.id,
            type: "OVERTIME",
            method: "CASH",
            amountCents: overtime.overtimeChargeCents,
            notes: `Overtime payment for ${overtime.overtimeMinutes} min`
          }
        });
      }

      await tx.room.update({ where: { id: stay.roomId }, data: { status: "CLEANING" } });
    });

    await audit({ userId: request.user?.id, action: "STAY_CHECKED_OUT", entity: "Stay", entityId: id, metadata: { roomId: stay.roomId } });
    return { ok: true };
  });

  app.post("/charges", { preHandler: requireAuth }, async (request, reply) => {
    const input = addChargeSchema.parse(request.body);
    const stay = await prisma.stay.findUnique({ where: { id: input.stayId } });
    if (!stay || stay.status !== "OPEN") return reply.code(404).send({ message: "Open stay not found" });

    const product = input.productId
      ? await prisma.product.findUnique({ where: { id: input.productId } })
      : null;
    if (input.productId && (!product || !product.active)) return reply.code(404).send({ message: "Product not found" });
    if (product && product.stock < input.quantity) return reply.code(409).send({ message: "Insufficient product stock" });

    const unitPriceCents = product?.unitPriceCents ?? input.unitPriceCents;
    const description = product?.name ?? input.description;
    const totalCents = input.quantity * unitPriceCents;
    const shift = input.paymentMethod === "ROOM_ACCOUNT" ? null : await getOrCreateCurrentShift(request.user?.id);

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
        if (!stockUpdate.count) {
          throw Object.assign(new Error("Insufficient product stock"), { statusCode: 409 });
        }
      }

      if (shift) {
        await tx.payment.create({
          data: {
            stayId: stay.id,
            shiftId: shift.id,
            receivedByUserId: request.user?.id,
            type: "PRODUCT",
            method: input.paymentMethod,
            amountCents: totalCents,
            notes: `Product payment: ${description}`
          }
        });
      }

      return createdCharge;
    });

    await audit({ userId: request.user?.id, action: "CHARGE_CREATED", entity: "Charge", entityId: charge.id, metadata: input });
    return reply.code(201).send({ charge });
  });
}
