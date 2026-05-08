import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { getCurrentShiftLedger } from "../services/shift.service.js";

export async function shiftRoutes(app: FastifyInstance) {
  app.get("/shifts/current/ledger", { preHandler: requireAuth }, async (request) => {
    return getCurrentShiftLedger(request.user?.id);
  });
}

