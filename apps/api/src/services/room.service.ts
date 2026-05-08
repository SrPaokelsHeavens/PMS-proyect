import type { RoomConfigInput, RoomRangeInput, RoomStatus, UpdateRoomConfigInput } from "@hotel-os/shared";
import { audit } from "../audit.js";
import { prisma } from "../db.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { toApiRoom } from "../mapper.js";
import { findRoomById, findRooms, roomInclude } from "../repositories/room.repository.js";
import { validateRoomConfigStatus, validateRoomStatusTransition } from "../domain/rooms.js";
import { selectAvailableRates, selectOvertimeRule } from "../domain/rates.js";
import { publishDomainEvent } from "../realtime/event-bus.js";

export async function listRooms() {
  const rooms = await findRooms();
  return { rooms: rooms.map(toApiRoom) };
}

export async function getRoom(id: string) {
  const room = await findRoomById(id);
  if (!room) throw new NotFoundError("Room not found");
  return { room: toApiRoom(room) };
}

export async function createRoom(input: RoomConfigInput, userId?: string) {
  const statusError = validateRoomConfigStatus(input.status, 0);
  if (statusError) throw new ConflictError(statusError);

  const room = await prisma.room.create({
    data: {
      ...input,
      roomTypeId: input.roomTypeId || null
    },
    include: roomInclude
  });

  await audit({ userId, action: "ROOM_CREATED", entity: "Room", entityId: room.id, metadata: input });
  publishDomainEvent({ type: "room.created", roomId: room.id });
  publishDomainEvent({ type: "config.changed", scope: "rooms" });
  return { room: toApiRoom(room) };
}

export async function createRoomRange(input: RoomRangeInput, userId?: string) {
  const roomNumbers = Array.from({ length: input.to - input.from + 1 }, (_, index) => String(input.from + index));
  const existingRooms = await prisma.room.findMany({
    where: { number: { in: roomNumbers } },
    select: { id: true, number: true, active: true }
  });
  const existingByNumber = new Map(existingRooms.map((room) => [room.number, room]));
  const createdRoomIds: string[] = [];
  const reactivatedRoomIds: string[] = [];
  const skippedRoomNumbers: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const number of roomNumbers) {
      const existing = existingByNumber.get(number);
      if (existing?.active) {
        skippedRoomNumbers.push(number);
        continue;
      }

      const floor = Math.floor(Number(number) / 100);
      if (existing) {
        await tx.room.update({
          where: { id: existing.id },
          data: {
            floor,
            shortLabel: String(floor || number[0] || "H"),
            baseRateCents: 0,
            roomTypeId: null,
            status: "AVAILABLE",
            active: true,
            notes: ""
          }
        });
        reactivatedRoomIds.push(existing.id);
        continue;
      }

      const room = await tx.room.create({
        data: {
          number,
          floor,
          shortLabel: String(floor || number[0] || "H"),
          baseRateCents: 0,
          roomTypeId: null,
          status: "AVAILABLE",
          active: true
        }
      });
      createdRoomIds.push(room.id);
    }
  });

  await audit({
    userId,
    action: "ROOM_RANGE_CREATED",
    entity: "Room",
    entityId: `${input.from}-${input.to}`,
    metadata: { ...input, created: createdRoomIds.length, reactivated: reactivatedRoomIds.length, skipped: skippedRoomNumbers }
  });

  publishDomainEvent({
    type: "room.rangeCreated",
    from: input.from,
    to: input.to,
    created: createdRoomIds.length,
    reactivated: reactivatedRoomIds.length,
    skipped: skippedRoomNumbers
  });
  publishDomainEvent({ type: "config.changed", scope: "rooms" });

  return {
    created: createdRoomIds.length,
    reactivated: reactivatedRoomIds.length,
    skipped: skippedRoomNumbers
  };
}

