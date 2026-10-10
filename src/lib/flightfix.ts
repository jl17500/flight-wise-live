export const API_BASE = "https://jingowen123.app.n8n.cloud/webhook/flightfix";
export const CHAT_URL =
  "https://jingowen123.app.n8n.cloud/webhook/740b1f4b-f6e7-49ff-832e-a82fa9f11f4f/chat";

export type FlightStatus = "cancelled" | "delayed" | "scheduled";
export type RecoveryStatus = "waiting" | "rebooked" | "refund_pending" | "needs_help" | "scheduled";

export interface OpsData {
  data_version?: string;
  generated_at: string;
  summary: {
    passengers: number;
    waiting: number;
    rebooked: number;
    refund_pending: number;
    needs_help: number;
    open_help_cases: number;
    seats_left: number;
    notified?: number;
  };
  flights: {
    flight_no: string;
    origin: string;
    destination: string;
    status: FlightStatus;
    reason: string | null;
    delay_minutes: number;
    risk_level: "high" | "medium" | "low" | "normal";
    est_risk_pct: number;
    risk_signal: string;
    departs_at?: string;
    date: string;
    departs: string;
    arrives: string;
    passengers: number;
    resolved: number;
    needs_help: number;
  }[];
  replacement_seats: {
    flight_no: string;
    replaces_flight: string;
    date: string;
    departs: string;
    arrives: string;
    departs_at?: string;
    seats_left: number;
  }[];
  passengers: {
    booking_ref: string;
    name: string;
    flight_no: string;
    recovery_status: RecoveryStatus;
    outcome: string | null;
    replacement_flight: string | null;
    confirmation_code: string | null;
    refund: unknown;
    follow_up: string | null;
    link_token: string;
    notified_at?: string | null;
    notified_flight?: string | null;
    claimed_at?: string | null;
    updated_at: string;
  }[];
  help_cases: {
    id: string;
    booking_ref: string;
    name: string;
    flight_no: string;
    reason: string;
    note: string | null;
    source: string;
    status: string;
    opened_at: string;
  }[];
  activity: {
    time: string;
    type:
      | "staged"
      | "rebooked"
      | "refund"
      | "declined"
      | "expired"
      | "blocked"
      | "help"
      | "cancel"
      | "delay"
      | "message";
    title: string;
    booking_ref: string;
    flight_no: string;
  }[];
}

export interface PassengerData {
  data_version?: string;
  ok: true;
  passenger: { first_name: string; last_name: string; booking_ref: string };
  recovery_status: RecoveryStatus;
  help_request: string | null;
  outcome:
    | null
    | {
        type: "rebooked";
        flight_no: string;
        confirmation_code: string;
        date: string;
        departs: string;
        arrives: string;
      }
    | { type: "refund_requested"; amount: string | number; paid: false };
  flight: {
    flight_no: string;
    route: string;
    status: FlightStatus;
    reason: string | null;
    date: string;
    scheduled_departure: string;
    scheduled_arrival: string;
    delay_minutes: number;
    new_departure: string | null;
    new_arrival: string | null;
  };
  options: {
    flight_no: string;
    date: string;
    departs: string;
    arrives: string;
    seats_left: number;
    same_day: boolean;
  }[];
  refund: null | {
    base_fare: string | number;
    taxes_and_fees: string | number;
    total: string | number;
    rule?: string;
    timing?: string;
  };
}

export class LinkNotFound extends Error {}

export async function fetchOps(): Promise<OpsData> {
  const r = await fetch(`${API_BASE}/ops`);
  if (!r.ok) throw new Error(`Operations feed returned ${r.status}`);
  return r.json();
}

export async function fetchPassenger(token: string): Promise<PassengerData> {
  const r = await fetch(`${API_BASE}/passenger?token=${encodeURIComponent(token)}`);
  if (r.status === 404) {
    const body = await r.json().catch(() => ({}));
    throw new LinkNotFound(body?.message || "This recovery link could not be found.");
  }
  if (!r.ok) throw new Error(`Passenger feed returned ${r.status}`);
  const body = await r.json();
  if (body?.ok === false)
    throw new LinkNotFound(body.message || "This recovery link could not be found.");
  return body;
}

export async function sendChat(
  sessionId: string,
  chatInput: string,
  token: string,
): Promise<string> {
  const r = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sendMessage", sessionId, chatInput, metadata: { token } }),
  });
  if (!r.ok) throw new Error(`Chat returned ${r.status}`);
  const body = await r.json();
  const out = Array.isArray(body) ? body[0]?.output : body?.output;
  if (typeof out !== "string") throw new Error("Empty reply");
  return out;
}

export function money(v: string | number) {
  if (typeof v === "number")
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return v;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** A failed operator action, with the backend's own explanation when it sent one. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false) {
    throw new ApiError(
      data?.message || `The ${path} request failed (${r.status}).`,
      r.status,
      data?.error,
    );
  }
  return data as T;
}

export interface CancelResult {
  ok: true;
  flight_no: string;
  status: "cancelled";
  reason: string;
  passengers: number;
  reopened: number;
  replacement_flights: { flight_no: string; departs_at: string; seats_left: number }[];
}

export function cancelFlight(flight_no: string, reason: string) {
  return postJson<CancelResult>("cancel", { flight_no, reason });
}

export interface NotifyResult {
  ok: true;
  flight_no: string;
  sent: { booking_ref: string; name: string; notified_at: string }[];
  failed: { booking_ref: string; name: string; error: string }[];
  skipped: { booking_ref: string; name: string; reason: string }[];
  message?: string;
}

export function notifyPassengers(input: {
  flight_no: string;
  message?: string;
  booking_refs?: string[];
  resend?: boolean;
}) {
  return postJson<NotifyResult>("notify", { ...input, link_base: window.location.origin });
}

export function resetDemo(pin: string) {
  return postJson<{ ok: true; reset_at: string; message: string }>("reset", { pin });
}

/** The page every audience phone opens from the live board's QR code. */
export const JOIN_URL = `${API_BASE}/join`;

export interface RiskResult {
  ok: true;
  flight: {
    origin: string;
    dest: string;
    carrier: string;
    carrier_name?: string;
    date: string;
    hour: number;
  };
  known_route: boolean;
  risk_pct: number;
  average_pct: number;
  times_average: number;
  route_history_pct: number | null;
  level: "high" | "medium" | "low" | "normal";
  raises: string[];
  lowers: string[];
  month_in_training: boolean;
  explanation: string;
}

export interface RiskOptions {
  origins: { code: string; name: string }[];
  destinations: { code: string; name: string }[];
  popular_origins: string[];
  carriers: { code: string; name: string }[];
  model: {
    trained_on: string;
    auc_model: number;
    auc_route_baseline: number;
    top_decile_lift_model: number;
    top_decile_lift_baseline: number;
    test_flights: number;
    test_rate_pct: number;
  };
}

export async function fetchRiskOptions(): Promise<RiskOptions> {
  const r = await fetch(`${API_BASE}/risk?options=1`);
  if (!r.ok) throw new Error(`Risk options returned ${r.status}`);
  return r.json();
}

export async function fetchRisk(q: {
  origin: string;
  dest: string;
  carrier?: string;
  date: string;
  hour: number;
}): Promise<RiskResult> {
  const params = new URLSearchParams({
    origin: q.origin,
    dest: q.dest,
    date: q.date,
    hour: String(q.hour),
    ...(q.carrier ? { carrier: q.carrier } : {}),
  });
  const r = await fetch(`${API_BASE}/risk?${params}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false)
    throw new Error(data?.message || `Risk check returned ${r.status}`);
  return data;
}
