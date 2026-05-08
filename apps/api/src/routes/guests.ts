import type { FastifyInstance } from "fastify";
import type { GuestHistory } from "@hotel-os/shared";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

export async function guestRoutes(app: FastifyInstance) {
  app.get("/guests/by-document/:documentNumber/history", { preHandler: requireAuth }, async (request, reply) => {
    const { documentNumber } = request.params as { documentNumber: string };
    const normalizedDocument = documentNumber.trim();
    if (!normalizedDocument) return reply.code(400).send({ message: "Document number is required" });

    const guests = await prisma.guest.findMany({
      where: { documentNumber: normalizedDocument },
      orderBy: { updatedAt: "desc" },
      include: {
        stays: {
          include: {
            room: { include: { roomType: true } },
            charges: {
              include: { product: true }
            }
          },
          orderBy: { checkInAt: "desc" }
        }
      }
    });

    if (!guests.length) return reply.code(404).send({ message: "Guest not found" });

    const guest = guests[0];
    const stays = guests.flatMap((item) => item.stays);
    const roomCounts = new Map<string, { roomNumber: string; roomType: string; visits: number }>();
    const productCounts = new Map<string, { productId: string; name: string; quantity: number; totalCents: number }>();

    for (const stay of stays) {
      const roomKey = stay.room.number;
      const roomCount = roomCounts.get(roomKey) || {
        roomNumber: stay.room.number,
        roomType: stay.room.roomType?.name || "Sin tipo",
        visits: 0
      };
      roomCount.visits += 1;
      roomCounts.set(roomKey, roomCount);

      for (const charge of stay.charges) {
        if (!charge.productId || !charge.product) continue;
        const productCount = productCounts.get(charge.productId) || {
          productId: charge.productId,
          name: charge.product.name,
          quantity: 0,
          totalCents: 0
        };
        productCount.quantity += charge.quantity;
        productCount.totalCents += charge.totalCents;
        productCounts.set(charge.productId, productCount);
      }
    }

    const favoriteRooms = [...roomCounts.values()].sort((a, b) => b.visits - a.visits);
    const favoriteProducts = [...productCounts.values()].sort((a, b) => b.quantity - a.quantity);
    const totalStayHours = stays.reduce((total, stay) => total + stay.stayHours, 0);
    const totalConsumptionCents = favoriteProducts.reduce((total, product) => total + product.totalCents, 0);

    const history: GuestHistory = {
      guest: {
        id: guest.id,
        documentNumber: guest.documentNumber,
        fullName: guest.fullName,
        birthDate: guest.birthDate ? guest.birthDate.toISOString() : null,
        district: guest.district,
        occupation: guest.occupation
      },
      summary: {
        totalVisits: stays.length,
        lastVisitAt: stays[0]?.checkInAt.toISOString() || null,
        favoriteRoom: favoriteRooms[0]?.roomNumber || null,
        favoriteRoomType: favoriteRooms[0]?.roomType || null,
        averageStayHours: stays.length ? Math.round((totalStayHours / stays.length) * 10) / 10 : null,
        totalConsumptionCents
      },
      favoriteProducts: favoriteProducts.slice(0, 8),
      favoriteRooms: favoriteRooms.slice(0, 8)
    };

    return { history };
  });
}
