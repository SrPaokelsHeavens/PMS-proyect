import type { FastifyInstance } from "fastify";
import { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";
import { onDomainEvent } from "./event-bus.js";

function isAllowedOrigin(origin: string) {
  return config.webOrigins.includes(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):5173$/.test(origin)
    || /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$/.test(origin);
}

export function attachRealtime(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.join("hotel-sync");
    socket.emit("sync.ready", { ok: true });
  });

  const unsubscribe = onDomainEvent((event) => {
    io.to("hotel-sync").emit("domain:event", event);
  });

  app.addHook("onClose", async () => {
    unsubscribe();
    io.close();
  });

  return io;
}
