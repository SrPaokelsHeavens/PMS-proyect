import { z } from "zod";

export const roomStatuses = ["AVAILABLE", "OCCUPIED", "CLEANING", "DISABLED"] as const;
export const computedRoomStatuses = ["AVAILABLE", "OCCUPIED", "OVERTIME", "CLEANING", "DISABLED"] as const;
export const stayStatuses = ["OPEN", "CLOSED", "CANCELLED"] as const;
export const paymentMethods = ["ROOM_ACCOUNT", "CASH", "CARD", "QR", "IZIPAY"] as const;
export const guestRoles = ["PRIMARY", "COMPANION"] as const;

export const roomStatusSchema = z.enum(roomStatuses);
export const computedRoomStatusSchema = z.enum(computedRoomStatuses);
export const stayStatusSchema = z.enum(stayStatuses);
export const paymentMethodSchema = z.enum(paymentMethods);
export const guestRoleSchema = z.enum(guestRoles);

const emptyToUndefined = (value: unknown) => value === "" ? undefined : value;

export const guestInputSchema = z.object({
  documentType: z.string().default("DNI"),
  documentNumber: z.string().trim().min(1).max(20),
  fullName: z.string().trim().min(2).max(160),
  birthDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  district: z.string().trim().max(120).optional().default(""),
  occupation: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")).default("")
});

export const checkInSchema = z.object({
  roomId: z.string().min(1),
  guest: guestInputSchema,
  companion: guestInputSchema.optional(),
  rateId: z.string().min(1).optional(),
  stayHours: z.coerce.number().int().positive().max(720).optional(),
  rateCents: z.coerce.number().int().nonnegative().optional(),
  paymentMethod: paymentMethodSchema.default("CASH"),
  notes: z.string().trim().max(2000).optional().default("")
});

export const checkOutSchema = z.object({
  waiveOvertime: z.coerce.boolean().default(false),
  overtimeWaiverReason: z.string().trim().max(600).optional().default("")
}).refine(
  (value) => !value.waiveOvertime || value.overtimeWaiverReason.length >= 3,
  "A reason is required when overtime payment is waived"
);

export const updateRoomStatusSchema = z.object({
  status: roomStatusSchema
});

export const roomConfigSchema = z.object({
  number: z.string().trim().min(1).max(20),
  floor: z.coerce.number().int().min(0).max(99),
  shortLabel: z.string().trim().min(1).max(8),
  roomTypeId: z.string().min(1).optional().or(z.literal("")).default(""),
  baseRateCents: z.coerce.number().int().nonnegative(),
  active: z.coerce.boolean().default(true),
  notes: z.string().trim().max(1000).optional().default(""),
  status: roomStatusSchema.default("AVAILABLE")
});

export const roomRangeSchema = z.object({
  from: z.coerce.number().int().min(1).max(9999),
  to: z.coerce.number().int().min(1).max(9999)
}).refine((value) => value.from <= value.to, "Room range start must be lower than or equal to range end")
  .refine((value) => value.to - value.from <= 300, "Room range cannot create more than 301 rooms at once");

export const updateRoomConfigSchema = roomConfigSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one room field is required"
);

export const addChargeSchema = z.object({
  stayId: z.string().min(1),
  productId: z.string().optional(),
  description: z.string().trim().min(1).max(180),
  quantity: z.coerce.number().int().positive().max(1000),
  unitPriceCents: z.coerce.number().int().nonnegative(),
  paymentMethod: paymentMethodSchema.default("ROOM_ACCOUNT")
});

export const loginSchema = z.object({
  username: z.string().trim().min(2).max(80),
  password: z.string().min(6).max(200)
});

export const createRatePlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  stayHours: z.coerce.number().int().positive().max(720),
  priceCents: z.coerce.number().int().nonnegative(),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  roomIds: z.array(z.string().min(1)).default([]),
  active: z.coerce.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(1000).default(0)
});

export const assignRatePlanRoomsSchema = z.object({
  roomIds: z.array(z.string().min(1)).default([])
});

export const updateRatePlanSchema = createRatePlanSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one rate plan field is required"
);

export const roomTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  features: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  active: z.coerce.boolean().default(true),
});

export const dayGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  active: z.coerce.boolean().default(true)
});

export const hourPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  hours: z.coerce.number().int().positive().max(720),
  active: z.coerce.boolean().default(true)
});

export const rateConfigSchema = z.object({
  name: z.string().trim().min(2).max(120),
  roomTypeId: z.string().min(1).optional().or(z.literal("")).default(""),
  roomId: z.string().min(1).optional().or(z.literal("")).default(""),
  dayGroupId: z.string().min(1),
  hourPlanId: z.string().min(1),
  priceCents: z.coerce.number().int().nonnegative(),
  active: z.coerce.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(1000).default(0)
}).refine(
  (value) => Boolean(value.roomTypeId) !== Boolean(value.roomId),
  "Select either a room type or an individual room"
);

export const overtimeRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  graceMinutes: z.coerce.number().int().min(0).max(720),
  extraHourCents: z.coerce.number().int().nonnegative(),
  roomTypeId: z.string().min(1).optional().or(z.literal("")).default(""),
  roomId: z.string().min(1).optional().or(z.literal("")).default(""),
  dayGroupId: z.string().min(1).optional().or(z.literal("")).default(""),
  hourPlanId: z.string().min(1).optional().or(z.literal("")).default(""),
  active: z.coerce.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(1000).default(0)
});

