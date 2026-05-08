import type { Room, Stay, Guest, Charge, Payment, RoomType } from "@prisma/client";
import type { ApiRoom } from "@hotel-os/shared";
import { selectCurrentRate, type RateAssignment } from "./rates.js";

type StayWithGuestAndCharges = Stay & {
  guest: Guest;
  charges: Charge[];
  payments: Payment[];
};

export function toApiRoom(room: Room & { roomType?: RoomType | null; stays: StayWithGuestAndCharges[]; ratePlans?: RateAssignment[] }): ApiRoom {
  const activeStay = room.stays.find((stay) => stay.status === "OPEN");
  const activeRate = selectCurrentRate(room.ratePlans || []);
  const now = new Date();
  const plannedCheckOutAt = activeStay?.plannedCheckOutAt || null;
  const overtimeStartsAt = plannedCheckOutAt
    ? new Date(plannedCheckOutAt.getTime() + (activeStay?.overtimeGraceMinutes || 0) * 60_000)
    : null;
  const rawMinutesRemaining = plannedCheckOutAt
    ? Math.ceil((plannedCheckOutAt.getTime() - now.getTime()) / 60_000)
    : null;
  const overtimeMinutes = activeStay && overtimeStartsAt && now > overtimeStartsAt
    ? Math.ceil((now.getTime() - overtimeStartsAt.getTime()) / 60_000)
    : 0;
  const computedStatus = activeStay && overtimeMinutes > 0
    ? "OVERTIME"
    : room.status;
  const totalStayMinutes = activeStay ? Math.max(1, activeStay.stayHours * 60) : 1;
  const elapsedMinutes = activeStay ? Math.max(0, Math.ceil((now.getTime() - activeStay.checkInAt.getTime()) / 60_000)) : 0;
  const timeProgressPercent = activeStay
    ? Math.max(0, Math.min(100, Math.round(((totalStayMinutes - elapsedMinutes) / totalStayMinutes) * 100)))
    : 0;
  const balanceCents = activeStay
    ? activeStay.charges.reduce((total, charge) => total + charge.totalCents, 0)
      - activeStay.payments.reduce((total, payment) => total + payment.amountCents, 0)
    : 0;

  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    type: room.roomType?.name || "Sin tipo",
    shortLabel: room.shortLabel,
    status: room.status as ApiRoom["status"],
    computedStatus: computedStatus as ApiRoom["computedStatus"],
    active: room.active,
    notes: room.notes,
    roomTypeId: room.roomTypeId,
    baseRateCents: room.baseRateCents,
    activeRate: activeRate
      ? {
          id: activeRate.id,
          name: activeRate.name,
          stayHours: activeRate.stayHours,
          priceCents: activeRate.priceCents
        }
      : null,
    activeStay: activeStay
      ? {
          id: activeStay.id,
          guestName: activeStay.guest.fullName,
          documentNumber: activeStay.guest.documentNumber,
          checkInAt: activeStay.checkInAt.toISOString(),
          plannedCheckOutAt: plannedCheckOutAt?.toISOString() || null,
          stayHours: activeStay.stayHours,
          balanceCents,
          overtimeStartsAt: overtimeStartsAt?.toISOString() || null,
          minutesRemaining: rawMinutesRemaining,
          graceMinutes: activeStay.overtimeGraceMinutes,
          overtimeMinutes,
          overtimeChargeCents: activeStay.overtimeChargeCents,
          timeProgressPercent,
          notes: activeStay.notes
        }
      : null
  };
}
