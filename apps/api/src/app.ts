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
import { attachRealtime } from "./realtime/socket.js";

async function registerApiRoutes(app: ReturnType<typeof Fastify>) {
  await app.register(authRoutes);
  await app.register(configRoutes);
  await app.register(roomRoutes);
  await app.register(productRoutes);
  await app.register(rateRoutes);
  await app.register(guestRoutes);
  await app.register(shiftRoutes);
}

export async function createApp() {
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
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigin = config.webOrigins.includes(origin)
        || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):5173$/.test(origin)
        || /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$/.test(origin);

      callback(null, allowedOrigin);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.get("/health", async () => ({ ok: true, service: "hotel-os-api" }));

  await registerApiRoutes(app);
  await app.register(async (apiApp) => registerApiRoutes(apiApp), { prefix: "/api" });
  attachRealtime(app);

  return app;
}
