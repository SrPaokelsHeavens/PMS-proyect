import type { FastifyInstance } from "fastify";
import { addChargeSchema, checkInSchema, checkOutSchema, roomConfigSchema, roomRangeSchema, updateRoomConfigSchema, updateRoomStatusSchema } from "@hotel-os/shared";
import { requireAuth } from "../auth.js";
import { addCharge, checkIn, checkOut } from "../services/stay.service.js";
import { createRoom, createRoomRange, deleteRoom, getAvailableRates, getRoom, listRooms, setRoomStatus, updateRoom } from "../services/room.service.js";

export async function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", { preHandler: requireAuth }, async () => listRooms());

  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const input = roomConfigSchema.parse(request.body);
    const result = await createRoom(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.get("/rooms/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return getRoom(id);
  });

  app.post("/rooms/range", { preHandler: requireAuth }, async (request, reply) => {
    const input = roomRangeSchema.parse(request.body);
    const result = await createRoomRange(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.patch("/rooms/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = updateRoomConfigSchema.parse(request.body);
    return updateRoom(id, input, request.user?.id);
  });

  app.delete("/rooms/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteRoom(id, request.user?.id);
  });

  app.patch("/rooms/:id/status", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = updateRoomStatusSchema.parse(request.body);
    return setRoomStatus(id, input.status, request.user?.id);
  });

  app.get("/rooms/:id/rates", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return getAvailableRates(id);
  });

  app.get("/rooms/:id/available-rates", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return getAvailableRates(id);
  });

  app.post("/stays/check-in", { preHandler: requireAuth }, async (request, reply) => {
    const input = checkInSchema.parse(request.body);
    const result = await checkIn(input, request.user?.id);
    return reply.code(201).send(result);
  });

  app.post("/stays/:id/check-out", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const input = checkOutSchema.parse(request.body);
    return checkOut(id, input, request.user?.id);
  });

  app.post("/charges", { preHandler: requireAuth }, async (request, reply) => {
    const input = addChargeSchema.parse(request.body);
    const result = await addCharge(input, request.user?.id);
    return reply.code(201).send(result);
  });
}