export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type ComputedRoomStatus = z.infer<typeof computedRoomStatusSchema>;
export type StayStatus = z.infer<typeof stayStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type GuestRole = z.infer<typeof guestRoleSchema>;
export type GuestInput = z.infer<typeof guestInputSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type AddChargeInput = z.infer<typeof addChargeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoomConfigInput = z.infer<typeof roomConfigSchema>;
export type RoomRangeInput = z.infer<typeof roomRangeSchema>;
export type UpdateRoomConfigInput = z.infer<typeof updateRoomConfigSchema>;
export type CreateRatePlanInput = z.infer<typeof createRatePlanSchema>;
export type AssignRatePlanRoomsInput = z.infer<typeof assignRatePlanRoomsSchema>;
export type UpdateRatePlanInput = z.infer<typeof updateRatePlanSchema>;
export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type DayGroupInput = z.infer<typeof dayGroupSchema>;
export type HourPlanInput = z.infer<typeof hourPlanSchema>;
export type RateConfigInput = z.infer<typeof rateConfigSchema>;
export type OvertimeRuleInput = z.infer<typeof overtimeRuleSchema>;

export type ConfigScope = "rooms" | "roomTypes" | "dayGroups" | "hourPlans" | "rates" | "overtimeRules" | "products" | "shifts";

export type DomainEvent =
  | { type: "room.created"; roomId: string }
  | { type: "room.rangeCreated"; from: number; to: number; created: number; reactivated: number; skipped: string[] }
  | { type: "room.updated"; roomId: string }
  | { type: "room.deleted"; roomId: string }
  | { type: "room.statusChanged"; roomId: string; status: RoomStatus }
  | { type: "config.changed"; scope: ConfigScope }
  | { type: "stay.checkedIn"; stayId: string; roomId: string }
  | { type: "stay.checkedOut"; stayId: string; roomId: string }
  | { type: "charge.created"; chargeId: string; stayId: string; roomId: string }
  | { type: "shift.changed"; shiftId: string };

export type ApiRoom = {
  id: string;
  number: string;
  floor: number;
  type: string;
  shortLabel: string;
  status: RoomStatus;
  computedStatus: ComputedRoomStatus;
  active: boolean;
  notes: string;
  roomTypeId: string | null;
  baseRateCents: number;
  activeRate: null | {
    id: string;
    name: string;
    stayHours: number;
    priceCents: number;
  };
  activeStay: null | {
    id: string;
    guestName: string;
    documentNumber: string;
    checkInAt: string;
    plannedCheckOutAt: string | null;
    stayHours: number;
    balanceCents: number;
    overtimeStartsAt: string | null;
    minutesRemaining: number | null;
    graceMinutes: number;
    overtimeMinutes: number;
    overtimeChargeCents: number;
    timeProgressPercent: number;
    notes: string;
  };
};

export type ApiRoomType = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  features: string[];
  roomCount: number;
};

export type ApiDayGroup = {
  id: string;
  name: string;
  daysOfWeek: number[];
  active: boolean;
};

export type ApiHourPlan = {
  id: string;
  name: string;
  hours: number;
  active: boolean;
};

export type ApiRate = {
  id: string;
  name: string;
  roomTypeId: string | null;
  roomId: string | null;
  dayGroupId: string;
  hourPlanId: string;
  priceCents: number;
  active: boolean;
  priority: number;
};

export type ApiOvertimeRule = {
  id: string;
  name: string;
  graceMinutes: number;
  extraHourCents: number;
  roomTypeId: string | null;
  roomId: string | null;
  dayGroupId: string | null;
  hourPlanId: string | null;
  active: boolean;
  priority: number;
};

export type ApiAvailableRate = {
  id: string;
  name: string;
  hours: number;
  priceCents: number;
  extraHourCents: number;
  graceMinutes: number;
  priority: number;
};

export type ApiRatePlan = {
  id: string;
  name: string;
  stayHours: number;
  priceCents: number;
  daysOfWeek: number[];
  active: boolean;
  priority: number;
  roomIds: string[];
};

export type ApiRateConfigRoom = {
  id: string;
  number: string;
  floor: number;
  type: string;
  shortLabel: string;
  status: RoomStatus;
  active: boolean;
  notes: string;
  roomTypeId: string | null;
  baseRateCents: number;
};

export type ApiProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPriceCents: number;
  stock: number;
};

export type GuestHistory = {
  guest: {
    id: string;
    documentNumber: string;
    fullName: string;
    birthDate: string | null;
    district: string;
    occupation: string;
  };
  summary: {
    totalVisits: number;
    lastVisitAt: string | null;
    favoriteRoom: string | null;
    favoriteRoomType: string | null;
    averageStayHours: number | null;
    totalConsumptionCents: number;
  };
  favoriteProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    totalCents: number;
  }>;
  favoriteRooms: Array<{
    roomNumber: string;
    roomType: string;
    visits: number;
  }>;
};

export type ShiftLedger = {
  shift: {
    id: string;
    businessDate: string;
    name: string;
    openedAt: string;
    status: string;
  };
  totals: {
    entries: number;
    cashCents: number;
    cardCents: number;
    qrCents: number;
    izipayCents: number;
    totalCents: number;
  };
  entries: Array<{
    stayId: string;
    roomNumber: string;
    status: StayStatus;
    timingStatus: string;
    checkInAt: string;
    plannedCheckOutAt: string | null;
    checkOutAt: string | null;
    stayHours: number;
    extraMinutes: number;
    rateCents: number;
    overtimeMinutes: number;
    overtimeChargeCents: number;
    overtimeWaived: boolean;
    overtimeWaiverReason: string;
    overtimeWaivedBy: string | null;
    paymentMethod: PaymentMethod;
    checkedInBy: string | null;
    checkedOutBy: string | null;
    guest: {
      fullName: string;
      documentNumber: string;
      birthDate: string | null;
      district: string;
      occupation: string;
    };
    companion: null | {
      fullName: string;
      documentNumber: string;
      birthDate: string | null;
      district: string;
      occupation: string;
    };
  }>;
};
