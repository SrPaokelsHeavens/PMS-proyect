import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", { preHandler: requireAuth }, async () => {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    return { products };
  });
}
