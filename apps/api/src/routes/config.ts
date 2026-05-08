import type { FastifyInstance } from "fastify";
import { dayGroupSchema, hourPlanSchema, overtimeRuleSchema, rateConfigSchema, roomTypeSchema } from "@hotel-os/shared";
import { requireAuth } from "../auth.js";
import {
  createDayGroup,
  createHourPlan,
  createOvertimeRule,
  createRate,
  createRoomType,
  deleteDayGroup,
  deleteHourPlan,
  deleteOvertimeRule,
  deleteRate,
  deleteRoomType,
  getConfig,
  updateDayGroup,
  updateHourPlan,
  updateOvertimeRule,
  updateRate,
  updateRoomType
} from "../services/config.service.js";

export async function configRoutes(app: FastifyInstance) {
  app.get("/config", { preHandler: requireAuth }, async () => getConfig());

  app.post("/config/room-types", { preHandler: requireAuth }, async (request, reply) => {
    const input = roomTypeSchema.parse(request.body);
    const result = await createRoomType(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/config/room-types/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = roomTypeSchema.partial().parse(request.body);
    return updateRoomType(id, input, request.user?.id);
  });

  app.delete("/config/room-types/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteRoomType(id, request.user?.id);
  });

  app.post("/config/day-groups", { preHandler: requireAuth }, async (request, reply) => {
    const input = dayGroupSchema.parse(request.body);
    const result = await createDayGroup(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/config/day-groups/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = dayGroupSchema.partial().parse(request.body);
    return updateDayGroup(id, input, request.user?.id);
  });

  app.delete("/config/day-groups/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteDayGroup(id, request.user?.id);
  });

  app.post("/config/hour-plans", { preHandler: requireAuth }, async (request, reply) => {
    const input = hourPlanSchema.parse(request.body);
    const result = await createHourPlan(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/config/hour-plans/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = hourPlanSchema.partial().parse(request.body);
    return updateHourPlan(id, input, request.user?.id);
  });

  app.delete("/config/hour-plans/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteHourPlan(id, request.user?.id);
  });

  app.post("/config/rates", { preHandler: requireAuth }, async (request, reply) => {
    const input = rateConfigSchema.parse(request.body);
    const result = await createRate(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/config/rates/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = rateConfigSchema.parse(request.body);
    return updateRate(id, input, request.user?.id);
  });

  app.delete("/config/rates/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteRate(id, request.user?.id);
  });

  app.post("/config/overtime-rules", { preHandler: requireAuth }, async (request, reply) => {
    const input = overtimeRuleSchema.parse(request.body);
    const result = await createOvertimeRule(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/config/overtime-rules/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = overtimeRuleSchema.partial().parse(request.body);
    return updateOvertimeRule(id, input, request.user?.id);
  });

  app.delete("/config/overtime-rules/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteOvertimeRule(id, request.user?.id);
  });
}
