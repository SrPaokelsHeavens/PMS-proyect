import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BedDouble, LogOut, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { ApiAvailableRate, ApiProduct, ApiRateConfigRoom, ApiRatePlan, ApiRoom, ComputedRoomStatus, GuestHistory, PaymentMethod, RoomStatus, ShiftLedger } from "@hotel-os/shared";
import { ApiError, api, type Session } from "./api.js";

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
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reception" | "shift-ledger" | "sales" | "inventory" | "reports" | "rates">("reception");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId),
    [rooms, activeRoomId]
  );

  async function refresh() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [roomResponse, productResponse] = await Promise.all([
        api.rooms(session.token),
        api.products(session.token)
      ]);
      setRooms(roomResponse.rooms);
      setProducts(productResponse.products);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession();
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [session?.token]);

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
    setRooms([]);
    setProducts([]);
    setActiveRoomId(null);
  }

  function expireSession() {
    localStorage.removeItem("hotel-os-session");
    setSession(null);
    setRooms([]);
    setProducts([]);
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
          <div className="room-grid" aria-busy={loading}>
            {rooms.map((room) => (
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

function RateSettingsView({ token, onError, onRoomsChanged }: { token: string; onError: (error: unknown) => void; onRoomsChanged: () => Promise<void> }) {
  const [ratePlans, setRatePlans] = useState<ApiRatePlan[]>([]);
  const [rooms, setRooms] = useState<ApiRateConfigRoom[]>([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);

  const [rateForm, setRateForm] = useState({
    name: "Nueva tarifa",
    stayHours: 6,
    priceSoles: 0,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    active: true,
    priority: 10,
    roomIds: [] as string[]
  });

  const [roomForm, setRoomForm] = useState({
    number: "",
    floor: 2,
    type: "Matrimonial",
    shortLabel: "M",
    baseRateSoles: 50,
    status: "AVAILABLE" as RoomStatus
  });

  const selectedRate = ratePlans.find((ratePlan) => ratePlan.id === selectedRateId);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);

  const statusCounts: Record<RoomStatus, number> = useMemo(() => rooms.reduce<Record<RoomStatus, number>>((totals, room) => {
    totals[room.status] += 1;
    return totals;
  }, { AVAILABLE: 0, OCCUPIED: 0, CLEANING: 0, DISABLED: 0 }), [rooms]);

  async function loadRates() {
    setLoading(true);
    onError(null);
    try {
      const response = await api.rates(token);
      setRatePlans(response.ratePlans);
      setRooms(response.rooms);
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRates();
  }, [token]);

  useEffect(() => {
    if (!selectedRate) return;
    setRateForm({
      name: selectedRate.name,
      stayHours: selectedRate.stayHours,
      priceSoles: selectedRate.priceCents / 100,
      daysOfWeek: selectedRate.daysOfWeek,
      active: selectedRate.active,
      priority: selectedRate.priority,
      roomIds: selectedRate.roomIds
    });
  }, [selectedRateId]);

  useEffect(() => {
    if (!selectedRoom) return;
    setRoomForm({
      number: selectedRoom.number,
      floor: selectedRoom.floor,
      type: selectedRoom.type,
      shortLabel: selectedRoom.shortLabel,
      baseRateSoles: selectedRoom.baseRateCents / 100,
      status: selectedRoom.status
    });
  }, [selectedRoomId]);

  function toggleDay(day: number) {
    setRateForm((current) => {
      const daysOfWeek = current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day];
      return { ...current, daysOfWeek };
    });
  }

  function toggleRoom(roomId: string) {
    setRateForm((current) => {
      const roomIds = current.roomIds.includes(roomId)
        ? current.roomIds.filter((value) => value !== roomId)
        : [...current.roomIds, roomId];
      return { ...current, roomIds };
    });
  }

  async function saveRate(event: FormEvent) {
    event.preventDefault();
    if (!rateForm.daysOfWeek.length) {
      onError(new Error("Selecciona al menos un dia para la tarifa"));
      return;
    }

    setSavingRate(true);
    onError(null);
    try {
      const input = {
        name: rateForm.name,
        stayHours: rateForm.stayHours,
        priceCents: Math.round(rateForm.priceSoles * 100),
        daysOfWeek: rateForm.daysOfWeek,
        active: rateForm.active,
        priority: rateForm.priority,
        roomIds: rateForm.roomIds
      };

      if (selectedRateId) {
        await api.updateRate(token, selectedRateId, input);
      } else {
        await api.createRate(token, input);
      }
      await loadRates();
      await onRoomsChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSavingRate(false);
    }
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    setSavingRoom(true);
    onError(null);
    try {
      const input = {
        number: roomForm.number,
        floor: roomForm.floor,
        type: roomForm.type,
        shortLabel: roomForm.shortLabel,
        baseRateCents: Math.round(roomForm.baseRateSoles * 100),
        roomGroupId: "",
        active: true,
        notes: "",
        status: roomForm.status
      };

      if (selectedRoomId) {
        await api.updateRoom(token, selectedRoomId, input);
      } else {
        await api.createRoom(token, input);
      }
      setSelectedRoomId("");
      setRoomForm({ number: "", floor: roomForm.floor, type: roomForm.type, shortLabel: roomForm.shortLabel, baseRateSoles: roomForm.baseRateSoles, status: "AVAILABLE" });
      await loadRates();
      await onRoomsChanged();
    } catch (err) {
      onError(err);
    } finally {
      setSavingRoom(false);
    }
  }

  return (
    <section className="settings-view" aria-busy={loading}>
      <header className="ledger-head">
        <div>
          <h1>Configuracion hotelera</h1>
          <p>Tarifas por horas, asignacion por habitaciones y control de disponibilidad.</p>
        </div>
        <button type="button" onClick={loadRates} disabled={loading}>{loading ? "Cargando..." : "Actualizar"}</button>
      </header>

      <div className="settings-summary">
        <span><strong>{rooms.length}</strong> Habitaciones</span>
        <span><strong>{statusCounts.AVAILABLE}</strong> Disponibles</span>
        <span><strong>{statusCounts.OCCUPIED}</strong> Ocupadas</span>
        <span><strong>{statusCounts.CLEANING}</strong> Limpieza</span>
        <span><strong>{statusCounts.DISABLED}</strong> Inhabilitado</span>
      </div>

      <div className="settings-layout">
        <form className="settings-panel" onSubmit={saveRate}>
          <div className="settings-panel-head">
            <div>
              <h2>Tarifas por grupo de horas</h2>
              <p>Crea cualquier grupo de horas y asignalo a las habitaciones que correspondan.</p>
            </div>
            <button type="button" onClick={() => {
              setSelectedRateId("");
              setRateForm({ name: "Nueva tarifa", stayHours: 1, priceSoles: 0, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], active: true, priority: 10, roomIds: [] });
            }}>Nueva</button>
          </div>

          <div className="rate-list">
            {ratePlans.map((ratePlan) => (
              <button className={selectedRateId === ratePlan.id ? "selected" : ""} key={ratePlan.id} type="button" onClick={() => setSelectedRateId(ratePlan.id)}>
                <strong>{ratePlan.name}</strong>
                <span>{ratePlan.stayHours} h - {soles(ratePlan.priceCents)} - {ratePlan.roomIds.length} hab.</span>
              </button>
            ))}
          </div>

          <div className="form-grid settings-form">
            <label>Nombre<input value={rateForm.name} onChange={(event) => setRateForm({ ...rateForm, name: event.target.value })} /></label>
            <label>Horas<input type="number" min={1} value={rateForm.stayHours} onChange={(event) => setRateForm({ ...rateForm, stayHours: Number(event.target.value) })} /></label>
            <label>Precio S/<input type="number" min={0} step="0.5" value={rateForm.priceSoles} onChange={(event) => setRateForm({ ...rateForm, priceSoles: Number(event.target.value) })} /></label>
            <label>Prioridad<input type="number" min={0} value={rateForm.priority} onChange={(event) => setRateForm({ ...rateForm, priority: Number(event.target.value) })} /></label>
            <label>Estado<select value={rateForm.active ? "ACTIVE" : "INACTIVE"} onChange={(event) => setRateForm({ ...rateForm, active: event.target.value === "ACTIVE" })}>
              <option value="ACTIVE">Activa</option>
              <option value="INACTIVE">Inactiva</option>
            </select></label>
          </div>

          <div className="segmented-row" aria-label="Dias activos">
            {dayOptions.map((day) => (
              <button className={rateForm.daysOfWeek.includes(day.value) ? "active" : ""} key={day.value} type="button" onClick={() => toggleDay(day.value)}>{day.label}</button>
            ))}
          </div>

          <div className="room-assignment">
            {rooms.map((room) => (
              <label className={rateForm.roomIds.includes(room.id) ? "checked" : ""} key={room.id}>
                <input type="checkbox" checked={rateForm.roomIds.includes(room.id)} onChange={() => toggleRoom(room.id)} />
                <span>{room.number}</span>
                <small>{room.type} - base {soles(room.baseRateCents)}</small>
              </label>
            ))}
          </div>

          <button className="primary-button" type="submit" disabled={savingRate}>{savingRate ? "Guardando..." : "Guardar tarifa"}</button>
        </form>

        <form className="settings-panel" onSubmit={saveRoom}>
          <div className="settings-panel-head">
            <div>
              <h2>Habitaciones</h2>
              <p>Alta, edicion, tarifa base y estado operativo.</p>
            </div>
            <button type="button" onClick={() => {
              setSelectedRoomId("");
              setRoomForm({ number: "", floor: 2, type: "Matrimonial", shortLabel: "M", baseRateSoles: 50, status: "AVAILABLE" });
            }}>Nueva</button>
          </div>

          <div className="form-grid settings-form">
            <label>Seleccionar<select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
              <option value="">Nueva habitacion</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.number} - {room.type}</option>)}
            </select></label>
            <label>Nro<input value={roomForm.number} onChange={(event) => setRoomForm({ ...roomForm, number: event.target.value })} /></label>
            <label>Piso<input type="number" min={0} value={roomForm.floor} onChange={(event) => setRoomForm({ ...roomForm, floor: Number(event.target.value) })} /></label>
            <label>Tipo<input value={roomForm.type} onChange={(event) => setRoomForm({ ...roomForm, type: event.target.value })} /></label>
            <label>Etiqueta<input value={roomForm.shortLabel} onChange={(event) => setRoomForm({ ...roomForm, shortLabel: event.target.value })} /></label>
            <label>Tarifa base S/<input type="number" min={0} step="0.5" value={roomForm.baseRateSoles} onChange={(event) => setRoomForm({ ...roomForm, baseRateSoles: Number(event.target.value) })} /></label>
            <label>Estado<select value={roomForm.status} onChange={(event) => setRoomForm({ ...roomForm, status: event.target.value as RoomStatus })}>
              <option value="AVAILABLE">Disponible</option>
              <option value="CLEANING">Limpieza</option>
              <option value="DISABLED">Inhabilitado</option>
              <option value="OCCUPIED">Ocupada</option>
            </select></label>
          </div>

          <button className="primary-button" type="submit" disabled={savingRoom}>{savingRoom ? "Guardando..." : "Guardar habitacion"}</button>
        </form>
      </div>
    </section>
  );
}

function ShiftLedgerView({ token, onError }: { token: string; onError: (error: unknown) => void }) {
  const [ledger, setLedger] = useState<ShiftLedger | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadLedger() {
    setLoading(true);
    onError(null);
    try {
      setLedger(await api.shiftLedger(token));
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLedger();
  }, [token]);

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
  const [availableRates, setAvailableRates] = useState<ApiAvailableRate[]>([]);
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

  useEffect(() => {
    setRateCents(room.baseRateCents);
    setStayHours(room.activeStay?.stayHours || 5);
    setAvailableRates([]);
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
    if (room.activeStay) return;
    void api.availableRates(token, room.id)
      .then((response) => {
        setAvailableRates(response.rates);
        const firstRate = response.rates[0];
        if (firstRate) {
          setSelectedRateId(firstRate.id);
          setStayHours(firstRate.hours);
          setRateCents(firstRate.priceCents);
        }
      })
      .catch(onError);
  }, [room.id, room.activeStay, token, onError]);

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
