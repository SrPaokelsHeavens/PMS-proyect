import assert from "node:assert/strict";
import test from "node:test";
import { encodeDaysOfWeek, parseDaysOfWeek, selectAvailableRates, selectOvertimeRule } from "./rates.js";

const monday = new Date("2026-05-04T12:00:00-05:00");

function configuredRate(input: {
  id: string;
  roomId?: string | null;
  roomGroupId?: string | null;
  priceCents: number;
  priority: number;
  updatedAt?: Date;
}) {
  return {
    id: input.id,
    roomId: input.roomId ?? null,
    roomGroupId: input.roomGroupId ?? null,
    priceCents: input.priceCents,
    priority: input.priority,
    active: true,
    updatedAt: input.updatedAt ?? new Date("2026-05-01T00:00:00-05:00"),
    dayGroup: { active: true, daysOfWeek: "1,2,3,4,5" },
    hourPlan: { active: true, hours: 6 }
  } as any;
}

test("encodes and parses day groups deterministically", () => {
  assert.equal(encodeDaysOfWeek([5, 1, 1, 0]), "0,1,5");
  assert.deepEqual(parseDaysOfWeek("0,1,5,x,9"), [0, 1, 5]);
});

test("individual room rates win over group rates", () => {
  const room = {
    id: "room-1",
    rates: [configuredRate({ id: "individual", roomId: "room-1", priceCents: 7000, priority: 1 })],
    roomGroup: {
      rates: [configuredRate({ id: "group", roomGroupId: "group-1", priceCents: 5000, priority: 100 })]
    }
  } as any;

  assert.equal(selectAvailableRates(room, monday)[0].id, "individual");
});

test("filters rates by active day group and hour plan", () => {
  const room = {
    id: "room-1",
    rates: [
      configuredRate({ id: "valid", roomId: "room-1", priceCents: 5000, priority: 1 }),
      { ...configuredRate({ id: "inactive-day", roomId: "room-1", priceCents: 4000, priority: 2 }), dayGroup: { active: false, daysOfWeek: "1" } },
      { ...configuredRate({ id: "inactive-hour", roomId: "room-1", priceCents: 3000, priority: 3 }), hourPlan: { active: false, hours: 6 } }
    ],
    roomGroup: null
  } as any;

  assert.deepEqual(selectAvailableRates(room, monday).map((rate) => rate.id), ["valid"]);
});

test("selects the most specific overtime rule", () => {
  const room = {
    id: "room-1",
    overtimeRules: [
      { id: "room", active: true, roomId: "room-1", roomGroupId: null, dayGroupId: null, hourPlanId: "hp-1", priority: 1, updatedAt: new Date(), dayGroup: null },
      { id: "room-day", active: true, roomId: "room-1", roomGroupId: null, dayGroupId: "dg-1", hourPlanId: "hp-1", priority: 1, updatedAt: new Date(), dayGroup: { daysOfWeek: "1", active: true } }
    ],
    roomGroup: {
      overtimeRules: [
        { id: "group", active: true, roomId: null, roomGroupId: "group-1", dayGroupId: null, hourPlanId: "hp-1", priority: 100, updatedAt: new Date(), dayGroup: null }
      ]
    }
  } as any;

  assert.equal(selectOvertimeRule(room, "hp-1", monday)?.id, "room-day");
});

