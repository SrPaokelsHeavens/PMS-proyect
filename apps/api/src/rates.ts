import type { DayGroup, HourPlan, OvertimeRule, Rate, RatePlan, RateRoom, Room } from "@prisma/client";

export type RateAssignment = RateRoom & { ratePlan: RatePlan };
export type ConfiguredRate = Rate & { dayGroup: DayGroup; hourPlan: HourPlan };
export type ConfiguredOvertimeRule = OvertimeRule & { dayGroup?: DayGroup | null };
export type RatedRoom = Room & {
  rates?: ConfiguredRate[];
  overtimeRules?: ConfiguredOvertimeRule[];
  roomGroup?: {
    rates: ConfiguredRate[];
    overtimeRules: ConfiguredOvertimeRule[];
  } | null;
};

export function limaDayOfWeek(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    weekday: "short"
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(formatted);
}

export function parseDaysOfWeek(value: string) {
  return value
    .split(",")
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function encodeDaysOfWeek(days: number[]) {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function selectCurrentRate(assignments: RateAssignment[], date = new Date()) {
  const day = limaDayOfWeek(date);
  return assignments
    .map((assignment) => assignment.ratePlan)
    .filter((ratePlan) => ratePlan.active && parseDaysOfWeek(ratePlan.daysOfWeek).includes(day))
    .sort((a, b) => b.priority - a.priority || b.updatedAt.getTime() - a.updatedAt.getTime())[0] || null;
}

export function rateAppliesToDate(rate: { dayGroup: DayGroup }, date = new Date()) {
  return parseDaysOfWeek(rate.dayGroup.daysOfWeek).includes(limaDayOfWeek(date));
}

export function overtimeRuleAppliesToDate(rule: { dayGroup?: DayGroup | null }, date = new Date()) {
  return !rule.dayGroup || parseDaysOfWeek(rule.dayGroup.daysOfWeek).includes(limaDayOfWeek(date));
}

export function selectAvailableRates(room: RatedRoom, date = new Date()) {
  const candidates = [
    ...(room.roomGroup?.rates || []),
    ...(room.rates || [])
  ];

  return candidates
    .filter((rate) => rate.active && rate.dayGroup.active && rate.hourPlan.active && rateAppliesToDate(rate, date))
    .sort((a, b) => {
      const aIndividual = a.roomId === room.id ? 1 : 0;
      const bIndividual = b.roomId === room.id ? 1 : 0;
      return bIndividual - aIndividual || b.priority - a.priority || b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

export function selectRateForRoom(room: RatedRoom, rateId: string, date = new Date()) {
  return selectAvailableRates(room, date).find((rate) => rate.id === rateId) || null;
}

export function selectOvertimeRule(room: RatedRoom, hourPlanId?: string | null, date = new Date()) {
  const candidates = [
    ...(room.roomGroup?.overtimeRules || []),
    ...(room.overtimeRules || [])
  ];

  return candidates
    .filter((rule) => rule.active)
    .filter((rule) => !rule.hourPlanId || rule.hourPlanId === hourPlanId)
    .filter((rule) => overtimeRuleAppliesToDate(rule, date))
    .sort((a, b) => {
      const aIndividual = a.roomId === room.id ? 1 : 0;
      const bIndividual = b.roomId === room.id ? 1 : 0;
      const aSpecificity = aIndividual + (a.roomGroupId ? 1 : 0) + (a.dayGroupId ? 1 : 0) + (a.hourPlanId ? 1 : 0);
      const bSpecificity = bIndividual + (b.roomGroupId ? 1 : 0) + (b.dayGroupId ? 1 : 0) + (b.hourPlanId ? 1 : 0);
      return bSpecificity - aSpecificity || b.priority - a.priority || b.updatedAt.getTime() - a.updatedAt.getTime();
    })[0] || null;
}

export function calculateOvertime(plannedCheckOutAt: Date | null, checkOutAt: Date, graceMinutes: number, extraHourCents: number) {
  if (!plannedCheckOutAt) {
    return { overtimeMinutes: 0, overtimeChargeCents: 0, billableHours: 0 };
  }

  const graceEnd = plannedCheckOutAt.getTime() + graceMinutes * 60_000;
  const overtimeMs = checkOutAt.getTime() - graceEnd;
  if (overtimeMs <= 0) {
    return { overtimeMinutes: 0, overtimeChargeCents: 0, billableHours: 0 };
  }

  const overtimeMinutes = Math.ceil(overtimeMs / 60_000);
  const billableHours = Math.max(1, Math.ceil(overtimeMinutes / 60));
  return {
    overtimeMinutes,
    billableHours,
    overtimeChargeCents: billableHours * extraHourCents
  };
}
