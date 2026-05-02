import { prisma } from "./db.js";

function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function shiftName(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "2-digit",
    hour12: false
  }).format(date));

  if (hour >= 7 && hour < 15) return "MORNING";
  if (hour >= 15 && hour < 23) return "AFTERNOON";
  return "NIGHT";
}

export async function getOrCreateCurrentShift(userId?: string) {
  const currentBusinessDate = businessDate();
  const currentName = shiftName();

  const openShift = await prisma.shift.findFirst({
    where: {
      businessDate: currentBusinessDate,
      name: currentName,
      status: "OPEN"
    },
    orderBy: { openedAt: "desc" }
  });

  if (openShift) return openShift;

  return prisma.shift.create({
    data: {
      businessDate: currentBusinessDate,
      name: currentName,
      openedByUserId: userId
    }
  });
}

export function calculateTimingStatus(plannedCheckOutAt: Date | null, checkOutAt: Date | null) {
  const reference = checkOutAt ?? new Date();
  if (!plannedCheckOutAt) return checkOutAt ? "LEFT_ON_TIME" : "ON_TIME";
  if (!checkOutAt) return reference > plannedCheckOutAt ? "OVERDUE" : "ON_TIME";
  return checkOutAt > plannedCheckOutAt ? "LEFT_LATE" : "LEFT_ON_TIME";
}

export function calculateExtraMinutes(plannedCheckOutAt: Date | null, checkOutAt: Date) {
  if (!plannedCheckOutAt || checkOutAt <= plannedCheckOutAt) return 0;
  return Math.ceil((checkOutAt.getTime() - plannedCheckOutAt.getTime()) / 60000);
}
