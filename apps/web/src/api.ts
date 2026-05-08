import type {
  ApiProduct,
  ApiAvailableRate,
  ApiDayGroup,
  ApiHourPlan,
  ApiOvertimeRule,
  ApiRateConfigRoom,
  ApiRate,
  ApiRatePlan,
  ApiRoom,
  ApiRoomType,
  CheckOutInput,
  CheckInInput,
  CreateRatePlanInput,
  DayGroupInput,
  GuestHistory,
  HourPlanInput,
  OvertimeRuleInput,
  RateConfigInput,
  RoomConfigInput,
  RoomRangeInput,
  RoomTypeInput,
  ShiftLedger,
  UpdateRatePlanInput,
  UpdateRoomConfigInput
} from "@hotel-os/shared";

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const isLocalBrowser = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
export const API_URL = configuredApiUrl && isLocalBrowser
  ? configuredApiUrl
  : `${window.location.protocol}//${window.location.hostname}:4000`;
const API_PREFIX = "/api";

export type Session = {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ConfigState = {
  roomTypes: ApiRoomType[];
  dayGroups: ApiDayGroup[];
  hourPlans: ApiHourPlan[];
  rates: ApiRate[];
  overtimeRules: ApiOvertimeRule[];
  rooms: ApiRateConfigRoom[];
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${API_PREFIX}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(error.message || "Request failed", response.status, error.code);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),

  rooms: (token: string) => request<{ rooms: ApiRoom[] }>("/rooms", {}, token),

  createRoom: (token: string, input: RoomConfigInput) =>
    request<{ room: ApiRoom }>("/rooms", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  createRoomRange: (token: string, input: RoomRangeInput) =>
    request<{ created: number; reactivated: number; skipped: string[] }>("/rooms/range", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteRoom: (token: string, roomId: string) =>
    request<{ ok: boolean; deletedRoomId: string }>(`/rooms/${roomId}`, { method: "DELETE" }, token),

  updateRoom: (token: string, roomId: string, input: UpdateRoomConfigInput) =>
    request<{ room: ApiRoom }>(`/rooms/${roomId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }, token),

  products: (token: string) => request<{ products: ApiProduct[] }>("/products", {}, token),

  config: (token: string) => request<ConfigState>("/config", {}, token),

  createRoomType: (token: string, input: RoomTypeInput) =>
    request<{ roomType: ApiRoomType }>("/config/room-types", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteRoomType: (token: string, roomTypeId: string) =>
    request<{ roomType: ApiRoomType }>(`/config/room-types/${roomTypeId}`, { method: "DELETE" }, token),

  createDayGroup: (token: string, input: DayGroupInput) =>
    request<{ dayGroup: ApiDayGroup }>("/config/day-groups", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteDayGroup: (token: string, dayGroupId: string) =>
    request<{ dayGroup: ApiDayGroup }>(`/config/day-groups/${dayGroupId}`, { method: "DELETE" }, token),

  createHourPlan: (token: string, input: HourPlanInput) =>
    request<{ hourPlan: ApiHourPlan }>("/config/hour-plans", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteHourPlan: (token: string, hourPlanId: string) =>
    request<{ hourPlan: ApiHourPlan }>(`/config/hour-plans/${hourPlanId}`, { method: "DELETE" }, token),

  createConfigRate: (token: string, input: RateConfigInput) =>
    request<{ rate: ApiRate }>("/config/rates", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteConfigRate: (token: string, rateId: string) =>
    request<{ rate: ApiRate }>(`/config/rates/${rateId}`, { method: "DELETE" }, token),

  createOvertimeRule: (token: string, input: OvertimeRuleInput) =>
    request<{ overtimeRule: ApiOvertimeRule }>("/config/overtime-rules", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  deleteOvertimeRule: (token: string, overtimeRuleId: string) =>
    request<{ overtimeRule: ApiOvertimeRule }>(`/config/overtime-rules/${overtimeRuleId}`, { method: "DELETE" }, token),

  rates: (token: string) =>
    request<{ ratePlans: ApiRatePlan[]; rooms: ApiRateConfigRoom[] }>("/rates", {}, token),

  availableRates: (token: string, roomId: string) =>
    request<{ rates: ApiAvailableRate[] }>(`/rooms/${roomId}/rates`, {}, token),

  createRate: (token: string, input: CreateRatePlanInput) =>
    request<{ ratePlan: ApiRatePlan }>("/rates", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  updateRate: (token: string, ratePlanId: string, input: UpdateRatePlanInput) =>
    request<{ ratePlan: ApiRatePlan }>(`/rates/${ratePlanId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }, token),

  guestHistory: (token: string, documentNumber: string) =>
    request<{ history: GuestHistory }>(`/guests/by-document/${encodeURIComponent(documentNumber)}/history`, {}, token),

  shiftLedger: (token: string) =>
    request<ShiftLedger>("/shifts/current/ledger", {}, token),

  checkIn: (token: string, input: CheckInInput) =>
    request<{ stayId: string }>("/stays/check-in", {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  checkOut: (token: string, stayId: string, input: CheckOutInput = { waiveOvertime: false, overtimeWaiverReason: "" }) =>
    request<{ ok: boolean }>(`/stays/${stayId}/check-out`, {
      method: "POST",
      body: JSON.stringify(input)
    }, token),

  setRoomStatus: (token: string, roomId: string, status: ApiRoom["status"]) =>
    request<{ room: ApiRoom }>(`/rooms/${roomId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }, token),

  addCharge: (token: string, input: {
    stayId: string;
    productId?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    paymentMethod: "ROOM_ACCOUNT" | "CASH" | "CARD" | "QR" | "IZIPAY";
  }) =>
    request<{ charge: unknown }>("/charges", {
      method: "POST",
      body: JSON.stringify(input)
    }, token)
};
