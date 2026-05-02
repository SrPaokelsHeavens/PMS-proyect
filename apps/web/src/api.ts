import type {
  ApiProduct,
  ApiAvailableRate,
  ApiRateConfigRoom,
  ApiRatePlan,
  ApiRoom,
  CheckOutInput,
  CheckInInput,
  CreateRatePlanInput,
  GuestHistory,
  RoomConfigInput,
  ShiftLedger,
  UpdateRatePlanInput,
  UpdateRoomConfigInput
} from "@hotel-os/shared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
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

  updateRoom: (token: string, roomId: string, input: UpdateRoomConfigInput) =>
    request<{ room: ApiRoom }>(`/rooms/${roomId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }, token),

  products: (token: string) => request<{ products: ApiProduct[] }>("/products", {}, token),

  rates: (token: string) =>
    request<{ ratePlans: ApiRatePlan[]; rooms: ApiRateConfigRoom[] }>("/rates", {}, token),

  availableRates: (token: string, roomId: string) =>
    request<{ rates: ApiAvailableRate[] }>(`/rooms/${roomId}/available-rates`, {}, token),

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
