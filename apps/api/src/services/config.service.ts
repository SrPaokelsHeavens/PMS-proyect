import type { ConfigScope, DayGroupInput, HourPlanInput, OvertimeRuleInput, RateConfigInput, RoomTypeInput } from "@hotel-os/shared";
import { audit } from "../audit.js";
import { prisma } from "../db.js";
import { encodeDaysOfWeek, parseDaysOfWeek } from "../domain/rates.js";
import { publishDomainEvent } from "../realtime/event-bus.js";

function emptyToNull(value: string | undefined) {
  return value || null;
}

function publishConfigChanged(scope: ConfigScope) {
  publishDomainEvent({ type: "config.changed", scope });
}

export async function getConfig() {
  const [roomTypes, dayGroups, hourPlans, rates, overtimeRules, rooms] = await Promise.all([
    prisma.roomType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        features: { orderBy: { sortOrder: "asc" } },
        _count: { select: { rooms: true } }
      }
    }),
    prisma.dayGroup.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.hourPlan.findMany({ where: { active: true }, orderBy: [{ hours: "asc" }, { name: "asc" }] }),
    prisma.rate.findMany({ where: { active: true }, orderBy: [{ priority: "desc" }, { name: "asc" }] }),
    prisma.overtimeRule.findMany({ where: { active: true }, orderBy: [{ priority: "desc" }, { name: "asc" }] }),
    prisma.room.findMany({ where: { active: true }, orderBy: [{ floor: "asc" }, { number: "asc" }], include: { roomType: true } })
  ]);

  return {
    roomTypes: roomTypes.map((type) => ({
      id: type.id,
      name: type.name,
      description: type.description,
      active: type.active,
      features: type.features.map((feature) => feature.label),
      roomCount: type._count.rooms
    })),
    dayGroups: dayGroups.map((group) => ({
      id: group.id,
      name: group.name,
      daysOfWeek: parseDaysOfWeek(group.daysOfWeek),
      active: group.active
    })),
    hourPlans: hourPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      hours: plan.hours,
      active: plan.active
    })),
    rates: rates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      roomTypeId: rate.roomTypeId,
      roomId: rate.roomId,
      dayGroupId: rate.dayGroupId,
      hourPlanId: rate.hourPlanId,
      priceCents: rate.priceCents,
      active: rate.active,
      priority: rate.priority
    })),
    overtimeRules: overtimeRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      graceMinutes: rule.graceMinutes,
      extraHourCents: rule.extraHourCents,
      roomTypeId: rule.roomTypeId,
      roomId: rule.roomId,
      dayGroupId: rule.dayGroupId,
      hourPlanId: rule.hourPlanId,
      active: rule.active,
      priority: rule.priority
    })),
    rooms: rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      type: room.roomType?.name || "Sin tipo",
      shortLabel: room.shortLabel,
      status: room.status,
      active: room.active,
      notes: room.notes,
      roomTypeId: room.roomTypeId,
      baseRateCents: room.baseRateCents
    }))
  };
}

export async function createRoomType(input: RoomTypeInput, userId?: string) {
  const roomType = await prisma.roomType.create({
    data: {
      name: input.name,
      description: input.description,
      active: input.active,
      features: {
        create: input.features.map((label, index) => ({ label, sortOrder: index }))
      }
    },
    include: { features: { orderBy: { sortOrder: "asc" } }, _count: { select: { rooms: true } } }
  });
  await audit({ userId, action: "ROOM_TYPE_CREATED", entity: "RoomType", entityId: roomType.id, metadata: input });
  publishConfigChanged("roomTypes");
  return { roomType: toApiRoomType(roomType) };
}

export async function updateRoomType(id: string, input: Partial<RoomTypeInput>, userId?: string) {
  const roomType = await prisma.$transaction(async (tx) => {
    if (input.features) {
      await tx.roomTypeFeature.deleteMany({ where: { roomTypeId: id } });
      if (input.features.length) {
        await tx.roomTypeFeature.createMany({
          data: input.features.map((label, index) => ({ roomTypeId: id, label, sortOrder: index }))
        });
      }
    }

    return tx.roomType.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        active: input.active
      },
      include: { features: { orderBy: { sortOrder: "asc" } }, _count: { select: { rooms: true } } }
    });
  });
  await audit({ userId, action: "ROOM_TYPE_UPDATED", entity: "RoomType", entityId: id, metadata: input });
  publishConfigChanged("roomTypes");
  return { roomType: toApiRoomType(roomType) };
}

export async function deleteRoomType(id: string, userId?: string) {
  const roomType = await prisma.roomType.update({
    where: { id },
    data: { active: false },
    include: { features: { orderBy: { sortOrder: "asc" } }, _count: { select: { rooms: true } } }
  });
  await audit({ userId, action: "ROOM_TYPE_DISABLED", entity: "RoomType", entityId: id });
  publishConfigChanged("roomTypes");
  return { roomType: toApiRoomType(roomType) };
}

export async function createDayGroup(input: DayGroupInput, userId?: string) {
  const dayGroup = await prisma.dayGroup.create({ data: { ...input, daysOfWeek: encodeDaysOfWeek(input.daysOfWeek) } });
  await audit({ userId, action: "DAY_GROUP_CREATED", entity: "DayGroup", entityId: dayGroup.id, metadata: input });
  publishConfigChanged("dayGroups");
  return { dayGroup };
}

