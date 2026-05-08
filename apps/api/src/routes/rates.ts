import type { FastifyInstance } from "fastify";
import type { ApiRatePlan } from "@hotel-os/shared";
import { assignRatePlanRoomsSchema, createRatePlanSchema, updateRatePlanSchema } from "@hotel-os/shared";
import { audit } from "../audit.js";
import { prisma } from "../db.js";
import { encodeDaysOfWeek, parseDaysOfWeek } from "../rates.js";
import { requireAuth } from "../auth.js";

function toApiRatePlan(ratePlan: {
  id: string;
  name: string;
  stayHours: number;
  priceCents: number;
  daysOfWeek: string;
  active: boolean;
  priority: number;
  rooms: Array<{ roomId: string }>;
}): ApiRatePlan {
  return {
    id: ratePlan.id,
    name: ratePlan.name,
    stayHours: ratePlan.stayHours,
    priceCents: ratePlan.priceCents,
    daysOfWeek: parseDaysOfWeek(ratePlan.daysOfWeek),
    active: ratePlan.active,
    priority: ratePlan.priority,
    roomIds: ratePlan.rooms.map((room) => room.roomId)
  };
}

export async function rateRoutes(app: FastifyInstance) {
  app.get("/rates", { preHandler: requireAuth }, async () => {
    const [ratePlans, rooms] = await Promise.all([
      prisma.ratePlan.findMany({
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        include: { rooms: true }
      }),
      prisma.room.findMany({
        orderBy: [{ floor: "asc" }, { number: "asc" }],
        include: { roomType: true }
      })
    ]);

    return {
      ratePlans: ratePlans.map(toApiRatePlan),
      rooms: rooms.map((room) => ({
        id: room.id,
        number: room.number,
        floor: room.floor,
        type: room.roomType?.name || "Sin tipo",
        shortLabel: room.shortLabel,
        status: room.status,
        baseRateCents: room.baseRateCents
      }))
    };
  });

  app.post("/rates", { preHandler: requireAuth }, async (request, reply) => {
    const input = createRatePlanSchema.parse(request.body);
    const ratePlan = await prisma.ratePlan.create({
      data: {
        name: input.name,
        stayHours: input.stayHours,
        priceCents: input.priceCents,
        daysOfWeek: encodeDaysOfWeek(input.daysOfWeek),
        active: input.active,
        priority: input.priority,
        rooms: {
          create: [...new Set(input.roomIds)].map((roomId) => ({ roomId }))
        }
      },
      include: { rooms: true }
    });

    await audit({ userId: request.user?.id, action: "RATE_PLAN_CREATED", entity: "RatePlan", entityId: ratePlan.id, metadata: input });
    return reply.code(201).send({ ratePlan: toApiRatePlan(ratePlan) });
  });

  app.patch("/rates/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateRatePlanSchema.parse(request.body);
    const exists = await prisma.ratePlan.findUnique({ where: { id } });
    if (!exists) return reply.code(404).send({ message: "Rate plan not found" });

    const roomIds = input.roomIds ? [...new Set(input.roomIds)] : null;
    const ratePlan = await prisma.$transaction(async (tx) => {
      if (roomIds) {
        await tx.rateRoom.deleteMany({ where: { ratePlanId: id } });
        if (roomIds.length) {
          await tx.rateRoom.createMany({
            data: roomIds.map((roomId) => ({ ratePlanId: id, roomId }))
          });
        }
      }

      return tx.ratePlan.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.stayHours !== undefined ? { stayHours: input.stayHours } : {}),
          ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
          ...(input.daysOfWeek !== undefined ? { daysOfWeek: encodeDaysOfWeek(input.daysOfWeek) } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {})
        },
        include: { rooms: true }
      });
    });

    await audit({ userId: request.user?.id, action: "RATE_PLAN_UPDATED", entity: "RatePlan", entityId: id, metadata: input });
    return { ratePlan: toApiRatePlan(ratePlan) };
  });

  app.patch("/rates/:id/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = assignRatePlanRoomsSchema.parse(request.body);
    const exists = await prisma.ratePlan.findUnique({ where: { id } });
    if (!exists) return reply.code(404).send({ message: "Rate plan not found" });

    const ratePlan = await prisma.$transaction(async (tx) => {
      await tx.rateRoom.deleteMany({ where: { ratePlanId: id } });
      const roomIds = [...new Set(input.roomIds)];
      if (roomIds.length) {
        await tx.rateRoom.createMany({
          data: roomIds.map((roomId) => ({ ratePlanId: id, roomId }))
        });
      }

      return tx.ratePlan.findUniqueOrThrow({ where: { id }, include: { rooms: true } });
    });

    await audit({ userId: request.user?.id, action: "RATE_PLAN_ROOMS_ASSIGNED", entity: "RatePlan", entityId: id, metadata: input });
    return { ratePlan: toApiRatePlan(ratePlan) };
  });
}
