import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";

const secret = new TextEncoder().encode(config.jwtSecret);

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function createToken(user: AuthUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ code: "AUTH_REQUIRED", message: "Authentication required" });
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), secret);
    request.user = {
      id: String(payload.id),
      username: String(payload.username),
      role: String(payload.role)
    };
  } catch {
    return reply.code(401).send({ code: "SESSION_EXPIRED", message: "Invalid or expired session" });
  }
}
