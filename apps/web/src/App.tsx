import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, LogOut, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { ApiAvailableRate, ApiDayGroup, ApiHourPlan, ApiOvertimeRule, ApiProduct, ApiRate, ApiRateConfigRoom, ApiRoom, ApiRoomType, ComputedRoomStatus, GuestHistory, PaymentMethod, RoomStatus, ShiftLedger } from "@hotel-os/shared";
import { ApiError, api, type ConfigState, type Session } from "./api.js";
import { queryKeys } from "./queryClient.js";
import { useRealtimeSync } from "./realtime.js";

function soles(cents: number) {
  return `S/ ${(cents / 100).toFixed(2).replace(".00", "")}`;
}

function statusLabel(status: ComputedRoomStatus) {
  return {
    AVAILABLE: "Available",
    OCCUPIED: "In use",
    OVERTIME: "Sobre tiempo",
    CLEANING: "Cleaning",
    DISABLED: "Disabled"
  }[status];
}

function statusClass(status: ComputedRoomStatus) {
  return status.toLowerCase();
}

function localDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("hotel-os-session");
    return saved ? JSON.parse(saved) as Session : null;
  });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reception" | "shift-ledger" | "sales" | "inventory" | "reports" | "rates">("reception");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  useRealtimeSync(session);

  const roomsQuery = useQuery({
    queryKey: queryKeys.rooms,
    queryFn: () => api.rooms(session!.token),
    enabled: Boolean(session)
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => api.products(session!.token),
    enabled: Boolean(session)
  });
  const rooms = roomsQuery.data?.rooms ?? [];
  const products = productsQuery.data?.products ?? [];
  const loading = roomsQuery.isFetching || productsQuery.isFetching;

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId),
    [rooms, activeRoomId]
  );

  const roomFloors = useMemo(() => {
    const groupedRooms = new Map<number, ApiRoom[]>();

    for (const room of rooms) {
      const floorRooms = groupedRooms.get(room.floor) ?? [];
      floorRooms.push(room);
      groupedRooms.set(room.floor, floorRooms);
    }

    return Array.from(groupedRooms.entries())
      .sort(([leftFloor], [rightFloor]) => leftFloor - rightFloor)
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms.sort((leftRoom, rightRoom) => leftRoom.number.localeCompare(rightRoom.number, "es", { numeric: true }))
      }));
  }, [rooms]);

  async function refresh() {
    if (!session) return;
    setError("");
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        queryClient.invalidateQueries({ queryKey: queryKeys.config }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shiftLedger })
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession();
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load data");
    }
  }

  useEffect(() => {
    const queryError = roomsQuery.error || productsQuery.error;
    if (!queryError) return;
    handleAppError(queryError);
  }, [roomsQuery.error, productsQuery.error]);

  useEffect(() => {
    if (!error) return;
    const handle = window.setTimeout(() => setError(""), 3500);
    return () => window.clearTimeout(handle);
  }, [error]);

  function saveSession(next: Session) {
    localStorage.setItem("hotel-os-session", JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    localStorage.removeItem("hotel-os-session");
    setSession(null);
    queryClient.clear();
    setActiveRoomId(null);
  }

  function expireSession() {
    localStorage.removeItem("hotel-os-session");
    setSession(null);
    queryClient.clear();
    setActiveRoomId(null);
    setError("");
  }

  function handleAppError(err: unknown) {
    if (!err) {
      setError("");
      return;
    }

    if (err instanceof ApiError && err.status === 401) {
      expireSession();
      return;
    }

    setError(err instanceof Error ? err.message : "Action failed");
  }

  if (!session) {
    return <LoginScreen onLogin={saveSession} />;
  }

  return (
    <div className="app">
      <header className="nav">
        <div className="brand notranslate" translate="no" lang="en">
          <BedDouble size={21} /> <span>KENTY PMS</span>
        </div>
        <nav className="nav-tabs">
          <button className={activeTab === "reception" ? "active" : ""} type="button" onClick={() => setActiveTab("reception")}>Reception</button>
          <button className={activeTab === "shift-ledger" ? "active" : ""} type="button" onClick={() => setActiveTab("shift-ledger")}>Shift Log</button>
          <button className={activeTab === "sales" ? "active" : ""} type="button" onClick={() => setActiveTab("sales")}>Sales</button>
          <button className={activeTab === "inventory" ? "active" : ""} type="button" onClick={() => setActiveTab("inventory")}>Inventory</button>
          <button className={activeTab === "reports" ? "active" : ""} type="button" onClick={() => setActiveTab("reports")}>Reports</button>
          <button className={activeTab === "rates" ? "active" : ""} type="button" onClick={() => setActiveTab("rates")}>Configuracion</button>
        </nav>
        <button className="icon-button" type="button" onClick={refresh} title="Refresh">
          <RefreshCw size={18} />
        </button>
        <button className="icon-button" type="button" onClick={logout} title="Log out">
          <LogOut size={18} />
        </button>
      </header>

      <main className="card-dashboard">
        {error && <div className="toast">{error}</div>}
        {activeTab === "reception" ? (
          <div className="floor-stack" aria-busy={loading}>
            {roomFloors.map(({ floor, rooms: floorRooms }) => (
              <section className="floor-section" key={floor} aria-label={`Piso ${floor}`}>
                <div className="floor-label">
                  <strong>Piso {floor}</strong>
                  <span>{floorRooms.length} hab.</span>
                </div>
                <div className="room-grid floor-room-grid">
                  {floorRooms.map((room) => (
                    <button
                      className={`room-card ${statusClass(room.computedStatus)}`}
                      key={room.id}
                      type="button"
                      onClick={() => setActiveRoomId(room.id)}
                    >
                      <span className="room-number">{room.number}</span>
                      <span className="room-type">{room.shortLabel}</span>
                      <span className="guest-name">{room.activeStay?.guestName || ""}</span>
                      {room.activeStay && (
                        <span className="time-track" title="Tiempo restante">
                          <span style={{ width: `${room.activeStay.timeProgressPercent}%` }} />
                        </span>
                      )}
                      <span className="room-footer">
                        <strong>{statusLabel(room.computedStatus)}</strong>
                        <small>{room.activeStay ? soles(room.activeStay.balanceCents) : ""}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : activeTab === "shift-ledger" ? (
          <ShiftLedgerView token={session.token} onError={handleAppError} />
        ) : activeTab === "rates" ? (
          <RateSettingsView token={session.token} onError={handleAppError} onRoomsChanged={refresh} />
        ) : (
          <EmptyTab title="Module in progress" />
        )}
      </main>

      {activeRoom && (
        <RoomModal
          room={activeRoom}
          products={products}
          token={session.token}
          onClose={() => setActiveRoomId(null)}
          onChanged={refresh}
          onError={handleAppError}
        />
      )}
    </div>
  );
}

function EmptyTab({ title }: { title: string }) {
  return (
    <section className="module-shell">
      <h1>{title}</h1>
    </section>
  );
}

const dayOptions = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

const emptyConfig: ConfigState = {
  roomTypes: [],
  dayGroups: [],
  hourPlans: [],
  rates: [],
  overtimeRules: [],
  rooms: []
};

type ConfigModalKind = "room" | "roomType" | "dayGroup" | "hourPlan" | "rate" | "overtime";

function dayText(days: number[]) {
  const labels = new Map(dayOptions.map((day) => [day.value, day.label]));
  return days.map((day) => labels.get(day) || String(day)).join(", ");
}

function RateSettingsView({ token, onError, onRoomsChanged }: { token: string; onError: (error: unknown) => void; onRoomsChanged: () => Promise<void> }) {
  const [modal, setModal] = useState<ConfigModalKind | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: queryKeys.config,
    queryFn: () => api.config(token)
  });
  const config = configQuery.data ?? emptyConfig;
  const loading = configQuery.isFetching;
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedRoomTypeIds, setSelectedRoomTypeIds] = useState<string[]>([]);
  const [selectedHourPlanIds, setSelectedHourPlanIds] = useState<string[]>([]);
  const [selectedDayGroupIds, setSelectedDayGroupIds] = useState<string[]>([]);
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [selectedOvertimeRuleIds, setSelectedOvertimeRuleIds] = useState<string[]>([]);

  const [roomRangeForm, setRoomRangeForm] = useState({ from: "", to: "" });
  const [roomTypeForm, setRoomTypeForm] = useState({ name: "", description: "", features: [""] });
  const [dayGroupForm, setDayGroupForm] = useState({ name: "", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const [hourPlanForm, setHourPlanForm] = useState({ name: "", hours: 1 });
  const [rateForm, setRateForm] = useState({
    name: "",
    targetType: "type" as "type" | "room",
    roomTypeId: "",
    roomId: "",
    dayGroupId: "",
    hourPlanId: "",
    priceSoles: 0,
    priority: 10,
    active: true
  });
  const [overtimeForm, setOvertimeForm] = useState({
    name: "",
    roomTypeId: "",
    roomId: "",
    dayGroupId: "",
    hourPlanId: "",
    graceMinutes: 5,
    extraHourSoles: 0,
    priority: 10,
    active: true
  });

  const rooms = config.rooms;
  const statusCounts: Record<RoomStatus, number> = useMemo(() => rooms.reduce<Record<RoomStatus, number>>((totals, room) => {
    totals[room.status] += 1;
    return totals;
  }, { AVAILABLE: 0, OCCUPIED: 0, CLEANING: 0, DISABLED: 0 }), [rooms]);

  const roomsByType = useMemo(() => {
    const grouped = new Map<string, ApiRateConfigRoom[]>();
    for (const room of rooms) {
      const key = room.roomTypeId || "untyped";
      grouped.set(key, [...(grouped.get(key) || []), room]);
    }
    return grouped;
  }, [rooms]);

  const roomsByFloor = useMemo(() => {
    const grouped = new Map<number, ApiRateConfigRoom[]>();
    for (const room of rooms) {
      grouped.set(room.floor, [...(grouped.get(room.floor) || []), room]);
    }
    return Array.from(grouped.entries())
      .sort(([leftFloor], [rightFloor]) => leftFloor - rightFloor)
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms.sort((leftRoom, rightRoom) => leftRoom.number.localeCompare(rightRoom.number, "es", { numeric: true }))
      }));
  }, [rooms]);

  async function loadConfig() {
    onError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.config });
    } catch (err) {
      onError(err);
    }
  }

  useEffect(() => {
    if (configQuery.error) onError(configQuery.error);
  }, [configQuery.error, onError]);

  function toggleDay(day: number, target: "dayGroup") {
    if (target === "dayGroup") setDayGroupForm((current) => {
      const daysOfWeek = current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day];
      return { ...current, daysOfWeek };
    });
  }

  function openModal(kind: ConfigModalKind) {
    if (kind === "room") setRoomRangeForm({ from: "", to: "" });
    if (kind === "roomType") setRoomTypeForm({ name: "", description: "", features: [""] });
    if (kind === "dayGroup") setDayGroupForm({ name: "", daysOfWeek: [1, 2, 3, 4, 5] });
    if (kind === "hourPlan") setHourPlanForm({ name: "", hours: 1 });
    if (kind === "rate") setRateForm({
      name: "",
      targetType: config.roomTypes[0] ? "type" : "room",
      roomTypeId: config.roomTypes[0]?.id || "",
      roomId: config.rooms[0]?.id || "",
      dayGroupId: config.dayGroups[0]?.id || "",
      hourPlanId: config.hourPlans[0]?.id || "",
      priceSoles: 0,
      priority: 10,
      active: true
    });
    if (kind === "overtime") setOvertimeForm({
      name: "",
      roomTypeId: "",
      roomId: "",
      dayGroupId: "",
      hourPlanId: "",
      graceMinutes: 5,
      extraHourSoles: 0,
      priority: 10,
      active: true
    });
    setModal(kind);
  }

  async function submitModal(event: FormEvent) {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    onError(null);
    try {
      if (modal === "room") {
        await api.createRoomRange(token, {
          from: Number(roomRangeForm.from),
          to: Number(roomRangeForm.to)
        });
      }
      if (modal === "roomType") await api.createRoomType(token, {
        name: roomTypeForm.name,
        description: roomTypeForm.description,
        features: roomTypeForm.features.map((feature) => feature.trim()).filter(Boolean),
        active: true
      });
      if (modal === "dayGroup") await api.createDayGroup(token, { name: dayGroupForm.name, daysOfWeek: dayGroupForm.daysOfWeek, active: true });
      if (modal === "hourPlan") await api.createHourPlan(token, { name: hourPlanForm.name, hours: hourPlanForm.hours, active: true });
      if (modal === "rate") {
        await api.createConfigRate(token, {
          name: rateForm.name,
          roomTypeId: rateForm.targetType === "type" ? rateForm.roomTypeId : "",
          roomId: rateForm.targetType === "room" ? rateForm.roomId : "",
          dayGroupId: rateForm.dayGroupId,
          hourPlanId: rateForm.hourPlanId,
          priceCents: Math.round(rateForm.priceSoles * 100),
          active: rateForm.active,
          priority: rateForm.priority
        });
      }
      if (modal === "overtime") {
        await api.createOvertimeRule(token, {
          name: overtimeForm.name,
          roomTypeId: overtimeForm.roomTypeId,
          roomId: overtimeForm.roomId,
          dayGroupId: overtimeForm.dayGroupId,
          hourPlanId: overtimeForm.hourPlanId,
          graceMinutes: overtimeForm.graceMinutes,
          extraHourCents: Math.round(overtimeForm.extraHourSoles * 100),
          active: overtimeForm.active,
          priority: overtimeForm.priority
        });
      }
      setModal(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.config });
      await onRoomsChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedRooms() {
    if (selectedRoomIds.length === 0) return;
    setSaving(true);
    onError(null);
    try {
      await Promise.all(selectedRoomIds.map((roomId) => api.deleteRoom(token, roomId)));
      setSelectedRoomIds([]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.config });
      await onRoomsChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSelectedRoom(roomId: string) {
    setSelectedRoomIds((current) => current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId]);
  }

  async function deleteSelectedRoomTypes() {
    await deleteSelected(selectedRoomTypeIds, (id) => api.deleteRoomType(token, id), setSelectedRoomTypeIds);
  }

  async function deleteSelectedHourPlans() {
    await deleteSelected(selectedHourPlanIds, (id) => api.deleteHourPlan(token, id), setSelectedHourPlanIds);
  }

  async function deleteSelectedDayGroups() {
    await deleteSelected(selectedDayGroupIds, (id) => api.deleteDayGroup(token, id), setSelectedDayGroupIds);
  }

  async function deleteSelectedRates() {
    await deleteSelected(selectedRateIds, (id) => api.deleteConfigRate(token, id), setSelectedRateIds);
  }

  async function deleteSelectedOvertimeRules() {
    await deleteSelected(selectedOvertimeRuleIds, (id) => api.deleteOvertimeRule(token, id), setSelectedOvertimeRuleIds);
  }

  async function deleteSelected(ids: string[], remove: (id: string) => Promise<unknown>, clear: (ids: string[]) => void) {
    if (ids.length === 0) return;
    setSaving(true);
    onError(null);
    try {
      await Promise.all(ids.map(remove));
      clear([]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.config });
      await onRoomsChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string, setter: (updater: (current: string[]) => string[]) => void) {
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="settings-view" aria-busy={loading}>
      <header className="ledger-head">
        <div>
          <h1>Configuracion hotelera</h1>
          <p>Capas configurables para habitaciones, tipos, dias, horas, tarifas y sobretiempo.</p>
        </div>
        <button type="button" onClick={loadConfig} disabled={loading}>{loading ? "Cargando..." : "Actualizar"}</button>
      </header>

      <div className="settings-summary">
        <span><strong>{rooms.length}</strong> Habitaciones</span>
        <span><strong>{statusCounts.AVAILABLE}</strong> Disponibles</span>
        <span><strong>{statusCounts.OCCUPIED}</strong> Ocupadas</span>
        <span><strong>{statusCounts.CLEANING}</strong> Limpieza</span>
        <span><strong>{statusCounts.DISABLED}</strong> Inhabilitado</span>
      </div>

      <div className="config-board">
        <ConfigSection
          title="Habitaciones"
          primaryAction="Nuevo rango de habitaciones"
          secondaryAction={selectedRoomIds.length ? `Eliminar ${selectedRoomIds.length}` : "Eliminar habitaciones"}
          onPrimary={() => openModal("room")}
          onSecondary={deleteSelectedRooms}
          secondaryDisabled={selectedRoomIds.length === 0 || saving}
        >
          <div className="config-floor-stack">
            {roomsByFloor.map(({ floor, rooms: floorRooms }) => (
              <div className="config-floor-row" key={floor}>
                <strong>{floor}00</strong>
                <div className="config-room-strip">
                  {floorRooms.map((room) => (
                    <button
                      className={`config-room-chip ${room.status.toLowerCase()} ${selectedRoomIds.includes(room.id) ? "selected" : ""}`}
                      key={room.id}
                      type="button"
                      onClick={() => toggleSelectedRoom(room.id)}
                    >
                      {room.number}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection
          title="Tipos de habitaciones"
          primaryAction="Nuevo tipo de habitaciones"
          secondaryAction={selectedRoomTypeIds.length ? `Eliminar ${selectedRoomTypeIds.length}` : "Eliminar tipos"}
          onPrimary={() => openModal("roomType")}
          onSecondary={deleteSelectedRoomTypes}
          secondaryDisabled={selectedRoomTypeIds.length === 0 || saving}
        >
          <div className="config-group-grid">
            {config.roomTypes.map((type) => (
              <button
                className={`config-group-card ${selectedRoomTypeIds.includes(type.id) ? "selected" : ""}`}
                key={type.id}
                type="button"
                onClick={() => toggleSelected(type.id, setSelectedRoomTypeIds)}
              >
                <strong>{type.name}</strong>
                <small>{type.description || "Sin descripcion"}</small>
                <div>{type.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
                <div>{(roomsByType.get(type.id) || []).map((room) => <span key={room.id}>{room.number}</span>)}</div>
              </button>
            ))}
            {(roomsByType.get("untyped") || []).length > 0 && (
              <div className="config-group-card passive">
                <strong>Sin tipo</strong>
                <div>{(roomsByType.get("untyped") || []).map((room) => <span key={room.id}>{room.number}</span>)}</div>
              </div>
            )}
          </div>
        </ConfigSection>

        <ConfigSection
          title="Grupo de horas"
          primaryAction="Nuevo grupo de horas"
          secondaryAction={selectedHourPlanIds.length ? `Eliminar ${selectedHourPlanIds.length}` : "Eliminar horas"}
          onPrimary={() => openModal("hourPlan")}
          onSecondary={deleteSelectedHourPlans}
          secondaryDisabled={selectedHourPlanIds.length === 0 || saving}
        >
          <div className="config-token-grid">
            {config.hourPlans.map((plan) => (
              <button className={selectedHourPlanIds.includes(plan.id) ? "selected" : ""} key={plan.id} type="button" onClick={() => toggleSelected(plan.id, setSelectedHourPlanIds)}>
                <strong>{plan.name}</strong><span>{plan.hours} h</span>
              </button>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection
          title="Grupos de dias"
          primaryAction="Nuevo grupo de dias"
          secondaryAction={selectedDayGroupIds.length ? `Eliminar ${selectedDayGroupIds.length}` : "Eliminar grupo de dias"}
          onPrimary={() => openModal("dayGroup")}
          onSecondary={deleteSelectedDayGroups}
          secondaryDisabled={selectedDayGroupIds.length === 0 || saving}
        >
          <div className="config-token-grid">
            {config.dayGroups.map((group) => (
              <button className={selectedDayGroupIds.includes(group.id) ? "selected" : ""} key={group.id} type="button" onClick={() => toggleSelected(group.id, setSelectedDayGroupIds)}>
                <strong>{group.name}</strong><span>{dayText(group.daysOfWeek)}</span>
              </button>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection title="Cajeras" primaryAction="Nueva/o cajera/o" secondaryAction="Eliminar cajera/o">
          <div className="config-token-grid" />
        </ConfigSection>

        <ConfigSection
          title="Tarifas"
          primaryAction="Nueva tarifa"
          secondaryAction={selectedRateIds.length ? `Eliminar ${selectedRateIds.length}` : "Eliminar tarifa"}
          onPrimary={() => openModal("rate")}
          onSecondary={deleteSelectedRates}
          secondaryDisabled={selectedRateIds.length === 0 || saving}
        >
          <div className="config-rate-grid">
            {config.rates.map((rate) => (
              <RateCard
                key={rate.id}
                rate={rate}
                config={config}
                selected={selectedRateIds.includes(rate.id)}
                onClick={() => toggleSelected(rate.id, setSelectedRateIds)}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection title="Personal de limpieza" primaryAction="Nueva/o personal" secondaryAction="Eliminar personal">
          <div className="config-token-grid" />
        </ConfigSection>

        <ConfigSection
          title="Reglas de sobretiempo"
          primaryAction="Nueva regla"
          secondaryAction={selectedOvertimeRuleIds.length ? `Eliminar ${selectedOvertimeRuleIds.length}` : "Eliminar regla"}
          onPrimary={() => openModal("overtime")}
          onSecondary={deleteSelectedOvertimeRules}
          secondaryDisabled={selectedOvertimeRuleIds.length === 0 || saving}
        >
          <div className="config-token-grid">
            {config.overtimeRules.map((rule) => (
              <button className={selectedOvertimeRuleIds.includes(rule.id) ? "selected" : ""} key={rule.id} type="button" onClick={() => toggleSelected(rule.id, setSelectedOvertimeRuleIds)}>
                <strong>{rule.name}</strong><span>{rule.graceMinutes} min - {soles(rule.extraHourCents)}</span>
              </button>
            ))}
          </div>
        </ConfigSection>
      </div>

      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="config-modal" onSubmit={submitModal} onMouseDown={(event) => event.stopPropagation()}>
            <header className="modal-head">
              <h1>{modal === "room" ? "Nuevo rango de habitaciones" : modal === "roomType" ? "Nuevo tipo de habitaciones" : modal === "dayGroup" ? "Nuevo grupo de dias" : modal === "hourPlan" ? "Nuevo grupo de horas" : modal === "rate" ? "Nueva tarifa" : "Nueva regla de sobretiempo"}</h1>
              <button className="icon-button light" type="button" onClick={() => setModal(null)} title="Close"><X size={18} /></button>
            </header>
            <div className="config-modal-body">
              {modal === "room" && (
                <div className="form-grid two">
                  <label>Desde<input type="number" min={1} value={roomRangeForm.from} onChange={(event) => setRoomRangeForm({ ...roomRangeForm, from: event.target.value })} /></label>
                  <label>Hasta<input type="number" min={1} value={roomRangeForm.to} onChange={(event) => setRoomRangeForm({ ...roomRangeForm, to: event.target.value })} /></label>
                </div>
              )}
              {modal === "roomType" && (
                <div className="form-grid">
                  <label>Nombre<input value={roomTypeForm.name} onChange={(event) => setRoomTypeForm({ ...roomTypeForm, name: event.target.value })} /></label>
                  <label>Descripcion<textarea value={roomTypeForm.description} onChange={(event) => setRoomTypeForm({ ...roomTypeForm, description: event.target.value })} /></label>
                  <div className="feature-editor">
                    <div className="feature-editor-head">
                      <strong>Caracteristicas</strong>
                      <button type="button" onClick={() => setRoomTypeForm((current) => ({ ...current, features: [...current.features, ""] }))}>+</button>
                    </div>
                    {roomTypeForm.features.map((feature, index) => (
                      <div className="feature-row" key={index}>
                        <input
                          value={feature}
                          placeholder="Sauna, TV, Netflix..."
                          onChange={(event) => setRoomTypeForm((current) => ({
                            ...current,
                            features: current.features.map((item, itemIndex) => itemIndex === index ? event.target.value : item)
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => setRoomTypeForm((current) => ({
                            ...current,
                            features: current.features.length === 1 ? [""] : current.features.filter((_, itemIndex) => itemIndex !== index)
                          }))}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {modal === "dayGroup" && <div className="form-grid"><label>Nombre<input value={dayGroupForm.name} onChange={(event) => setDayGroupForm({ ...dayGroupForm, name: event.target.value })} /></label><div className="segmented-row">{dayOptions.map((day) => <button className={dayGroupForm.daysOfWeek.includes(day.value) ? "active" : ""} key={day.value} type="button" onClick={() => toggleDay(day.value, "dayGroup")}>{day.label}</button>)}</div></div>}
              {modal === "hourPlan" && <div className="form-grid two"><label>Nombre<input value={hourPlanForm.name} onChange={(event) => setHourPlanForm({ ...hourPlanForm, name: event.target.value })} /></label><label>Horas<input type="number" min={1} value={hourPlanForm.hours} onChange={(event) => setHourPlanForm({ ...hourPlanForm, hours: Number(event.target.value) })} /></label></div>}
              {modal === "rate" && (
                <div className="form-grid two">
                  <label>Nombre<input value={rateForm.name} onChange={(event) => setRateForm({ ...rateForm, name: event.target.value })} /></label>
                  <label>Aplicar a<select value={rateForm.targetType} onChange={(event) => setRateForm({ ...rateForm, targetType: event.target.value as "type" | "room" })}><option value="type">Tipo de habitacion</option><option value="room">Habitacion individual</option></select></label>
                  {rateForm.targetType === "type" ? <label>Tipo<select value={rateForm.roomTypeId} onChange={(event) => setRateForm({ ...rateForm, roomTypeId: event.target.value })}>{config.roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label> : <label>Habitacion<select value={rateForm.roomId} onChange={(event) => setRateForm({ ...rateForm, roomId: event.target.value })}>{rooms.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}</select></label>}
                  <label>Dias<select value={rateForm.dayGroupId} onChange={(event) => setRateForm({ ...rateForm, dayGroupId: event.target.value })}>{config.dayGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                  <label>Horas<select value={rateForm.hourPlanId} onChange={(event) => setRateForm({ ...rateForm, hourPlanId: event.target.value })}>{config.hourPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
                  <label>Precio S/<input type="number" min={0} step="0.5" value={rateForm.priceSoles} onChange={(event) => setRateForm({ ...rateForm, priceSoles: Number(event.target.value) })} /></label>
                  <label>Prioridad<input type="number" min={0} value={rateForm.priority} onChange={(event) => setRateForm({ ...rateForm, priority: Number(event.target.value) })} /></label>
                </div>
              )}
              {modal === "overtime" && (
                <div className="form-grid two">
                  <label>Nombre<input value={overtimeForm.name} onChange={(event) => setOvertimeForm({ ...overtimeForm, name: event.target.value })} /></label>
                  <label>Minutos de gracia<input type="number" min={0} value={overtimeForm.graceMinutes} onChange={(event) => setOvertimeForm({ ...overtimeForm, graceMinutes: Number(event.target.value) })} /></label>
                  <label>Hora extra S/<input type="number" min={0} step="0.5" value={overtimeForm.extraHourSoles} onChange={(event) => setOvertimeForm({ ...overtimeForm, extraHourSoles: Number(event.target.value) })} /></label>
                  <label>Tipo<select value={overtimeForm.roomTypeId} onChange={(event) => setOvertimeForm({ ...overtimeForm, roomTypeId: event.target.value })}><option value="">Todos</option>{config.roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
                  <label>Dias<select value={overtimeForm.dayGroupId} onChange={(event) => setOvertimeForm({ ...overtimeForm, dayGroupId: event.target.value })}><option value="">Todos</option>{config.dayGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                  <label>Horas<select value={overtimeForm.hourPlanId} onChange={(event) => setOvertimeForm({ ...overtimeForm, hourPlanId: event.target.value })}><option value="">Todos</option>{config.hourPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
                </div>
              )}
            </div>
            <div className="button-row">
              <button type="button" onClick={() => setModal(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function ConfigSection({
  title,
  primaryAction,
  secondaryAction,
  onPrimary,
  onSecondary,
  secondaryDisabled,
  children
}: {
  title: string;
  primaryAction: string;
  secondaryAction: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="config-section">
      <header>
        <h2>{title}</h2>
        <div>
          <button type="button" disabled={!onSecondary || secondaryDisabled} onClick={onSecondary}>{secondaryAction}</button>
          <button type="button" onClick={onPrimary}>{primaryAction}</button>
        </div>
      </header>
      <div className="config-section-body">{children}</div>
      <footer />
    </section>
  );
}

function RateCard({ rate, config, selected, onClick }: { rate: ApiRate; config: ConfigState; selected?: boolean; onClick?: () => void }) {
  const room = config.rooms.find((item) => item.id === rate.roomId);
  const type = config.roomTypes.find((item) => item.id === rate.roomTypeId);
  const dayGroup = config.dayGroups.find((item) => item.id === rate.dayGroupId);
  const hourPlan = config.hourPlans.find((item) => item.id === rate.hourPlanId);
  return (
    <button className={selected ? "selected" : ""} type="button" onClick={onClick}>
      <strong>{soles(rate.priceCents)}</strong>
      <span>{room?.number || type?.name || "Sin tipo"}</span>
      <small>{hourPlan?.name || "-"} / {dayGroup?.name || "-"}</small>
    </button>
  );
}

function ShiftLedgerView({ token, onError }: { token: string; onError: (error: unknown) => void }) {
  const queryClient = useQueryClient();
  const ledgerQuery = useQuery({
    queryKey: queryKeys.shiftLedger,
    queryFn: () => api.shiftLedger(token)
  });
  const ledger = ledgerQuery.data ?? null;
  const loading = ledgerQuery.isFetching;

  async function loadLedger() {
    onError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.shiftLedger });
    } catch (err) {
      onError(err);
    }
  }

  useEffect(() => {
    if (ledgerQuery.error) onError(ledgerQuery.error);
  }, [ledgerQuery.error, onError]);

  return (
    <section className="ledger-view" aria-busy={loading}>
      <header className="ledger-head">
        <div>
          <h1>Shift Log</h1>
          <p>
            {ledger
              ? `${ledger.shift.businessDate} - ${ledger.shift.name} - ${ledger.totals.entries} entries`
              : "Loading current shift"}
          </p>
        </div>
        <button type="button" onClick={loadLedger} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {ledger && (
        <>
          <div className="ledger-summary">
            <span><strong>{soles(ledger.totals.cashCents)}</strong> Cash</span>
            <span><strong>{soles(ledger.totals.cardCents)}</strong> Card</span>
            <span><strong>{soles(ledger.totals.qrCents)}</strong> QR</span>
            <span><strong>{soles(ledger.totals.izipayCents)}</strong> Izipay</span>
            <span><strong>{soles(ledger.totals.totalCents)}</strong> Total</span>
          </div>

          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Check in</th>
                  <th>Guest</th>
                  <th>DNI</th>
                  <th>Birth date</th>
                  <th>District</th>
                  <th>Occupation</th>
                  <th>Companion</th>
                  <th>Paid hours</th>
                  <th>Rate</th>
                  <th>Payment</th>
                  <th>Check out</th>
                  <th>Extra</th>
                  <th>Status</th>
                  <th>Responsible</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.length ? ledger.entries.map((entry) => (
                  <tr key={entry.stayId}>
                    <td>{entry.roomNumber}</td>
                    <td>{localDateTime(entry.checkInAt)}</td>
                    <td>{entry.guest.fullName}</td>
                    <td>{entry.guest.documentNumber}</td>
                    <td>{entry.guest.birthDate ? localDateTime(entry.guest.birthDate).split(",")[0] : "-"}</td>
                    <td>{entry.guest.district || "-"}</td>
                    <td>{entry.guest.occupation || "-"}</td>
                    <td>{entry.companion ? `${entry.companion.fullName} (${entry.companion.documentNumber})` : "-"}</td>
                    <td>{entry.stayHours}</td>
                    <td>{soles(entry.rateCents)}</td>
                    <td>{entry.paymentMethod}</td>
                    <td>{localDateTime(entry.checkOutAt)}</td>
                    <td>{entry.extraMinutes ? `${entry.extraMinutes} min` : "-"}</td>
                    <td>{entry.status} / {entry.timingStatus}</td>
                    <td>{entry.checkedInBy || "-"}{entry.checkedOutBy ? ` / ${entry.checkedOutBy}` : ""}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={15}>No entries in this shift yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-mark"><Sparkles size={24} /></div>
        <h1>KENTY PMS</h1>
        <p>Sign in to manage reception operations.</p>
        {error && <div className="alert">{error}</div>}
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function RoomModal({
  room,
  products,
  token,
  onClose,
  onChanged,
  onError
}: {
  room: ApiRoom;
  products: ApiProduct[];
  token: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [dni, setDni] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [district, setDistrict] = useState("");
  const [occupation, setOccupation] = useState("");
  const [companionDni, setCompanionDni] = useState("");
  const [companionFullName, setCompanionFullName] = useState("");
  const [companionBirthDate, setCompanionBirthDate] = useState("");
  const [companionDistrict, setCompanionDistrict] = useState("");
  const [companionOccupation, setCompanionOccupation] = useState("");
  const [stayHours, setStayHours] = useState(5);
  const [rateCents, setRateCents] = useState(5900);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [rateFilter, setRateFilter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [history, setHistory] = useState<GuestHistory | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [showWaiver, setShowWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const availableRatesQuery = useQuery({
    queryKey: queryKeys.availableRates(room.id),
    queryFn: () => api.availableRates(token, room.id),
    enabled: !room.activeStay
  });
  const availableRates = availableRatesQuery.data?.rates ?? [];

  useEffect(() => {
    setRateCents(room.baseRateCents);
    setStayHours(room.activeStay?.stayHours || 5);
    setSelectedRateId("");
    setRateFilter("");
    setNotes(room.activeStay?.notes || "");
    setDni(room.activeStay?.documentNumber || "");
    setFullName(room.activeStay?.guestName || "");
    setBirthDate("");
    setDistrict("");
    setOccupation("");
    setCompanionDni("");
    setCompanionFullName("");
    setCompanionBirthDate("");
    setCompanionDistrict("");
    setCompanionOccupation("");
    setPaymentMethod("CASH");
    setHistory(null);
    setHistoryMessage("");
    setProductId(products[0]?.id || "");
    setQuantity(1);
  }, [room.id, products]);

  useEffect(() => {
    if (availableRatesQuery.error) onError(availableRatesQuery.error);
  }, [availableRatesQuery.error, onError]);

  useEffect(() => {
    if (room.activeStay || selectedRateId) return;
    const firstRate = availableRates[0];
    if (!firstRate) return;
    setSelectedRateId(firstRate.id);
    setStayHours(firstRate.hours);
    setRateCents(firstRate.priceCents);
  }, [availableRates, room.activeStay, selectedRateId]);

  useEffect(() => {
    const rate = availableRates.find((item) => item.id === selectedRateId);
    if (!rate) return;
    setStayHours(rate.hours);
    setRateCents(rate.priceCents);
  }, [selectedRateId, availableRates]);

  useEffect(() => {
    const normalizedDni = dni.trim();
    if (normalizedDni.length !== 8 || room.activeStay) {
      setHistory(null);
      setHistoryMessage("");
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        const response = await api.guestHistory(token, normalizedDni);
        setHistory(response.history);
        setHistoryMessage("");
        setFullName((current) => current || response.history.guest.fullName);
        setDistrict((current) => current || response.history.guest.district);
        setOccupation((current) => current || response.history.guest.occupation);
        setBirthDate((current) => current || response.history.guest.birthDate?.slice(0, 10) || "");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setHistory(null);
          setHistoryMessage("New guest");
          return;
        }
        onError(err);
      }
    }, 350);

    return () => window.clearTimeout(handle);
  }, [dni, room.activeStay, token, onError]);

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    onError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  function validateCheckIn() {
    if (!dni.trim()) {
      onError(new Error("Please enter at least the guest DNI before check in"));
      return false;
    }

    if (!fullName.trim()) {
      onError(new Error("Please enter the guest full name before check in"));
      return false;
    }

    return true;
  }

  const selectedProduct = products.find((product) => product.id === productId);
  const openStay = room.activeStay;
  const filteredRates = availableRates.filter((rate) => {
    const value = rateFilter.trim();
    if (!value) return true;
    return rate.name.toLowerCase().includes(value.toLowerCase())
      || String(rate.hours).includes(value)
      || String(rate.priceCents / 100).includes(value);
  });
  const overtimeDue = openStay ? Math.max(openStay.overtimeChargeCents, 0) : 0;
  const parsedBirthDate = birthDate ? new Date(`${birthDate}T00:00:00`) : undefined;
  const parsedCompanionBirthDate = companionBirthDate ? new Date(`${companionBirthDate}T00:00:00`) : undefined;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="room-modal" role="dialog" aria-modal="true" aria-labelledby="room-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h1 id="room-modal-title">Room {room.number}</h1>
            <p>{room.type}</p>
          </div>
          <div className="modal-head-actions">
            <span className={`status-pill ${statusClass(room.status)}`}>{statusLabel(room.status)}</span>
            <button className="icon-button light" type="button" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="modal-content">
          <form className="form-card">
            <h2>Guest</h2>
            <div className="form-grid two">
              <label>DNI<input value={dni} onChange={(event) => setDni(event.target.value)} maxLength={20} /></label>
              <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>Birth date<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
              <label>District<input value={district} onChange={(event) => setDistrict(event.target.value)} /></label>
              <label>Occupation<input value={occupation} onChange={(event) => setOccupation(event.target.value)} /></label>
              <label>Buscar plan<input value={rateFilter} onChange={(event) => setRateFilter(event.target.value)} placeholder="precio u horas" disabled={Boolean(openStay)} /></label>
              <label>Plan<select value={selectedRateId} onChange={(event) => setSelectedRateId(event.target.value)} disabled={Boolean(openStay)}>
                <option value="">Sin tarifa configurada</option>
                {filteredRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>{rate.hours}h - {soles(rate.priceCents)} - extra {soles(rate.extraHourCents)}</option>
                ))}
              </select></label>
              <label>Paid hours<input type="number" min={1} value={stayHours} readOnly /></label>
              <label>Rate<input type="number" min={0} value={rateCents / 100} readOnly /></label>
              <label>Initial payment<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="QR">QR</option>
                <option value="IZIPAY">Izipay</option>
              </select></label>
              <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            </div>

            {(history || historyMessage) && (
              <div className="history-panel">
                {history ? (
                  <>
                    <h3>Client history</h3>
                    <p>{history.summary.totalVisits} visits - Favorite room {history.summary.favoriteRoom || "-"} - {history.summary.favoriteRoomType || "-"}</p>
                    <p>Average stay: {history.summary.averageStayHours || "-"} hours</p>
                    <div className="history-list">
                      {history.favoriteProducts.length ? history.favoriteProducts.map((product) => (
                        <span key={product.productId}>{product.name}: {product.quantity}</span>
                      )) : <span>No product history</span>}
                    </div>
                  </>
                ) : <p>{historyMessage}</p>}
              </div>
            )}

            <h2 className="form-section-title">Companion</h2>
            <div className="form-grid two">
              <label>DNI<input value={companionDni} onChange={(event) => setCompanionDni(event.target.value)} maxLength={20} /></label>
              <label>Full name<input value={companionFullName} onChange={(event) => setCompanionFullName(event.target.value)} /></label>
              <label>Birth date<input type="date" value={companionBirthDate} onChange={(event) => setCompanionBirthDate(event.target.value)} /></label>
              <label>District<input value={companionDistrict} onChange={(event) => setCompanionDistrict(event.target.value)} /></label>
              <label>Occupation<input value={companionOccupation} onChange={(event) => setCompanionOccupation(event.target.value)} /></label>
            </div>

            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                disabled={busy || room.status === "OCCUPIED"}
                onClick={() => {
                  if (!validateCheckIn()) return;
                  void run(() => api.checkIn(token, {
                    roomId: room.id,
                    rateId: selectedRateId || undefined,
                    guest: {
                      documentType: "DNI",
                      documentNumber: dni,
                      fullName,
                      birthDate: parsedBirthDate,
                      district,
                      occupation,
                      phone: "",
                      email: ""
                    },
                    companion: companionDni && companionFullName ? {
                      documentType: "DNI",
                      documentNumber: companionDni,
                      fullName: companionFullName,
                      birthDate: parsedCompanionBirthDate,
                      district: companionDistrict,
                      occupation: companionOccupation,
                      phone: "",
                      email: ""
                    } : undefined,
                    stayHours,
                    rateCents,
                    paymentMethod,
                    notes
                  }));
                }}
              >
                Check in
              </button>
              <button
                type="button"
                disabled={busy || !openStay}
                onClick={() => {
                  if (!openStay) return;
                  if (openStay.overtimeMinutes > 0) {
                    setShowWaiver(true);
                    return;
                  }
                  void run(() => api.checkOut(token, openStay.id));
                }}
              >
                Check out
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => api.setRoomStatus(token, room.id, "CLEANING"))}>Cleaning</button>
              <button type="button" disabled={busy || room.status === "OCCUPIED"} onClick={() => run(() => api.setRoomStatus(token, room.id, "AVAILABLE"))}>Available</button>
            </div>
          </form>

          <div className="form-card">
            <div className="account">
              <h2>Account</h2>
              <strong>{soles(openStay?.balanceCents || 0)}</strong>
            </div>
            {openStay && (
              <div className={`overtime-box ${openStay.overtimeMinutes > 0 ? "active" : ""}`}>
                <h2>Sobretiempo</h2>
                <p>{openStay.overtimeMinutes > 0 ? `${openStay.overtimeMinutes} min - ${soles(overtimeDue)}` : "Sin sobretiempo"}</p>
                {openStay.overtimeStartsAt && <small>Inicia: {localDateTime(openStay.overtimeStartsAt)}</small>}
              </div>
            )}

            <div className="charge-box">
              <h2>Add product</h2>
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name} - {soles(product.unitPriceCents)}</option>
                ))}
              </select>
              <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              <button
                type="button"
                disabled={busy || !openStay || !selectedProduct}
                onClick={() => selectedProduct && openStay && run(() => api.addCharge(token, {
                  stayId: openStay.id,
                  productId: selectedProduct.id,
                  description: selectedProduct.name,
                  quantity,
                  unitPriceCents: selectedProduct.unitPriceCents,
                  paymentMethod: "ROOM_ACCOUNT"
                }))}
              >
                <Plus size={16} /> Add charge
              </button>
            </div>
          </div>
        </div>
      </section>
      {showWaiver && openStay && (
        <section className="waiver-modal" onMouseDown={(event) => event.stopPropagation()}>
          <h2>Cerrar con sobretiempo</h2>
          <p>Sobretiempo calculado: {openStay.overtimeMinutes} min. Cargo: {soles(overtimeDue)}.</p>
          <label>Motivo de omision<textarea value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} /></label>
          <div className="button-row">
            <button type="button" onClick={() => {
              setShowWaiver(false);
              setWaiverReason("");
            }}>Cancelar</button>
            <button type="button" onClick={() => {
              setShowWaiver(false);
              void run(() => api.checkOut(token, openStay.id));
            }}>Cobrar hora extra</button>
            <button className="primary-button" type="button" disabled={waiverReason.trim().length < 3} onClick={() => {
              setShowWaiver(false);
              void run(() => api.checkOut(token, openStay.id, { waiveOvertime: true, overtimeWaiverReason: waiverReason }));
            }}>Omitir pago de horas extra</button>
          </div>
        </section>
      )}
    </div>
  );
}
