import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rooms = [
  ["201", 2, "Queen", "Q", 5900],
  ["202", 2, "Matrimonial", "M", 5900],
  ["203", 2, "Junior", "J", 6900],
  ["204", 2, "Panoramic", "P", 8900],
  ["205", 2, "Suite", "S", 7900],
  ["206", 2, "Suite", "S", 7900],
  ["207", 2, "Queen", "Q", 5900],
  ["301", 3, "Queen", "Q", 5900],
  ["302", 3, "Matrimonial", "M", 5900],
  ["303", 3, "Panoramic", "P", 8900],
  ["304", 3, "Panoramic", "P", 8900],
  ["305", 3, "Suite", "S", 7900],
  ["306", 3, "Queen", "Q", 5900],
  ["307", 3, "Queen", "Q", 5900],
  ["401", 4, "Queen", "Q", 5900],
  ["402", 4, "Matrimonial", "M", 5900],
  ["403", 4, "Panoramic", "P", 8900],
  ["404", 4, "Panoramic", "P", 8900],
  ["405", 4, "Suite", "S", 7900],
  ["406", 4, "Matrimonial", "M", 5900],
  ["407", 4, "Queen", "Q", 5900],
  ["501", 5, "Queen", "Q", 5900],
  ["502", 5, "Matrimonial", "M", 5900],
  ["503", 5, "Panoramic", "P", 8900],
  ["504", 5, "Panoramic", "P", 8900],
  ["505", 5, "Suite", "S", 7900],
  ["506", 5, "Matrimonial", "M", 5900],
  ["507", 5, "Queen", "Q", 5900]
] as const;

const products = [
  ["AGUA625", "Water 625 ml", "Drink", 300, 64],
  ["GASEOSA", "Soda", "Drink", 500, 38],
  ["CERVEZA", "Beer", "Drink", 800, 42],
  ["VINO", "Wine bottle", "Drink", 3500, 12],
  ["SNACK", "Snack", "Minibar", 400, 54],
  ["LATE", "Late checkout", "Service", 2500, 999]
] as const;

async function main() {
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: await bcrypt.hash("admin123", 12),
      role: "ADMIN"
    }
  });

  for (const [number, floor, type, shortLabel, baseRateCents] of rooms) {
    const roomGroup = await prisma.roomGroup.upsert({
      where: { name: type },
      update: { active: true },
      create: { name: type }
    });

    await prisma.room.upsert({
      where: { number },
      update: { floor, type, shortLabel, baseRateCents, roomGroupId: roomGroup.id, active: true },
      create: { number, floor, type, shortLabel, baseRateCents, roomGroupId: roomGroup.id }
    });
  }

  const allDays = await prisma.dayGroup.upsert({
    where: { name: "Todos los dias" },
    update: { daysOfWeek: "0,1,2,3,4,5,6", active: true },
    create: { name: "Todos los dias", daysOfWeek: "0,1,2,3,4,5,6" }
  });

  const defaultHours = [
    ["1 hora", 1],
    ["4 horas", 4],
    ["6 horas", 6],
    ["12 horas", 12],
    ["24 horas", 24]
  ] as const;

  for (const [name, hours] of defaultHours) {
    await prisma.hourPlan.upsert({
      where: { name },
      update: { hours, active: true },
      create: { name, hours }
    });
  }

  const sixHourPlan = await prisma.hourPlan.findUniqueOrThrow({ where: { name: "6 horas" } });
  const groups = await prisma.roomGroup.findMany({
    include: { rooms: { take: 1, orderBy: { number: "asc" } } }
  });
  for (const group of groups) {
    const baseRateCents = group.rooms[0]?.baseRateCents ?? 5900;
    await prisma.rate.upsert({
      where: { id: `default-rate-${group.id}` },
      update: {
        name: `${group.name} - 6 horas`,
        roomGroupId: group.id,
        dayGroupId: allDays.id,
        hourPlanId: sixHourPlan.id,
        priceCents: baseRateCents,
        active: true,
        priority: 10
      },
      create: {
        id: `default-rate-${group.id}`,
        name: `${group.name} - 6 horas`,
        roomGroupId: group.id,
        dayGroupId: allDays.id,
        hourPlanId: sixHourPlan.id,
        priceCents: baseRateCents,
        active: true,
        priority: 10
      }
    });
  }

  await prisma.overtimeRule.upsert({
    where: { id: "default-overtime-rule" },
    update: { name: "Regla general", graceMinutes: 5, extraHourCents: 2000, dayGroupId: allDays.id, active: true },
    create: { id: "default-overtime-rule", name: "Regla general", graceMinutes: 5, extraHourCents: 2000, dayGroupId: allDays.id }
  });

  for (const [sku, name, category, unitPriceCents, stock] of products) {
    await prisma.product.upsert({
      where: { sku },
      update: { name, category, unitPriceCents, stock, active: true },
      create: { sku, name, category, unitPriceCents, stock }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
