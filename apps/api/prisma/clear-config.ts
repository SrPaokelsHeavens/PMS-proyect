import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.stay.updateMany({ data: { rateId: null, hourPlanId: null, overtimeRuleId: null } }),
    prisma.room.updateMany({ data: { roomTypeId: null } }),
    prisma.rate.deleteMany(),
    prisma.overtimeRule.deleteMany(),
    prisma.rateRoom.deleteMany(),
    prisma.ratePlan.deleteMany(),
    prisma.hourPlan.deleteMany(),
    prisma.dayGroup.deleteMany(),
    prisma.roomTypeFeature.deleteMany(),
    prisma.roomType.deleteMany()
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
