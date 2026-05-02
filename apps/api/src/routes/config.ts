import type { FastifyInstance } from "fastify";
import {
  dayGroupSchema,
  hourPlanSchema,
  overtimeRuleSchema,
  rateConfigSchema,
  roomGroupSchema
} from "@hotel-os/shared";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { encodeDaysOfWeek, parseDaysOfWeek } from "../rates.js";

function emptyToNull(value: string | undefined) {
  return value || null;
}

export async function configRoutes(app: FastifyInstance) {
  app.get("/config", { preHandler: requireAuth }, async () => {
    const [roomGroups, dayGroups, hourPlans, rates, overtimeRules, rooms] = await Promise.all([
      prisma.roomGroup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { rooms: true } } } }),
      prisma.dayGroup.findMany({ orderBy: { name: "asc" } }),
      prisma.hourPlan.findMany({ orderBy: [{ hours: "asc" }, { name: "asc" }] }),
      prisma.rate.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }, { name: "asc" }] }),
      prisma.overtimeRule.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }, { name: "asc" }] }),
      prisma.room.findMany({ orderBy: [{ floor: "asc" }, { number: "asc" }] })
    ]);

    return {
      roomGroups: roomGroups.map((group) => ({
        id: group.id,
        name: group.name,
        active: group.active,
        notes: group.notes,
        roomCount: group._count.rooms
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
        roomGroupId: rate.roomGroupId,
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
        roomGroupId: rule.roomGroupId,
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
        type: room.type,
        shortLabel: room.shortLabel,
        status: room.status,
        active: room.active,
        notes: room.notes,
        roomGroupId: room.roomGroupId,
        baseRateCents: room.baseRateCents
      }))
    };
  });

  app.post("/config/room-groups", { preHandler: requireAuth }, async (request, reply) => {
    const input = roomGroupSchema.parse(request.body);
    const roomGroup = await prisma.roomGroup.create({ data: input });
    await audit({ userId: request.user?.id, action: "ROOM_GROUP_CREATED", entity: "RoomGroup", entityId: roomGroup.id, metadata: input });
    return reply.code(201).send({ roomGroup });
  });

  app.patch("/config/room-groups/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = roomGroupSchema.partial().parse(request.body);
    const roomGroup = await prisma.roomGroup.update({ where: { id }, data: input });
    await audit({ userId: request.user?.id, action: "ROOM_GROUP_UPDATED", entity: "RoomGroup", entityId: id, metadata: input });
    return { roomGroup };
  });

  app.post("/config/day-groups", { preHandler: requireAuth }, async (request, reply) => {
    const input = dayGroupSchema.parse(request.body);
    const dayGroup = await prisma.dayGroup.create({ data: { ...input, daysOfWeek: encodeDaysOfWeek(input.daysOfWeek) } });
    await audit({ userId: request.user?.id, action: "DAY_GROUP_CREATED", entity: "DayGroup", entityId: dayGroup.id, metadata: input });
    return reply.code(201).send({ dayGroup });
  });

  app.patch("/config/day-groups/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = dayGroupSchema.partial().parse(request.body);
    const dayGroup = await prisma.dayGroup.update({
      where: { id },
      data: {
        ...input,
        daysOfWeek: input.daysOfWeek ? encodeDaysOfWeek(input.daysOfWeek) : undefined
      }
    });
    await audit({ userId: request.user?.id, action: "DAY_GROUP_UPDATED", entity: "DayGroup", entityId: id, metadata: input });
    return { dayGroup };
  });

  app.post("/config/hour-plans", { preHandler: requireAuth }, async (request, reply) => {
    const input = hourPlanSchema.parse(request.body);
    const hourPlan = await prisma.hourPlan.create({ data: input });
    await audit({ userId: request.user?.id, action: "HOUR_PLAN_CREATED", entity: "HourPlan", entityId: hourPlan.id, metadata: input });
    return reply.code(201).send({ hourPlan });
  });

  app.patch("/config/hour-plans/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = hourPlanSchema.partial().parse(request.body);
    const hourPlan = await prisma.hourPlan.update({ where: { id }, data: input });
    await audit({ userId: request.user?.id, action: "HOUR_PLAN_UPDATED", entity: "HourPlan", entityId: id, metadata: input });
    return { hourPlan };
  });

  app.post("/config/rates", { preHandler: requireAuth }, async (request, reply) => {
    const input = rateConfigSchema.parse(request.body);
    const rate = await prisma.rate.create({
      data: {
        name: input.name,
        roomGroupId: emptyToNull(input.roomGroupId),
        roomId: emptyToNull(input.roomId),
        dayGroupId: input.dayGroupId,
        hourPlanId: input.hourPlanId,
        priceCents: input.priceCents,
        active: input.active,
        priority: input.priority
      }
    });
    await audit({ userId: request.user?.id, action: "RATE_CREATED", entity: "Rate", entityId: rate.id, metadata: input });
    return reply.code(201).send({ rate });
  });

  app.patch("/config/rates/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = rateConfigSchema.parse(request.body);
    const rate = await prisma.rate.update({
      where: { id },
      data: {
        ...input,
        roomGroupId: input.roomGroupId === undefined ? undefined : emptyToNull(input.roomGroupId),
        roomId: input.roomId === undefined ? undefined : emptyToNull(input.roomId)
      }
    });
    await audit({ userId: request.user?.id, action: "RATE_UPDATED", entity: "Rate", entityId: id, metadata: input });
    return { rate };
  });

  app.post("/config/overtime-rules", { preHandler: requireAuth }, async (request, reply) => {
    const input = overtimeRuleSchema.parse(request.body);
    const overtimeRule = await prisma.overtimeRule.create({
      data: {
        ...input,
        roomGroupId: emptyToNull(input.roomGroupId),
        roomId: emptyToNull(input.roomId),
        dayGroupId: emptyToNull(input.dayGroupId),
        hourPlanId: emptyToNull(input.hourPlanId)
      }
    });
    await audit({ userId: request.user?.id, action: "OVERTIME_RULE_CREATED", entity: "OvertimeRule", entityId: overtimeRule.id, metadata: input });
    return reply.code(201).send({ overtimeRule });
  });

  app.patch("/config/overtime-rules/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = overtimeRuleSchema.partial().parse(request.body);
    const overtimeRule = await prisma.overtimeRule.update({
      where: { id },
      data: {
        ...input,
        roomGroupId: input.roomGroupId === undefined ? undefined : emptyToNull(input.roomGroupId),
        roomId: input.roomId === undefined ? undefined : emptyToNull(input.roomId),
        dayGroupId: input.dayGroupId === undefined ? undefined : emptyToNull(input.dayGroupId),
        hourPlanId: input.hourPlanId === undefined ? undefined : emptyToNull(input.hourPlanId)
      }
    });
    await audit({ userId: request.user?.id, action: "OVERTIME_RULE_UPDATED", entity: "OvertimeRule", entityId: id, metadata: input });
    return { overtimeRule };
  });
}
