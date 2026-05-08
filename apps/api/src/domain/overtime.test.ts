import assert from "node:assert/strict";
import test from "node:test";
import { calculateOvertime } from "./overtime.js";

test("does not charge before grace expires", () => {
  const planned = new Date("2026-05-05T10:00:00-05:00");
  const checkout = new Date("2026-05-05T10:05:00-05:00");

  assert.deepEqual(calculateOvertime(planned, checkout, 5, 1500), {
    overtimeMinutes: 0,
    overtimeChargeCents: 0,
    billableHours: 0
  });
});

test("charges at least one extra hour after grace", () => {
  const planned = new Date("2026-05-05T10:00:00-05:00");
  const checkout = new Date("2026-05-05T10:06:00-05:00");

  assert.deepEqual(calculateOvertime(planned, checkout, 5, 1500), {
    overtimeMinutes: 1,
    overtimeChargeCents: 1500,
    billableHours: 1
  });
});

test("rounds overtime up to billable hours", () => {
  const planned = new Date("2026-05-05T10:00:00-05:00");
  const checkout = new Date("2026-05-05T12:01:00-05:00");

  assert.deepEqual(calculateOvertime(planned, checkout, 0, 1500), {
    overtimeMinutes: 121,
    overtimeChargeCents: 4500,
    billableHours: 3
  });
});

