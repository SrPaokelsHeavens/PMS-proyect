import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { configRoutes } from "./routes/config.js";
import { guestRoutes } from "./routes/guests.js";
import { productRoutes } from "./routes/products.js";
import { rateRoutes } from "./routes/rates.js";
import { roomRoutes } from "./routes/rooms.js";
import { shiftRoutes } from "./routes/shifts.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info"
  }
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    request.log.warn(error);
    return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid request", issues: error.flatten() });
  }

  const requestError = error as { statusCode?: number; code?: string; message?: string };
  const statusCode = typeof requestError.statusCode === "number" ? requestError.statusCode : 500;
  if (statusCode >= 400 && statusCode < 500) {
    request.log.warn(error);
    return reply.code(statusCode).send({
      code: requestError.code || "REQUEST_ERROR",
      message: requestError.message || "Request error"
    });
  }

  request.log.error(error);
  return reply.code(500).send({ message: "Internal server error" });
});

await app.register(helmet);
await app.register(cors, {
  origin: config.webOrigin,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
});
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

app.get("/health", async () => ({ ok: true, service: "hotel-os-api" }));

await app.register(authRoutes);
await app.register(configRoutes);
await app.register(roomRoutes);
await app.register(productRoutes);
await app.register(rateRoutes);
await app.register(guestRoutes);
await app.register(shiftRoutes);

await app.listen({ port: config.port, host: "0.0.0.0" });