export async function updateDayGroup(id: string, input: Partial<DayGroupInput>, userId?: string) {
  const dayGroup = await prisma.dayGroup.update({
    where: { id },
    data: {
      ...input,
      daysOfWeek: input.daysOfWeek ? encodeDaysOfWeek(input.daysOfWeek) : undefined
    }
  });
  await audit({ userId, action: "DAY_GROUP_UPDATED", entity: "DayGroup", entityId: id, metadata: input });
  publishConfigChanged("dayGroups");
  return { dayGroup };
}

export async function deleteDayGroup(id: string, userId?: string) {
  const dayGroup = await prisma.dayGroup.update({ where: { id }, data: { active: false } });
  await audit({ userId, action: "DAY_GROUP_DISABLED", entity: "DayGroup", entityId: id });
  publishConfigChanged("dayGroups");
  return { dayGroup };
}

export async function createHourPlan(input: HourPlanInput, userId?: string) {
  const hourPlan = await prisma.hourPlan.create({ data: input });
  await audit({ userId, action: "HOUR_PLAN_CREATED", entity: "HourPlan", entityId: hourPlan.id, metadata: input });
  publishConfigChanged("hourPlans");
  return { hourPlan };
}

export async function updateHourPlan(id: string, input: Partial<HourPlanInput>, userId?: string) {
  const hourPlan = await prisma.hourPlan.update({ where: { id }, data: input });
  await audit({ userId, action: "HOUR_PLAN_UPDATED", entity: "HourPlan", entityId: id, metadata: input });
  publishConfigChanged("hourPlans");
  return { hourPlan };
}

export async function deleteHourPlan(id: string, userId?: string) {
  const hourPlan = await prisma.hourPlan.update({ where: { id }, data: { active: false } });
  await audit({ userId, action: "HOUR_PLAN_DISABLED", entity: "HourPlan", entityId: id });
  publishConfigChanged("hourPlans");
  return { hourPlan };
}

export async function createRate(input: RateConfigInput, userId?: string) {
  const rate = await prisma.rate.create({
    data: {
      name: input.name,
      roomTypeId: emptyToNull(input.roomTypeId),
      roomId: emptyToNull(input.roomId),
      dayGroupId: input.dayGroupId,
      hourPlanId: input.hourPlanId,
      priceCents: input.priceCents,
      active: input.active,
      priority: input.priority
    }
  });
  await audit({ userId, action: "RATE_CREATED", entity: "Rate", entityId: rate.id, metadata: input });
  publishConfigChanged("rates");
  return { rate };
}

export async function updateRate(id: string, input: Partial<RateConfigInput>, userId?: string) {
  const rate = await prisma.rate.update({
    where: { id },
    data: {
      ...input,
      roomTypeId: input.roomTypeId === undefined ? undefined : emptyToNull(input.roomTypeId),
      roomId: input.roomId === undefined ? undefined : emptyToNull(input.roomId)
    }
  });
  await audit({ userId, action: "RATE_UPDATED", entity: "Rate", entityId: id, metadata: input });
  publishConfigChanged("rates");
  return { rate };
}

export async function deleteRate(id: string, userId?: string) {
  const rate = await prisma.rate.update({ where: { id }, data: { active: false } });
  await audit({ userId, action: "RATE_DISABLED", entity: "Rate", entityId: id });
  publishConfigChanged("rates");
  return { rate };
}

export async function createOvertimeRule(input: OvertimeRuleInput, userId?: string) {
  const overtimeRule = await prisma.overtimeRule.create({
    data: {
      ...input,
      roomTypeId: emptyToNull(input.roomTypeId),
      roomId: emptyToNull(input.roomId),
      dayGroupId: emptyToNull(input.dayGroupId),
      hourPlanId: emptyToNull(input.hourPlanId)
    }
  });
  await audit({ userId, action: "OVERTIME_RULE_CREATED", entity: "OvertimeRule", entityId: overtimeRule.id, metadata: input });
  publishConfigChanged("overtimeRules");
  return { overtimeRule };
}

export async function updateOvertimeRule(id: string, input: Partial<OvertimeRuleInput>, userId?: string) {
  const overtimeRule = await prisma.overtimeRule.update({
    where: { id },
    data: {
      ...input,
      roomTypeId: input.roomTypeId === undefined ? undefined : emptyToNull(input.roomTypeId),
      roomId: input.roomId === undefined ? undefined : emptyToNull(input.roomId),
      dayGroupId: input.dayGroupId === undefined ? undefined : emptyToNull(input.dayGroupId),
      hourPlanId: input.hourPlanId === undefined ? undefined : emptyToNull(input.hourPlanId)
    }
  });
  await audit({ userId, action: "OVERTIME_RULE_UPDATED", entity: "OvertimeRule", entityId: id, metadata: input });
  publishConfigChanged("overtimeRules");
  return { overtimeRule };
}

function toApiRoomType(roomType: {
  id: string;
  name: string;
  description: string;
  active: boolean;
  features: Array<{ label: string }>;
  _count: { rooms: number };
}) {
  return {
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    active: roomType.active,
    features: roomType.features.map((feature) => feature.label),
    roomCount: roomType._count.rooms
  };
}

export async function deleteOvertimeRule(id: string, userId?: string) {
  const overtimeRule = await prisma.overtimeRule.update({ where: { id }, data: { active: false } });
  await audit({ userId, action: "OVERTIME_RULE_DISABLED", entity: "OvertimeRule", entityId: id });
  publishConfigChanged("overtimeRules");
  return { overtimeRule };
}
