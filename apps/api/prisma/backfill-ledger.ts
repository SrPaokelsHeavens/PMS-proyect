import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function businessDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function shiftName(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "2-digit",
    hour12: false
  }).format(date));

  if (hour >= 7 && hour < 15) return "MORNING";
  if (hour >= 15 && hour < 23) return "AFTERNOON";
  return "NIGHT";
}

function timingStatus(plannedCheckOutAt: Date | null, checkOutAt: Date | null) {
  const reference = checkOutAt ?? new Date();
  if (!plannedCheckOutAt) return checkOutAt ? "LEFT_ON_TIME" : "ON_TIME";
  if (!checkOutAt) return reference > plannedCheckOutAt ? "OVERDUE" : "ON_TIME";
  return checkOutAt > plannedCheckOutAt ? "LEFT_LATE" : "LEFT_ON_TIME";
}

function extraMinutes(plannedCheckOutAt: Date | null, checkOutAt: Date | null) {
  if (!plannedCheckOutAt || !checkOutAt || checkOutAt <= plannedCheckOutAt) return 0;
  return Math.ceil((checkOutAt.getTime() - plannedCheckOutAt.getTime()) / 60000);
}

async function getOrCreateShift(date: Date, userId?: string) {
  const where = {
    businessDate: businessDate(date),
    name: shiftName(date)
  };

  const existing = await prisma.shift.findFirst({ where });
  if (existing) return existing;

  return prisma.shift.create({
    data: {
      ...where,
      status: "CLOSED",
      openedAt: date,
      closedAt: date,
      openedByUserId: userId,
      closedByUserId: userId
    }
  });
}

async function main() {
  const admin = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  const stays = await prisma.stay.findMany({
    include: {
      charges: true,
      payments: true,
      stayGuests: true
    },
    orderBy: { checkInAt: "asc" }
  });

  for (const stay of stays) {
    const checkInShift = await getOrCreateShift(stay.checkInAt, admin?.id);
    const checkOutShift = stay.checkOutAt
      ? await getOrCreateShift(stay.checkOutAt, admin?.id)
      : null;

    await prisma.stay.update({
      where: { id: stay.id },
      data: {
        checkInShiftId: stay.checkInShiftId || checkInShift.id,
        checkOutShiftId: stay.checkOutShiftId || checkOutShift?.id,
        checkedInByUserId: stay.checkedInByUserId || admin?.id,
        checkedOutByUserId: stay.checkedOutByUserId || (stay.checkOutAt ? admin?.id : undefined),
        timingStatus: timingStatus(stay.plannedCheckOutAt, stay.checkOutAt),
        extraMinutes: extraMinutes(stay.plannedCheckOutAt, stay.checkOutAt)
      }
    });

    const hasPrimaryGuest = stay.stayGuests.some((item) => item.role === "PRIMARY");
    if (!hasPrimaryGuest) {
      await prisma.stayGuest.create({
        data: {
          stayId: stay.id,
          guestId: stay.guestId,
          role: "PRIMARY"
        }
      });
    }

    for (const charge of stay.charges) {
      await prisma.charge.update({
        where: { id: charge.id },
        data: {
          guestId: charge.guestId || stay.guestId,
          chargeType: charge.productId ? "PRODUCT" : charge.description.toLowerCase().includes("room") ? "ROOM_RATE" : "OTHER"
        }
      });
    }

    const hasInitialPayment = stay.payments.some((payment) => payment.type === "INITIAL_RATE");
    if (!hasInitialPayment) {
      const roomCharge = stay.charges.find((charge) => !charge.productId && charge.totalCents === stay.rateCents);
      await prisma.payment.create({
        data: {
          stayId: stay.id,
          shiftId: checkInShift.id,
          receivedByUserId: admin?.id,
          type: "INITIAL_RATE",
          method: roomCharge?.paymentMethod || "CASH",
          amountCents: stay.rateCents,
          paidAt: stay.checkInAt,
          notes: "Retroactive payment created from existing stay record"
        }
      });
    }
  }

  console.log(`Backfilled ${stays.length} stay records.`);
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
