import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { loginSchema } from "@hotel-os/shared";
import { createToken, requireAuth } from "../auth.js";
import { prisma } from "../db.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });

    if (!user || !user.active) {
      return reply.code(401).send({ message: "Invalid username or password" });
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      return reply.code(401).send({ message: "Invalid username or password" });
    }

    const sessionUser = { id: user.id, username: user.username, role: user.role };
    return { token: await createToken(sessionUser), user: sessionUser };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request) => {
    return { user: request.user };
  });
}