export async function updateRoom(id: string, input: UpdateRoomConfigInput, userId?: string) {
  const existingRoom = await findRoomById(id);
  if (!existingRoom) throw new NotFoundError("Room not found");

  const statusError = validateRoomConfigStatus(input.status, existingRoom.stays.length);
  if (statusError) throw new ConflictError(statusError);

  const room = await prisma.room.update({
    where: { id },
    data: {
      ...input,
      roomTypeId: input.roomTypeId === undefined ? undefined : input.roomTypeId || null
    },
    include: roomInclude
  });

  await audit({ userId, action: "ROOM_UPDATED", entity: "Room", entityId: id, metadata: input });
  publishDomainEvent({ type: "room.updated", roomId: id });
  publishDomainEvent({ type: "config.changed", scope: "rooms" });
  return { room: toApiRoom(room) };
}

export async function setRoomStatus(id: string, status: RoomStatus, userId?: string) {
  const existingRoom = await findRoomById(id);
  if (!existingRoom) throw new NotFoundError("Room not found");

  const statusError = validateRoomStatusTransition(status, existingRoom.stays.length);
  if (statusError) throw new ConflictError(statusError);

  const room = await prisma.room.update({ where: { id }, data: { status }, include: roomInclude });
  await audit({ userId, action: "ROOM_STATUS_UPDATED", entity: "Room", entityId: id, metadata: { status } });
  publishDomainEvent({ type: "room.statusChanged", roomId: id, status });
  return { room: toApiRoom(room) };
}

export async function deleteRoom(id: string, userId?: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new NotFoundError("Room not found");

  const [stays, charges, roomRates, roomOvertimeRules] = await Promise.all([
    prisma.stay.findMany({ where: { roomId: id }, select: { id: true } }),
    prisma.charge.findMany({ where: { roomId: id }, select: { id: true } }),
    prisma.rate.findMany({ where: { roomId: id }, select: { id: true } }),
    prisma.overtimeRule.findMany({ where: { roomId: id }, select: { id: true } })
  ]);
  const stayIds = stays.map((stay) => stay.id);
  const chargeIds = charges.map((charge) => charge.id);
  const rateIds = roomRates.map((rate) => rate.id);
  const overtimeRuleIds = roomOvertimeRules.map((rule) => rule.id);

  await prisma.$transaction(async (tx) => {
    if (stayIds.length) {
      await tx.payment.deleteMany({ where: { stayId: { in: stayIds } } });
      await tx.charge.deleteMany({
        where: {
          OR: [
            { stayId: { in: stayIds } },
            { roomId: id }
          ]
        }
      });
      await tx.stayGuest.deleteMany({ where: { stayId: { in: stayIds } } });
      await tx.stay.deleteMany({ where: { id: { in: stayIds } } });
    } else {
      await tx.charge.deleteMany({ where: { roomId: id } });
    }

    if (rateIds.length) {
      await tx.stay.updateMany({ where: { rateId: { in: rateIds } }, data: { rateId: null } });
      await tx.rate.deleteMany({ where: { id: { in: rateIds } } });
    }

    if (overtimeRuleIds.length) {
      await tx.stay.updateMany({ where: { overtimeRuleId: { in: overtimeRuleIds } }, data: { overtimeRuleId: null } });
      await tx.overtimeRule.deleteMany({ where: { id: { in: overtimeRuleIds } } });
    }

    await tx.rateRoom.deleteMany({ where: { roomId: id } });
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { entity: "Room", entityId: id },
          ...(stayIds.length ? [{ entity: "Stay", entityId: { in: stayIds } }] : []),
          ...(chargeIds.length ? [{ entity: "Charge", entityId: { in: chargeIds } }] : [])
        ]
      }
    });
    await tx.room.delete({ where: { id } });
  });

  await audit({
    userId,
    action: "ROOM_DELETED",
    entity: "Room",
    entityId: id,
    metadata: { number: room.number, staysDeleted: stayIds.length, chargesDeleted: chargeIds.length }
  });
  publishDomainEvent({ type: "room.deleted", roomId: id });
  publishDomainEvent({ type: "config.changed", scope: "rooms" });
  return { ok: true, deletedRoomId: id };
}

export async function getAvailableRates(roomId: string) {
  const room = await findRoomById(roomId);
  if (!room) throw new NotFoundError("Room not found");

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
}
