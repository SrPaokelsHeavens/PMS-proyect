import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export const roomInclude = {
  stays: {
    where: { status: "OPEN" },
    include: { guest: true, charges: true, payments: true }
  },
  ratePlans: {
    include: { ratePlan: true }
  },
  rates: {
    include: { dayGroup: true, hourPlan: true }
  },
  overtimeRules: {
    include: { dayGroup: true }
  },
  roomType: {
    include: {
      rates: {
        include: { dayGroup: true, hourPlan: true }
      },
      overtimeRules: {
        include: { dayGroup: true }
      },
      features: { orderBy: { sortOrder: "asc" } }
    }
  }
} satisfies Prisma.RoomInclude;

export function findRooms() {
  return prisma.room.findMany({
    where: { active: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    include: roomInclude
  });
}

export function findRoomById(id: string) {
  return prisma.room.findUnique({ where: { id }, include: roomInclude });
}
