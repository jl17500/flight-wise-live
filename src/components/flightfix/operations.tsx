import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelFlight,
  fetchRisk,
  fetchRiskOptions,
  notifyPassengers,
  resetDemo,
  type NotifyResult,
  type OpsData,
  type RiskResult,
} from "@/lib/flightfix";
import { Button, Icon } from "./primitives";

type Flight = OpsData["flights"][number];
type Passenger = OpsData["passengers"][number];

function DialogHead({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-head">
      <div>
        <h2 id="dialog-title">{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <Button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
        <Icon name="close" />
      </Button>
    </div>
  );
}

/** Confirm dialog for cancelling a flight. The backend opens recovery and replacement seats. */
export function CancelFlightDialog({
  flight,
  onClose,
  onCancelled,
}: {
  flight: Flight;
  onClose: () => void;
  onCancelled: (flightNo: string) => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState(`Thunderstorms at ${flight.destination}`),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await cancelFlight(flight.flight_no, reason.trim() || "Operational disruption");
      await qc.refetchQueries({ queryKey: ["ops"] });
      toast.success(`${r.flight_no} cancelled · ${r.passengers} passengers moved to recovery`);
      onCancelled(r.flight_no);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The cancellation did not go through.");
      setBusy(false);
    }
  };
  return (
    <>
      <DialogHead
        title={`Cancel ${flight.flight_no} (${flight.origin} → ${flight.destination})?`}
        subtitle="Live action · writes to the n8n backend"
        onClose={onClose}
      />
      <div className="modal-body">
        <label className="field-label" htmlFor="cancel-reason">
          Reason passengers will see
        </label>
        <input
          id="cancel-reason"
          className="field"
          maxLength={80}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
        <p className="mt12">
          Its {flight.passengers} passengers move into recovery and 3 same-route replacement flights
          open.
        </p>
        {error && (
          <div className="notice red mt16" role="alert">
            <Icon name="warning" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <Button onClick={onClose} disabled={busy}>
          Keep flight
        </Button>
        <Button className="btn danger" onClick={confirm} disabled={busy}>
          {busy ? "Cancelling…" : "Cancel flight"}
        </Button>
      </div>
    </>
  );
}

function ResultList({ title, tone, items }: { title: string; tone: string; items: ReactNode[] }) {
  if (!items.length) return null;
  return (
    <div className={`send-result ${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function NotifyResultPanel({ result }: { result: NotifyResult }) {
  return (
    <div className="mt16">
      <div className={`notice ${result.sent.length ? "green" : ""}`}>
        <Icon name={result.sent.length ? "check" : "info"} />
        <span>
          {result.sent.length
            ? `Sent to ${result.sent.length} passenger${result.sent.length === 1 ? "" : "s"}.`
            : result.message || "No one on this flight needed a new link."}
        </span>
      </div>
      <ResultList
        title="Sent"
        tone="green"
        items={result.sent.map((p) => `${p.name} · ${p.booking_ref}`)}
      />
      <ResultList
        title="Failed"
        tone="red"
        items={result.failed.map((p) => `${p.name} · ${p.booking_ref}: ${p.error}`)}
      />
      <ResultList
        title="Skipped"
        tone="gray"
        items={result.skipped.map((p) => `${p.name} · ${p.booking_ref}: ${p.reason}`)}
      />
    </div>
  );
}

/** Review and send real recovery-link emails through n8n and Gmail. */
export function SendEmailDialog({
  flight,
  recipients,
  draft,
  onClose,
}: {
  flight: Flight;
  recipients: number;
  draft: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<NotifyResult | null>(null);
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      // The email carries the real link itself, so drop the template's placeholder.
      const message = draft.replace(/\s*\[Demo (recovery|update) link\]\s*/g, " ").trim();
      const r = await notifyPassengers({ flight_no: flight.flight_no, message });
      setResult(r);
      await qc.refetchQueries({ queryKey: ["ops"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The emails did not go out.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DialogHead
        title="Review Passenger Notification"
        subtitle={`${flight.flight_no} · Email · Live email via Gmail · demo inbox`}
        onClose={onClose}
      />
      <div className="modal-body">
        <div className="kv">
          <span>Recipients</span>
          <strong>
            {recipients} fictional passenger{recipients === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="kv">
          <span>Flight status</span>
          <strong>{flight.status}</strong>
        </div>
        <div className="modal-message">{draft}</div>
        {!result && (
          <div className="notice mt16">
            <Icon name="mail" />
            <span>
              Each passenger gets a real email with a private link to their own recovery page. The
              emails go to the demo inbox.
            </span>
          </div>
        )}
        {error && (
          <div className="notice red mt16" role="alert">
            <Icon name="warning" />
            <span>{error}</span>
          </div>
        )}
        {result && <NotifyResultPanel result={result} />}
      </div>
      <div className="modal-actions">
        {result ? (
          <Button className="btn primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="btn primary" onClick={send} disabled={busy || !recipients}>
              {busy ? "Sending…" : "Approve & send"} <Icon name="mail" />
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** Sends (or re-sends) one passenger's recovery link from the case dialog. */
export function SendLinkButton({ passenger }: { passenger: Passenger }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await notifyPassengers({
        flight_no: passenger.flight_no,
        booking_refs: [passenger.booking_ref],
        resend: Boolean(passenger.notified_at),
      });
      if (r.sent.length) toast.success(`Recovery link emailed to ${passenger.name}`);
      else
        toast.message(
          r.skipped[0]?.reason
            ? `Not sent: ${r.skipped[0].reason}`
            : (r.failed[0]?.error ?? "Not sent"),
        );
      await qc.refetchQueries({ queryKey: ["ops"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The email did not go out.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button className="btn full mt12" onClick={send} disabled={busy}>
      <Icon name="mail" />
      {busy ? "Sending…" : passenger.notified_at ? "Re-send recovery link" : "Send recovery link"}
    </Button>
  );
}

/** Wipes chat sessions this browser saved, so a reset demo starts with fresh conversations. */
function clearSavedChats() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      Object.keys(store)
        .filter((k) => /^ff-(sid|msgs|version)-/.test(k))
        .forEach((k) => store.removeItem(k));
    } catch {
      /* storage may be blocked */
    }
  }
}

export function DemoControls() {
  const qc = useQueryClient();
  const [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reset = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await resetDemo(pin.trim());
      setPin("");
      clearSavedChats();
      toast.success(r.message || "Demo data reset");
      await qc.refetchQueries({ queryKey: ["ops"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card panel-pad">
      <h2>Demo controls</h2>
      <div className="settings-row">
        <div>
          <strong>Reset demo data</strong>
          <p>
            Restores every flight, booking and seat to the start of the demo, including NS612 and
            the 30 audience passengers. Needs the team PIN.
          </p>
        </div>
      </div>
      <form
        className="flex gap8 mt12"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.trim()) reset();
        }}
      >
        <label className="sr-only" htmlFor="demo-pin">
          Team PIN
        </label>
        <input
          id="demo-pin"
          className="field"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Team PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" className="btn danger" disabled={busy || !pin.trim()}>
          <Icon name="refresh" />
          {busy ? "Resetting…" : "Reset demo data"}
        </Button>
      </form>
      {error && (
        <div className="notice red mt12" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const LEVEL_TONE: Record<RiskResult["level"], string> = {
  high: "red",
  medium: "amber",
  low: "blue",
  normal: "gray",
};

/** "Name your flight home": scores any US flight with the disruption model in n8n. */
export function RiskCheckCard() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card risk-card" aria-label="Flight risk check">
      <div className="card-head">
        <div className="section-title">
          <Icon name="chart" />
          <h2>Flight risk check</h2>
        </div>
        <Button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide" : "Check any US flight"} <Icon name={open ? "down" : "arrow"} />
        </Button>
      </div>
      {open && <RiskCheck />}
    </section>
  );
}

function RiskCheck() {
  const options = useQuery({
    queryKey: ["risk-options"],
    queryFn: fetchRiskOptions,
    staleTime: 3_600_000,
    gcTime: 3_600_000,
    retry: 1,
  });
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    origin: "JFK",
    dest: "ATL",
    carrier: "",
    date: `${year}-12-23`,
    hour: 18,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<RiskResult | null>(null);
  const o = options.data;
  const origins = o
    ? [
        ...o.popular_origins.map((c) => o.origins.find((x) => x.code === c)).filter(Boolean),
        ...o.origins.filter((x) => !o.popular_origins.includes(x.code)),
      ]
    : [];
  const check = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await fetchRisk(form));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Risk check failed.");
    } finally {
      setBusy(false);
    }
  };
  if (options.isError)
    return (
      <div className="risk-body">
        <div className="notice red">
          <Icon name="warning" />
          <span>Couldn't load the model's airports. {options.error.message}</span>
        </div>
      </div>
    );
  if (!o) return <p className="fine risk-body">Loading the model…</p>;
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: k === "hour" ? Number(e.target.value) : e.target.value });
  return (
    <div className="risk-body">
      <form
        className="risk-form"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <label>
          <span className="field-label">From</span>
          <select className="field" value={form.origin} onChange={set("origin")}>
            {origins.map(
              (a) =>
                a && (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ),
            )}
          </select>
        </label>
        <label>
          <span className="field-label">To</span>
          <select className="field" value={form.dest} onChange={set("dest")}>
            {o.destinations.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Airline</span>
          <select className="field" value={form.carrier} onChange={set("carrier")}>
            <option value="">Any airline</option>
            {o.carriers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Date</span>
          <input className="field" type="date" value={form.date} onChange={set("date")} />
        </label>
        <label>
          <span className="field-label">Departure</span>
          <select className="field" value={form.hour} onChange={set("hour")}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Checking…" : "Check risk"}
        </Button>
      </form>
      {error && (
        <div className="notice red mt12" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="risk-result">
          <div className="risk-figure">
            <strong>{result.risk_pct}%</strong>
            <span className={`pill ${LEVEL_TONE[result.level]}`}>
              {result.level.charAt(0).toUpperCase() + result.level.slice(1)} risk
            </span>
          </div>
          <div className="risk-detail">
            <p>
              <b>{result.times_average}×</b> the US average ({result.average_pct.toFixed(1)}%)
              {result.route_history_pct != null && ` · Route history: ${result.route_history_pct}%`}
            </p>
            {result.raises.length > 0 && (
              <p className="risk-chips">
                Raises risk:{" "}
                {result.raises.map((r) => (
                  <span key={r} className="pill red">
                    {r}
                  </span>
                ))}
              </p>
            )}
            {result.lowers.length > 0 && (
              <p className="risk-chips">
                Lowers risk:{" "}
                {result.lowers.map((r) => (
                  <span key={r} className="pill green">
                    {r}
                  </span>
                ))}
              </p>
            )}
            <p className="fine">{result.explanation}</p>
            {!result.month_in_training && (
              <p className="fine">
                Seasonal effect not included for this month (the model was trained on January, July
                and October).
              </p>
            )}
          </div>
        </div>
      )}
      <p className="fine mt12">
        Trained on {o.model.trained_on}. AUC {o.model.auc_model} vs {o.model.auc_route_baseline} for
        the route's history; the riskiest 10% of flights have {o.model.top_decile_lift_model}× the
        average disruption rate.
      </p>
    </div>
  );
}
