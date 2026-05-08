import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.charge.deleteMany(),
    prisma.stayGuest.deleteMany(),
    prisma.stay.deleteMany(),
    prisma.rateRoom.deleteMany(),
    prisma.ratePlan.deleteMany(),
    prisma.rate.deleteMany(),
    prisma.overtimeRule.deleteMany(),
    prisma.hourPlan.deleteMany(),
    prisma.dayGroup.deleteMany(),
    prisma.room.deleteMany(),
    prisma.roomTypeFeature.deleteMany(),
    prisma.roomType.deleteMany(),
    prisma.shift.deleteMany()
  ]);
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
