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

