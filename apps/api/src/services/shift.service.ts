import type { PaymentMethod, ShiftLedger } from "@hotel-os/shared";
import { prisma } from "../db.js";
import { getOrCreateCurrentShift } from "../shift.js";

const paymentMethods = ["CASH", "CARD", "QR", "IZIPAY"] as const;

export async function getCurrentShiftLedger(userId?: string): Promise<ShiftLedger> {
  const shift = await getOrCreateCurrentShift(userId);
  const stays = await prisma.stay.findMany({
    where: {
      OR: [
        { checkInShiftId: shift.id },
        { checkOutShiftId: shift.id }
      ]
    },
    orderBy: { checkInAt: "asc" },
    include: {
      room: true,
      guest: true,
      checkedInBy: true,
      checkedOutBy: true,
      overtimeWaivedBy: true,
      stayGuests: {
        include: { guest: true }
      },
      charges: true,
      payments: true
    }
  });

  const payments = await prisma.payment.findMany({ where: { shiftId: shift.id } });
  const totalsByMethod = new Map<PaymentMethod, number>();
  for (const method of paymentMethods) totalsByMethod.set(method, 0);
  for (const payment of payments) {
    if (!paymentMethods.includes(payment.method as typeof paymentMethods[number])) continue;
    const method = payment.method as PaymentMethod;
    totalsByMethod.set(method, (totalsByMethod.get(method) || 0) + payment.amountCents);
  }

  const entries: ShiftLedger["entries"] = stays.map((stay) => {
    const primary = stay.stayGuests.find((item) => item.role === "PRIMARY")?.guest || stay.guest;
    const companion = stay.stayGuests.find((item) => item.role === "COMPANION")?.guest || null;
    const roomCharge = stay.charges.find((charge) => charge.chargeType === "ROOM_RATE");

    return {
      stayId: stay.id,
      roomNumber: stay.room.number,
      status: stay.status as ShiftLedger["entries"][number]["status"],
      timingStatus: stay.timingStatus,
      checkInAt: stay.checkInAt.toISOString(),
      plannedCheckOutAt: stay.plannedCheckOutAt?.toISOString() || null,
      checkOutAt: stay.checkOutAt?.toISOString() || null,
      stayHours: stay.stayHours,
      extraMinutes: stay.extraMinutes,
      rateCents: stay.rateCents,
      overtimeMinutes: stay.overtimeMinutes,
      overtimeChargeCents: stay.overtimeChargeCents,
      overtimeWaived: Boolean(stay.overtimeWaivedAt),
      overtimeWaiverReason: stay.overtimeWaiverReason,
      overtimeWaivedBy: stay.overtimeWaivedBy?.username || null,
      paymentMethod: (roomCharge?.paymentMethod || "CASH") as ShiftLedger["entries"][number]["paymentMethod"],
      checkedInBy: stay.checkedInBy?.username || null,
      checkedOutBy: stay.checkedOutBy?.username || null,
      guest: {
        fullName: primary.fullName,
        documentNumber: primary.documentNumber,
        birthDate: primary.birthDate?.toISOString() || null,
        district: primary.district,
        occupation: primary.occupation
      },
      companion: companion
        ? {
            fullName: companion.fullName,
            documentNumber: companion.documentNumber,
            birthDate: companion.birthDate?.toISOString() || null,
            district: companion.district,
            occupation: companion.occupation
          }
        : null
    };
  });

  return {
    shift: {
      id: shift.id,
      businessDate: shift.businessDate,
      name: shift.name,
      openedAt: shift.openedAt.toISOString(),
      status: shift.status
    },
    totals: {
      entries: entries.length,
      cashCents: totalsByMethod.get("CASH") || 0,
      cardCents: totalsByMethod.get("CARD") || 0,
      qrCents: totalsByMethod.get("QR") || 0,
      izipayCents: totalsByMethod.get("IZIPAY") || 0,
      totalCents: payments.reduce((total, payment) => total + payment.amountCents, 0)
    },
    entries
  };
}

