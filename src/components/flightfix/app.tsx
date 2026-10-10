import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Bot,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
  RadioTower,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { DATA_STALE_TIME, OPS_POLL_INTERVAL, recoveryProgress } from "@/lib/recovery-policy";
import { fetchOps, type OpsData, type RecoveryStatus } from "@/lib/flightfix";
import {
  CancelFlightDialog,
  DemoControls,
  RiskCheckCard,
  SendEmailDialog,
  SendLinkButton,
} from "./operations";
import {
  awaitingPassengers,
  clampSidebar,
  DEFAULT_ZONE,
  deliveryStats,
  finalizeBatch,
  sampleBatch,
  templateText,
  type Batch,
  type Channel,
} from "@/lib/demo-notifications";
import { Button, Chevron, Icon, Logo } from "./primitives";
import { AssistantChat, PassengerContent, TripError, usePassenger } from "./passenger";

export type Page = "ops" | "passengers" | "assistant" | "settings" | "live";
const NAV = [
  ["ops", LayoutDashboard, "Operations", "/"],
  ["passengers", Users, "Passengers", "/passengers"],
  ["assistant", Bot, "Assistant", "/assistant"],
  ["live", RadioTower, "Live board", "/live"],
  ["settings", SettingsIcon, "Settings", "/settings"],
] as const;
const ZONES = [
  ["America/New_York", "New York"],
  ["America/Chicago", "Chicago"],
  ["America/Denver", "Denver"],
  ["America/Los_Angeles", "Los Angeles"],
  ["Europe/London", "London"],
  ["Europe/Paris", "Paris"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Tokyo", "Tokyo"],
  ["UTC", "UTC"],
];
const STATUS: Record<RecoveryStatus, [string, string]> = {
  scheduled: ["Scheduled", "gray"],
  waiting: ["Awaiting choice", "blue"],
  rebooked: ["Rebooked", "green"],
  refund_pending: ["Refund pending", "amber"],
  needs_help: ["Needs help", "red"],
};
type Modal = { kind: string; flightId?: string; booking?: string; mode?: string };
type AppState = {
  d: OpsData | undefined;
  selected: string;
  select: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  batches: Batch[];
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  zone: string;
  setZone: (s: string) => void;
  auto: boolean;
  setAuto: (s: boolean) => void;
  modal: Modal | null;
  open: (m: Modal | null) => void;
  draft: string;
  setDraft: (s: string) => void;
  channel: Channel;
  setChannel: (s: Channel) => void;
};
const Context = createContext<AppState | null>(null);
function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("FlightFix shell required");
  return c;
}
const formatTime = (t: string | Date, zone: string, seconds = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  }).format(new Date(t));
const zoneAbbr = (zone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
function StatusPill({ status }: { status: RecoveryStatus }) {
  const [label, color] = STATUS[status];
  return <span className={`pill ${color}`}>{label}</span>;
}
function RiskPill({ risk }: { risk: string }) {
  return (
    <span
      className={`pill ${risk === "high" ? "red" : risk === "medium" ? "amber" : risk === "low" ? "yellow" : "gray"}`}
    >
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}
export function FlightFixShell({ page, children }: { page: Page; children: ReactNode }) {
  const navigate = useNavigate();
  const [width, setWidth] = useState(220),
    expanded = useRef(220),
    [search, setSearch] = useState(""),
    [zone, setZone] = useState(DEFAULT_ZONE),
    [auto, setAuto] = useState(true),
    [batches, setBatches] = useState<Batch[]>([sampleBatch()]),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState(""),
    [channel, setChannel] = useState<Channel>("sms"),
    [modal, open] = useState<Modal | null>(null),
    [now, setNow] = useState<Date | null>(null);
  const q = useQuery({
    queryKey: ["ops"],
    queryFn: fetchOps,
    refetchInterval: auto && page === "ops" ? OPS_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: DATA_STALE_TIME,
    retry: 1,
  });
  useEffect(() => {
    try {
      setWidth(clampSidebar(Number(localStorage.getItem("ff-sidebar-width")) || 220));
      expanded.current = Number(localStorage.getItem("ff-sidebar-expanded")) || 220;
      setZone(localStorage.getItem("ff-timezone") || DEFAULT_ZONE);
      setAuto(localStorage.getItem("ff-auto-refresh") !== "false");
      const composer = sessionStorage.getItem("ff-composer");
      if (composer) {
        const c = JSON.parse(composer);
        setSelected(c.selected || "");
        setDraft(c.draft || "");
        setChannel(c.channel || "sms");
        setSearch(c.search || "");
      }
      const saved = localStorage.getItem("ff-message-history");
      if (saved) setBatches(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
    document.body.classList.toggle("sidebar-compact", width < 152);
    if (width > 155) expanded.current = width;
    if (ready)
      try {
        localStorage.setItem("ff-sidebar-width", String(width));
        localStorage.setItem("ff-sidebar-expanded", String(expanded.current));
      } catch {}
    return () => {
      document.body.classList.remove("sidebar-compact");
    };
  }, [width, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("ff-message-history", JSON.stringify(batches));
        localStorage.setItem("ff-timezone", zone);
        localStorage.setItem("ff-auto-refresh", String(auto));
      } catch {}
  }, [batches, zone, auto, ready]);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (!batches.some((b) => b.pending)) return;
    const i = setTimeout(
      () => setBatches((bs) => bs.map((b) => (b.pending ? finalizeBatch(b) : b))),
      3000,
    );
    return () => clearTimeout(i);
  }, [batches]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem("ff-composer", JSON.stringify({ selected, draft, channel, search }));
      } catch {}
  }, [ready, selected, draft, channel, search]);
  const select = (id: string) => {
    setSelected(id);
    const f = q.data?.flights.find((f) => f.flight_no === id);
    setDraft(
      f && f.status !== "scheduled"
        ? templateText(f.status === "cancelled" ? "recovery" : "delay", f)
        : "",
    );
  };
  useEffect(() => {
    if (ready && q.data && !selected) {
      const f = q.data.flights.find((f) => f.status === "cancelled") ?? q.data.flights[0];
      if (f) select(f.flight_no);
    }
  }, [ready, q.data, selected]);
  const resizing = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add("sidebar-resizing");
  };
  const value = {
    d: q.data,
    selected,
    select,
    search,
    setSearch,
    batches,
    setBatches,
    zone,
    setZone,
    auto,
    setAuto,
    modal,
    open,
    draft,
    setDraft,
    channel,
    setChannel,
  };
  return (
    <Context.Provider value={value}>
      <a className="skip" href="#main-heading">
        Skip to content
      </a>
      <aside className="sidebar" id="sidebar" aria-label="Primary sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <Logo />
            <span>FlightFix</span>
          </div>
          <Button
            className="sidebar-toggle"
            aria-label={width < 152 ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="sidebar"
            aria-expanded={width >= 152}
            title={width < 152 ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setWidth(width < 152 ? expanded.current : 72)}
          >
            <span className="toggle-close">
              <ChevronsLeft className="sidebar-lucide" size={18} strokeWidth={1.75} />
            </span>
            <span className="toggle-open">
              <ChevronsRight className="sidebar-lucide" size={18} strokeWidth={1.75} />
            </span>
          </Button>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {NAV.map(([id, NavIcon, name, path]) => (
            <Button
              key={id}
              className={`${id === "settings" ? "settings-item" : ""} ${page === id ? "active" : ""}`}
              aria-label={name}
              title={name}
              onClick={() => navigate({ to: path })}
            >
              <NavIcon className="sidebar-lucide" size={18} strokeWidth={1.75} />
              <span className="nav-label">{name}</span>
            </Button>
          ))}
        </nav>
        <div
          className="sidebar-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={72}
          aria-valuemax={252}
          aria-valuenow={width}
          title="Drag to resize sidebar (or use arrow keys)"
          onPointerDown={resizing}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) setWidth(clampSidebar(e.clientX));
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            document.body.classList.remove("sidebar-resizing");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setWidth(clampSidebar(width + (e.key === "ArrowRight" ? 10 : -10)));
            }
          }}
        />
      </aside>
      <div className="layout">
        <header className="topbar">
          <label className="top-search">
            <Icon name="search" />
            <span className="sr-only">Search flights, airports or passengers</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flights, passengers, or airports…"
              autoComplete="off"
            />
          </label>
          <span className="demo-badge">Demo data</span>
          <div className="top-right">
            <div className="refresh-status">
              <span className="fine">
                Updated {q.data?.generated_at ? formatTime(q.data.generated_at, zone) : "—"}
              </span>
              <Button
                className="icon-btn"
                title="Refresh live data"
                aria-label="Refresh live data"
                disabled={q.isFetching}
                onClick={() => q.refetch()}
              >
                <Icon name="refresh" className={q.isFetching ? "refreshing" : ""} />
              </Button>
            </div>
            <Button
              className="clock-btn"
              aria-label="Live clock and time-zone settings"
              onClick={() => navigate({ to: "/settings" })}
            >
              <span className="dot" />
              <span className="clock-city">{ZONES.find((z) => z[0] === zone)?.[1]} ·</span>
              <time dateTime={now?.toISOString()}>{now ? formatTime(now, zone, true) : "—"}</time>
              <span>{zoneAbbr(zone)}</span>
            </Button>
            <div className="profile">
              <span className="avatar">AP</span>
              <span className="profile-text">
                <strong>Alex Park</strong>
                <small>Operations Lead</small>
              </span>
            </div>
          </div>
        </header>
        <main className="main">
          {q.isError && (
            <div className="notice red error-banner" role="alert">
              <Icon name="warning" />
              <span>Couldn't load operations data. {q.error.message}</span>
              <Button className="link-btn" onClick={() => q.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {!q.data ? <p className="fine">Loading live data…</p> : children}
          <footer className="main-footer">
            <span>
              Synthetic demo data · Live n8n backend · No real tickets, payments or messages.
            </span>
          </footer>
        </main>
      </div>
      {modal && <AppModal />}
      <Toaster position="bottom-center" richColors closeButton />
    </Context.Provider>
  );
}
function Title({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="page-title">
      <h1 id="main-heading" tabIndex={-1}>
        {children}
      </h1>
      {extra}
    </div>
  );
}
function Metrics() {
  const a = useApp();
  if (!a.d) return null;
  const s = deliveryStats(a.batches),
    risk = a.d.flights.filter((f) => f.risk_level !== "normal").length;
  const cards = [
    ["risk", risk, "Flights At Risk", "airplane", "red", "Review historical signals"],
    [
      "notify",
      awaitingPassengers(a.d, a.batches).length,
      "Passengers to Notify",
      "people",
      "orange",
      "",
    ],
    [
      "delivery",
      s.rate === null ? "—" : s.rate + "%",
      "Notification Delivery",
      "shield",
      "green",
      "",
    ],
    [
      "help",
      a.d.summary.needs_help + a.d.passengers.filter((p) => p.follow_up).length,
      "Passengers Needing Help",
      "help",
      "red",
      "",
    ],
  ];
  return (
    <div className="metrics" aria-label="Operations overview">
      {cards.map(([id, n, l, ic, c, note]) => (
        <Button
          className="metric"
          key={id}
          onClick={() => {
            if (id === "risk") {
              const f = a.d?.flights.find((f) => f.risk_level !== "normal");
              if (f) a.open({ kind: "flight", flightId: f.flight_no });
            } else a.open({ kind: String(id) });
          }}
        >
          <span className={`metric-circle ${c}`}>
            <Icon name={String(ic)} />
          </span>
          <span className="metric-copy">
            <strong>{n}</strong>
            <span className="metric-label">{l}</span>
            {note && <span className="metric-note">{note}</span>}
          </span>
          <Chevron />
        </Button>
      ))}
    </div>
  );
}
function FlightTable({ full = false }: { full?: boolean }) {
  const a = useApp(),
    [filter, setFilter] = useState("all"),
    [showAll, setShowAll] = useState(false);
  if (!a.d) return null;
  const q = a.search.toLowerCase();
  const all = a.d.flights,
    watch = all.filter((f) => f.risk_level !== "normal").length;
  const items = all.filter(
    (f) =>
      (filter === "all" ||
        (filter === "watch" ? f.risk_level !== "normal" : f.risk_level === "normal")) &&
      `${f.flight_no} ${f.origin} ${f.destination} ${a.d?.passengers
        .filter((p) => p.flight_no === f.flight_no)
        .map((p) => p.name + " " + p.booking_ref)
        .join(" ")}`
        .toLowerCase()
        .includes(q),
  );
  const shown = full || showAll ? items : items.slice(0, 5);
  return (
    <>
      <div className="card-head">
        <div className="section-title">
          <Icon name="airplane" />
          <h2>{full ? "Flight Monitor" : "Flights Under Watch"}</h2>
        </div>
        <div className="segmented" aria-label="Flight filters">
          {[
            ["all", "All", all.length],
            ["watch", "At Risk", watch],
            ["normal", "Normal", all.length - watch],
          ].map(([id, l, n]) => (
            <Button
              key={id}
              className={`${filter === id ? "active" : ""} ${id === "watch" ? "watch" : ""}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(String(id))}
            >
              {l}
              <span className="num">{n}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="flight-table">
          <thead>
            <tr>
              {[
                "Risk",
                "Flight",
                "Route",
                "Scheduled",
                "Est. risk",
                "Issue",
                "Status",
                "Details",
              ].map((h) => (
                <th key={h} scope="col">
                  {h === "Details" ? <span className="sr-only">Details</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr
                key={f.flight_no}
                className={a.selected === f.flight_no ? "selected" : ""}
                onClick={() => a.select(f.flight_no)}
              >
                <td className="risk-cell">
                  <RiskPill risk={f.risk_level} />
                </td>
                <td>
                  <Button className="flight-code" onClick={() => a.select(f.flight_no)}>
                    {f.flight_no}
                  </Button>
                </td>
                <td>
                  <span className="flight-route">
                    {f.origin}
                    <Icon name="arrow" />
                    {f.destination}
                  </span>
                </td>
                <td className="mono">{f.departs}</td>
                <td className={`delay ${f.risk_level === "normal" ? "normal" : ""}`}>
                  {f.est_risk_pct}%
                </td>
                <td className="signal-cell">{f.risk_signal}</td>
                <td className="status-cell">
                  <span
                    className={`pill ${f.status === "cancelled" ? "red" : f.status === "delayed" ? "amber" : "blue"}`}
                  >
                    {f.status === "cancelled"
                      ? "Recovery open"
                      : f.status === "delayed"
                        ? "Delay confirmed"
                        : "Monitoring"}
                  </span>
                  {f.status === "cancelled" && (
                    <div className="recovery-progress">
                      <small>
                        {f.resolved} of {f.passengers} resolved
                      </small>
                      <progress
                        aria-label={`${f.flight_no} recovery progress`}
                        max={100}
                        value={recoveryProgress(f.resolved, f.passengers)}
                      />
                    </div>
                  )}
                </td>
                <td className="row-action">
                  <Button
                    className="icon-btn"
                    aria-label={`Open ${f.flight_no} details`}
                    onClick={(e) => {
                      e.stopPropagation();
                      a.open({ kind: "flight", flightId: f.flight_no });
                    }}
                  >
                    <Icon name="more" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty">
            <Icon name="search" />
            <strong>No matching flights</strong>Try a flight, route, passenger name or booking
            reference.
            <br />
            <Button className="link-btn mt12" onClick={() => a.setSearch("")}>
              Clear search
            </Button>
          </div>
        )}
      </div>
      <div className="table-bottom">
        <span>
          Showing {shown.length} of {items.length} flights
          <span className="demo-date">Demo schedule · {all[0]?.date}</span>
        </span>
        {!full && items.length > 5 ? (
          <Button className="link-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? "View less" : "View more"} <Icon name="arrow" />
          </Button>
        ) : (
          <span className="fine">Airport-local time</span>
        )}
      </div>
    </>
  );
}
function Activity({ full = false, assistant = false }: { full?: boolean; assistant?: boolean }) {
  const a = useApp();
  const events = [
    ...(a.d?.activity ?? []),
    ...(assistant
      ? []
      : a.batches
          .filter((b) => !b.syntheticHistory)
          .map((b) => ({
            time: b.createdAt,
            type: "message",
            title: `${b.pending ? "Queued notification" : "Simulated notification"} · ${b.flightId}`,
            booking_ref: "",
            flight_no: b.flightId,
          }))),
  ].sort((a, b) => +new Date(b.time) - +new Date(a.time));
  return (
    <ol className={`activity-list ${full ? "full" : ""}`}>
      {(full ? events : events.slice(0, 4)).map((e, i) => (
        <li key={i}>
          <span className={`dot demo-dot ${e.type}`} />
          <strong>
            {e.title}
            {full && (
              <span className="detail">
                {e.booking_ref} · {e.flight_no}
              </span>
            )}
          </strong>
          <time dateTime={e.time}>{formatTime(e.time, a.zone)}</time>
        </li>
      ))}
      {!events.length && (
        <li className="activity-empty">
          <Icon name="clock" />
          <span>Activity appears here as passengers rebook, request refunds or ask for help</span>
        </li>
      )}
    </ol>
  );
}
function Composer() {
  const a = useApp();
  const f = a.d?.flights.find((f) => f.flight_no === a.selected);
  if (!f || !a.d) return null;
  const n = awaitingPassengers(a.d, a.batches, f.flight_no).length,
    limit = a.channel === "sms" ? 480 : 2000;
  return (
    <div className="composer-body">
      <div className="composer-context">
        <label className="sr-only" htmlFor="composer-flight">
          Flight to notify
        </label>
        <select
          className="context-flight"
          id="composer-flight"
          value={a.selected}
          onChange={(e) => a.select(e.target.value)}
        >
          {a.d.flights.map((f) => (
            <option key={f.flight_no} value={f.flight_no}>
              {f.flight_no} · {f.origin} → {f.destination}
            </option>
          ))}
        </select>
        <span className="context-recipients">
          {f.status !== "scheduled" ? "Draft prepared from confirmed status · " : ""}
          {n} awaiting update · {a.d.passengers.filter((p) => p.flight_no === f.flight_no).length}{" "}
          passengers
        </span>
      </div>
      <div className="composer-tools">
        <div className="channel-tabs" role="tablist" aria-label="Notification channel">
          {(["sms", "email", "app"] as const).map((c) => (
            <Button
              className={a.channel === c ? "active" : ""}
              role="tab"
              aria-selected={a.channel === c}
              key={c}
              onClick={() => a.setChannel(c)}
            >
              {c === "sms" ? "SMS" : c === "email" ? "Email" : "In-App"}
            </Button>
          ))}
        </div>
        <div className="templates" aria-label="Message templates">
          {[
            ["delay", "Delay Update"],
            ["recovery", "Recovery Options"],
            ["general", "General Update"],
          ].map(([k, l]) => (
            <Button
              className="template"
              key={k}
              disabled={k === "recovery" && f.status !== "cancelled"}
              onClick={() => a.setDraft(templateText(k ?? "general", f).slice(0, limit))}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="message-box" role="tabpanel">
        <label className="sr-only" htmlFor="message-text">
          Message for passengers on {f.flight_no}
        </label>
        <textarea
          id="message-text"
          maxLength={limit}
          value={a.draft}
          onChange={(e) => a.setDraft(e.target.value)}
          placeholder="Choose a template to prepare a draft from verified flight data…"
        />
        <div className="message-bottom">
          <span className="char-count">
            {a.draft.length}/{limit}
          </span>
          <Button
            className="btn primary"
            disabled={!a.draft.trim() || !n || a.draft.length > limit}
            onClick={() => a.open({ kind: "send", flightId: f.flight_no })}
          >
            <Icon name="plane" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
export function FlightFixPage({ page }: { page: Page }) {
  return (
    <FlightFixShell page={page}>
      <PageBody page={page} />
    </FlightFixShell>
  );
}
function PageBody({ page }: { page: Page }) {
  const a = useApp();
  if (!a.d) return null;
  if (page === "ops")
    return (
      <>
        <Title>Operations</Title>
        <div id="metrics">
          <Metrics />
        </div>
        <section className="card" aria-label="Monitored flights">
          <FlightTable />
        </section>
        <RiskCheckCard />
        <div className="lower-grid">
          <section className="card activity-card">
            <div className="card-head">
              <div className="section-title">
                <Icon name="clock" />
                <h2>Recent Activity</h2>
              </div>
              <Button className="link-btn" onClick={() => a.open({ kind: "activity" })}>
                View more <Icon name="arrow" />
              </Button>
            </div>
            <Activity />
          </section>
          <section className="card communication-card" id="communication">
            <div className="card-head">
              <div className="section-title">
                <Icon name="mail" />
                <h2>Notification Center</h2>
              </div>
              <Button
                className="link-btn"
                onClick={() => a.open({ kind: "preview", mode: "message" })}
              >
                <Icon name="external" />
                Preview passenger view
              </Button>
            </div>
            <Composer />
          </section>
        </div>
      </>
    );
  if (page === "passengers") return <Passengers />;
  if (page === "assistant") return <Assistant />;
  return <Settings />;
}
function Passengers() {
  const a = useApp(),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const pax =
    a.d?.passengers.filter(
      (p) =>
        p.flight_no === a.selected &&
        (filter === "all" || p.recovery_status === filter) &&
        `${p.name} ${p.booking_ref} ${p.flight_no}`.toLowerCase().includes(search.toLowerCase()) &&
        `${p.name} ${p.booking_ref} ${p.flight_no}`.toLowerCase().includes(a.search.toLowerCase()),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(pax.length / 10)),
    current = Math.min(page, pages),
    shown = pax.slice((current - 1) * 10, current * 10);
  return (
    <>
      <Title>Passengers</Title>
      <section className="card">
        <div className="card-head">
          <div className="section-title">
            <Icon name="people" />
            <h2>Passenger Recovery</h2>
          </div>
          <Button
            className="link-btn"
            onClick={() => a.open({ kind: "flight", flightId: a.selected })}
          >
            {a.selected} details <Icon name="arrow" />
          </Button>
        </div>
        <div className="filters">
          <select
            className="field"
            aria-label="Flight"
            value={a.selected}
            onChange={(e) => {
              a.select(e.target.value);
              setPage(1);
            }}
          >
            {a.d?.flights.map((f) => (
              <option key={f.flight_no} value={f.flight_no}>
                {f.flight_no} · {f.origin} → {f.destination}
              </option>
            ))}
          </select>
          <select
            className="field"
            aria-label="Recovery status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <input
            className="field grow"
            aria-label="Search passengers"
            type="search"
            placeholder="Search passengers or bookings…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="table-wrap">
          <table className="flight-table">
            <thead>
              <tr>
                {["Passenger", "Booking", "Status", "Outcome", "Actions"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.booking_ref}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.booking_ref}</td>
                  <td>
                    <StatusPill status={p.recovery_status} />
                    {p.notified_at && p.notified_flight === p.flight_no && (
                      <small className="emailed-note">
                        Emailed {formatTime(p.notified_at, a.zone)}
                      </small>
                    )}
                  </td>
                  <td>
                    {p.outcome ?? "—"}
                    {p.follow_up ? " · follow-up requested" : ""}
                  </td>
                  <td>
                    <Button
                      className="link-btn"
                      onClick={() => a.open({ kind: "case", booking: p.booking_ref })}
                    >
                      Review <Icon name="right" />
                    </Button>
                    <Link
                      className="icon-btn"
                      title="Open page"
                      aria-label={`Open page for ${p.name}`}
                      to="/recover/$token"
                      params={{ token: p.link_token }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="external" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="empty">
              <strong>No passengers match.</strong>Choose another status or clear your search.
            </div>
          )}
        </div>
        <div className="table-bottom">
          <span>
            {shown.length ? (current - 1) * 10 + 1 : 0}–{Math.min(current * 10, pax.length)} of{" "}
            {pax.length} passengers · {a.selected}
          </span>
          <div className="flex gap12">
            <Button
              className="icon-btn"
              aria-label="Previous passengers"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <Icon name="left" />
            </Button>
            <span>
              {current} / {pages}
            </span>
            <Button
              className="icon-btn"
              aria-label="Next passengers"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <Icon name="right" />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
function Workflow() {
  const node = (x: number, y: number, title: string, sub: string, w = 174, kind = "") => (
    <g key={title}>
      <rect
        className={`workflow-node ${kind}`}
        x={x}
        y={y}
        width={w}
        height={62}
        rx={8}
        strokeWidth={1.3}
      />
      <text
        className="workflow-title"
        x={x + w / 2}
        y={y + 25}
        textAnchor="middle"
        fontSize={12}
        fontWeight={650}
      >
        {title}
      </text>
      <text
        className="workflow-subtitle"
        x={x + w / 2}
        y={y + 44}
        textAnchor="middle"
        fontSize={10}
      >
        {sub}
      </text>
    </g>
  );
  return (
    <svg
      className="workflow-svg"
      viewBox="0 0 1260 480"
      role="img"
      aria-label="Live n8n recovery workflow: Chat Trigger, verify passenger, confirmation Switch, atomic commit and Gmail, withdrawal, or gpt-5-mini with Recovery Backend tools"
    >
      <defs>
        <marker
          id="wf-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10Z" className="workflow-node" />
        </marker>
      </defs>
      {[
        "M184 191 H214",
        "M428 191 H458",
        "M652 176 H676 V51 H706",
        "M880 51 H910",
        "M1084 51 H1120 V191 H1140",
        "M652 191 H706",
        "M946 191 H1140",
        "M652 206 H676 V321 H706",
        "M946 321 H1120 V191 H1140",
      ].map((d) => (
        <path
          key={d}
          d={d}
          className="workflow-line"
          strokeWidth={1.4}
          markerEnd="url(#wf-arrow)"
        />
      ))}
      {node(10, 160, "Chat message", "Chat Trigger", 174, "output")}
      {node(214, 160, "Verify passenger", "link token OR booking ref + last name", 214)}
      {node(458, 160, "Confirmation gate", "Switch · no model", 194, "gate")}
      {node(706, 20, "Commit in Recovery Backend", "compare-and-set on seats", 174, "write")}
      {node(910, 20, "Email confirmation", "Gmail", 174, "output")}
      {node(706, 160, "Withdraw or expire proposal", "Recovery Backend", 240)}
      {node(706, 290, "AI Agent", "gpt-5-mini · memory 12 messages", 240, "agent")}
      {node(1140, 160, "Respond", "Chat reply", 110, "output")}
      {[
        ["YES", 665, 37],
        ["NO / expired", 658, 145],
        ["anything else", 660, 274],
      ].map(([t, x, y]) => (
        <text key={t} x={Number(x)} y={Number(y)} fontSize={10} className="workflow-subtitle">
          {t}
        </text>
      ))}
      {node(612, 394, "4 READ tools", "booking · status · options · refund", 230, "read")}
      {node(872, 394, "3 WRITE tools", "stage only", 230, "write")}
      <path
        d="M826 352 V375 H727 V394 M826 375 H987 V394"
        className="workflow-line"
        strokeDasharray="3 3"
      />
      <text x={856} y={476} textAnchor="middle" fontSize={11} className="workflow-subtitle">
        All tools: Recovery Backend workflow · n8n Data Tables
      </text>
    </svg>
  );
}
function Assistant() {
  const a = useApp();
  if (!a.d) return null;
  const cards = [
    ["Actions confirmed", a.d.summary.rebooked + a.d.summary.refund_pending, "check", "green"],
    ["Handed to staff", a.d.help_cases.length, "help", "orange"],
    [
      "Offers declined or expired",
      a.d.activity.filter((e) => e.type === "declined" || e.type === "expired").length,
      "chat",
      "green",
    ],
    ["Sold-out blocks", a.d.activity.filter((e) => e.type === "blocked").length, "shield", "red"],
  ];
  const tools = [
    ["read", "get_booking", "Booking, passenger and outcome for the linked booking only."],
    ["read", "get_flight_status", "Confirmed status, reason and airport-local times."],
    [
      "read",
      "search_alternatives",
      "Up to 3 nonstop same-route options with seats, earliest arrival first. Optional time limit.",
    ],
    ["read", "get_refund_quote", "Refund amount from code rules. The LLM never calculates it."],
    [
      "write",
      "book_replacement_flight",
      "Stages a booking. Commits only after the passenger replies YES.",
    ],
    [
      "write",
      "request_refund",
      "Stages a refund request. Commits only after YES. Never pays money.",
    ],
    [
      "write",
      "create_help_case",
      "Stages a staff handoff in Recovery Backend. The confirmation gate controls commitment.",
    ],
  ];
  return (
    <>
      <Title
        extra={
          <Button
            className="btn compact"
            onClick={() => a.open({ kind: "preview", mode: "assistant" })}
          >
            <Icon name="chat" />
            Try it as a passenger
          </Button>
        }
      >
        Recovery Assistant
      </Title>
      <div className="agent-metrics">
        {cards.map(([l, n, ic, c]) => (
          <div className="metric" key={l}>
            <span className={`metric-circle ${c}`}>
              <Icon name={String(ic)} />
            </span>
            <span className="metric-copy">
              <strong>{n}</strong>
              <span className="metric-label">{l}</span>
            </span>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="card-head">
          <div className="section-title">
            <Icon name="bot" />
            <h2>Workflow</h2>
          </div>
          <span className="fine">Built in n8n · live</span>
        </div>
        <div className="wf-wrap">
          <Workflow />
        </div>
        <div className="wf-legend">
          <span>
            <i className="workflow-node" />
            Hardcoded: same result every time
          </span>
          <span>
            <i className="workflow-node agent" />
            LLM decides: language and tool choice
          </span>
          <span>
            <i className="workflow-node gate" />
            Decision node
          </span>
          <span>
            <i className="workflow-node write" />
            Has real consequences
          </span>
        </div>
      </section>
      <div className="tool-grid">
        <section className="card">
          <div className="card-head">
            <div className="section-title">
              <Icon name="tool" />
              <h2>Tools</h2>
            </div>
            <span className="fine">Booking ID comes from the verified link, not the LLM</span>
          </div>
          <ul className="tool-list">
            {tools.map(([k, n, d]) => (
              <li key={n}>
                <span className={`tag ${k}`}>{(k ?? "read").toUpperCase()}</span>
                <code>{n}</code>
                <p>{d}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head">
            <div className="section-title">
              <Icon name="clock" />
              <h2>Recent assistant activity</h2>
            </div>
            <span className="fine">Live activity feed</span>
          </div>
          <Activity full assistant />
        </section>
      </div>
    </>
  );
}
function Settings() {
  const a = useApp();
  return (
    <>
      <Title>Settings</Title>
      <div className="section-grid">
        <section className="card panel-pad">
          <h2>Display & Monitoring</h2>
          <div className="settings-row">
            <div>
              <strong>Display time zone</strong>
              <p>
                The live clock and activity log use this zone. Passenger tickets and flight tables
                show each airport’s local time.
              </p>
            </div>
            <select
              className="field settings-zone"
              aria-label="Display time zone"
              value={a.zone}
              onChange={(e) => a.setZone(e.target.value)}
            >
              {ZONES.map(([z, n]) => (
                <option key={z} value={z}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <strong>Auto-refresh dashboard every 60 seconds</strong>
              <p>Refresh live operations data while this tab is visible.</p>
            </div>
            <Button
              className={`toggle ${a.auto ? "on" : ""}`}
              role="switch"
              aria-checked={a.auto}
              aria-label="Auto-refresh dashboard every 60 seconds"
              onClick={() => a.setAuto(!a.auto)}
            />
          </div>
          <Button className="btn mt16" onClick={() => a.open({ kind: "clear-history" })}>
            <Icon name="refresh" />
            Clear simulated message history
          </Button>
        </section>
        <DemoControls />
      </div>
    </>
  );
}
function AppModal() {
  const a = useApp(),
    ref = useRef<HTMLDialogElement>(null);
  const m = a.modal;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  if (!m) return null;
  const f = a.d?.flights.find((f) => f.flight_no === (m.flightId ?? a.selected)),
    p = a.d?.passengers.find((p) => p.booking_ref === m.booking);
  let title = "",
    subtitle = "",
    body: ReactNode = null,
    actions: ReactNode = <Button onClick={() => a.open(null)}>Close</Button>;
  if (m.kind === "preview")
    return (
      <dialog
        ref={ref}
        aria-labelledby="dialog-title"
        className="preview"
        onCancel={(e) => {
          e.preventDefault();
          a.open(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) a.open(null);
        }}
      >
        <Preview m={m} />
      </dialog>
    );
  const custom = (content: ReactNode) => (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        a.open(null);
      }}
    >
      {content}
    </dialog>
  );
  if (m.kind === "cancel" && f)
    return custom(
      <CancelFlightDialog
        flight={f}
        onClose={() => a.open(null)}
        onCancelled={(flightNo) => {
          a.select(flightNo);
          a.setChannel("email");
          a.setDraft(templateText("recovery", { ...f, status: "cancelled" }));
          a.open(null);
          document.getElementById("communication")?.scrollIntoView({ behavior: "smooth" });
        }}
      />,
    );
  if (m.kind === "send" && f && a.d && a.channel === "email")
    return custom(
      <SendEmailDialog
        flight={f}
        recipients={awaitingPassengers(a.d, a.batches, f.flight_no).length}
        draft={a.draft}
        onClose={() => a.open(null)}
      />,
    );
  if (m.kind === "flight" && f) {
    title = `${f.flight_no} · ${f.origin} → ${f.destination}`;
    subtitle = "Northstar Air · Fictional flight";
    body = (
      <>
        <div className="flight-ticket">
          <div className="flex between gap8">
            <strong>
              {f.flight_no} · {f.origin} → {f.destination}
            </strong>
            <span
              className={`pill ${f.status === "cancelled" ? "red" : f.status === "delayed" ? "amber" : "gray"}`}
            >
              {f.status}
            </span>
          </div>
          <div className="times">
            <div>
              <strong>{f.departs}</strong>
            </div>
            <Icon name="arrow" />
            <div className="ticket-end">
              <strong>{f.arrives}</strong>
            </div>
          </div>
          <p className="fine mt8">{f.date} · Northstar Air · Nonstop</p>
        </div>
        <div className="kv mt12">
          <span>Historical sample risk</span>
          <RiskPill risk={f.risk_level} />
        </div>
        <div className="kv">
          <span>Est. chance of cancellation or 3h+ delay</span>
          <strong>{f.est_risk_pct}% · illustrative</strong>
        </div>
        <div className="kv">
          <span>Signal</span>
          <strong>{f.risk_signal}</strong>
        </div>
        <div className="kv">
          <span>Confirmed reason</span>
          <strong>{f.reason ?? "No disruption confirmed"}</strong>
        </div>
        <div className="kv">
          <span>Passengers</span>
          <strong>{f.passengers}</strong>
        </div>
        <div className="kv">
          <span>Recovery choices recorded</span>
          <strong>
            {f.resolved} / {f.passengers}
          </strong>
        </div>
        <h3 className="mt16">Passengers</h3>
        {a.d?.passengers
          .filter((p) => p.flight_no === f.flight_no)
          .map((p) => (
            <div className="kv" key={p.booking_ref}>
              <span>
                {p.name} · {p.booking_ref}
              </span>
              <StatusPill status={p.recovery_status} />
            </div>
          ))}
        <h3 className="mt16">Replacement seats</h3>
        {a.d?.replacement_seats
          .filter((r) => r.replaces_flight === f.flight_no)
          .map((r) => (
            <div className="kv" key={r.flight_no}>
              <span>
                {r.flight_no} · {r.departs} → {r.arrives}
              </span>
              <strong>{r.seats_left} left</strong>
            </div>
          ))}
      </>
    );
    actions = (
      <>
        <Button onClick={() => a.open(null)}>Close</Button>
        {f.status !== "cancelled" && (
          <Button
            className="btn danger-outline"
            onClick={() => a.open({ kind: "cancel", flightId: f.flight_no })}
          >
            Cancel flight
          </Button>
        )}
        <Button
          className="btn primary"
          disabled={!a.d?.passengers.some((p) => p.flight_no === f.flight_no)}
          onClick={() => {
            a.select(f.flight_no);
            a.open({ kind: "preview", mode: "recovery" });
          }}
        >
          Preview recovery <Icon name="arrow" />
        </Button>
      </>
    );
  } else if (m.kind === "case" && p) {
    title = p.name;
    subtitle = `${p.booking_ref} · ${p.flight_no}`;
    const h = a.d?.help_cases.find((h) => h.booking_ref === p.booking_ref);
    body = (
      <>
        <div className="kv">
          <span>Status</span>
          <StatusPill status={p.recovery_status} />
        </div>
        <div className="kv">
          <span>Outcome</span>
          <strong>{p.outcome ?? "—"}</strong>
        </div>
        {h && (
          <div className="notice amber mt16">
            <Icon name="help" />
            <span>
              <strong>{h.reason}</strong>
              <br />
              {h.note}
            </span>
          </div>
        )}
        {p.follow_up && (
          <div className="notice amber mt16">
            <Icon name="chat" />
            <span>
              <strong>Follow-up from Recovery Assistant</strong>
              <br />
              {p.follow_up}. The recorded outcome was not changed.
            </span>
          </div>
        )}
        <Link
          className="btn full mt16"
          to="/recover/$token"
          params={{ token: p.link_token }}
          target="_blank"
        >
          Open recovery page <Icon name="external" />
        </Link>
        {a.d?.flights.some((x) => x.flight_no === p.flight_no && x.status !== "scheduled") && (
          <SendLinkButton passenger={p} />
        )}
      </>
    );
    actions = (
      <>
        <Button onClick={() => a.open(null)}>Close</Button>
        <Button
          className="btn primary"
          onClick={() => {
            a.select(p.flight_no);
            a.open({ kind: "preview", booking: p.booking_ref, mode: "recovery" });
          }}
        >
          Preview as passenger <Icon name="arrow" />
        </Button>
      </>
    );
  } else if (m.kind === "send" && f && a.d) {
    title = "Review Passenger Notification";
    subtitle = `${f.flight_no} · ${a.channel === "sms" ? "SMS" : a.channel === "email" ? "Email" : "In-App"} · Simulated delivery`;
    const recipients = awaitingPassengers(a.d, a.batches, f.flight_no);
    body = (
      <>
        <div className="kv">
          <span>Recipients</span>
          <strong>{recipients.length} fictional passengers</strong>
        </div>
        <div className="kv">
          <span>Flight status</span>
          <strong>{f.status}</strong>
        </div>
        <div className="modal-message">{a.draft}</div>
        <div className="notice mt16">
          <Icon name="info" />
          <span>
            This only creates a simulated delivery batch. No email, SMS or push notification will
            leave this app.
          </span>
        </div>
      </>
    );
    actions = (
      <>
        <Button onClick={() => a.open(null)}>Cancel</Button>
        <Button
          className="btn primary"
          onClick={() => {
            a.setBatches((bs) => [
              ...bs,
              {
                id: crypto.randomUUID(),
                flightId: f.flight_no,
                flightStatus: f.status,
                channel: a.channel,
                recipientIds: recipients.map((p) => p.booking_ref),
                recipientCount: recipients.length,
                delivered: 0,
                failed: 0,
                pending: recipients.length,
                createdAt: new Date().toISOString(),
                text: a.draft,
              },
            ]);
            a.open(null);
          }}
        >
          Approve & send <Icon name="plane" />
        </Button>
      </>
    );
  } else if (m.kind === "activity") {
    title = "Recent Activity";
    subtitle = `Times in ${ZONES.find((z) => z[0] === a.zone)?.[1]} · latest first`;
    body = <Activity full />;
  } else if (m.kind === "help") {
    title = "Passengers Needing Help";
    body = (
      <>
        {a.d?.passengers
          .filter((p) => p.recovery_status === "needs_help" || p.follow_up)
          .map((p) => (
            <div className="kv" key={p.booking_ref}>
              <span>
                {p.name} · {p.follow_up ?? "Assistance requested"}
              </span>
              <Button
                className="link-btn"
                onClick={() => a.open({ kind: "case", booking: p.booking_ref })}
              >
                Review <Icon name="right" />
              </Button>
            </div>
          ))}
        {!a.d?.passengers.some((p) => p.recovery_status === "needs_help" || p.follow_up) && (
          <div className="empty">No one needs help right now.</div>
        )}
      </>
    );
  } else if (m.kind === "notify") {
    title = "Passengers to Notify";
    body = (
      <>
        {a.d &&
          awaitingPassengers(a.d, a.batches).map((p) => (
            <div className="kv" key={p.booking_ref}>
              <span>
                {p.name} · {p.flight_no}
              </span>
              <Button
                className="link-btn"
                onClick={() => {
                  a.select(p.flight_no);
                  a.open(null);
                }}
              >
                Prepare update <Icon name="arrow" />
              </Button>
            </div>
          ))}
      </>
    );
  } else if (m.kind === "delivery") {
    title = "Notification Delivery";
    const s = deliveryStats(a.batches);
    body = (
      <>
        <div className="kv">
          <span>Delivered</span>
          <strong>{s.delivered}</strong>
        </div>
        <div className="kv">
          <span>Failed</span>
          <strong>{s.failed}</strong>
        </div>
        <div className="kv">
          <span>Queued</span>
          <strong>{s.pending}</strong>
        </div>
        <p className="fine mt16">
          Simulated delivery · finalized items only. Includes the labelled historical example.
        </p>
      </>
    );
  } else if (m.kind === "clear-history") {
    title = "Clear simulated message history?";
    body = (
      <p>
        This removes only the message history in this browser. Live passenger bookings and recovery
        outcomes will not change.
      </p>
    );
    actions = (
      <>
        <Button onClick={() => a.open(null)}>Cancel</Button>
        <Button
          className="btn primary"
          onClick={() => {
            a.setBatches([]);
            a.open(null);
          }}
        >
          Clear history
        </Button>
      </>
    );
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        a.open(null);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) a.open(null);
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="dialog-title">{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Button className="icon-btn" aria-label="Close dialog" onClick={() => a.open(null)}>
          <Icon name="close" />
        </Button>
      </div>
      <div className="modal-body">{body}</div>
      <div className="modal-actions">{actions}</div>
    </dialog>
  );
}
function Preview({ m }: { m: Modal }) {
  const a = useApp(),
    [mode, setMode] = useState(m.mode ?? "message"),
    [booking, setBooking] = useState(m.booking ?? ""),
    [pending, setPending] = useState<string | undefined>();
  const people = a.d?.passengers.filter((p) => p.flight_no === a.selected) ?? [],
    p = people.find((p) => p.booking_ref === booking) ?? people[0],
    f = a.d?.flights.find((f) => f.flight_no === a.selected);
  const q = usePassenger(p?.link_token ?? "", mode !== "message");
  const [chatStarted, setChatStarted] = useState(mode === "assistant");
  useEffect(() => {
    if (mode === "assistant") setChatStarted(true);
  }, [mode]);
  return (
    <>
      <div className="modal-head">
        <div>
          <h2 id="dialog-title">Passenger Preview</h2>
          <p>
            {f?.flight_no} · {f?.origin} → {f?.destination}
          </p>
        </div>
        <Button className="icon-btn" aria-label="Close dialog" onClick={() => a.open(null)}>
          <Icon name="close" />
        </Button>
      </div>
      <div className="modal-body">
        <div className="preview-tools">
          <div className="segmented" aria-label="Passenger preview mode">
            {[
              ["message", "Message"],
              ["recovery", "Recovery page"],
              ["assistant", "Assistant"],
            ].map(([k, l]) => (
              <Button
                className={mode === k ? "active" : ""}
                key={k}
                aria-pressed={mode === k}
                onClick={() => setMode(k ?? "message")}
              >
                {l}
              </Button>
            ))}
          </div>
          <select
            className="field"
            aria-label="Preview as fictional passenger"
            value={p?.booking_ref ?? ""}
            onChange={(e) => {
              setBooking(e.target.value);
              setPending(undefined);
            }}
          >
            {people.map((p) => (
              <option key={p.booking_ref} value={p.booking_ref}>
                {p.name} · {p.booking_ref}
              </option>
            ))}
          </select>
        </div>
        {!p ? (
          <div className="empty">No passengers on this flight.</div>
        ) : mode === "message" ? (
          <div className="phone-shell">
            <div className="phone-screen">
              <div className="phone-status">
                <span>{formatTime(new Date(), a.zone)}</span>
                <span>{zoneAbbr(a.zone)}</span>
              </div>
              <div className="phone-brand">
                <Icon name="plane" />
                FlightFix
              </div>
              <div className="phone-body">
                <div className="message-sender">
                  {a.channel === "sms"
                    ? "SMS from Northstar Air"
                    : a.channel === "email"
                      ? "Email from Northstar Air"
                      : "FlightFix in-app update"}{" "}
                  · Demo
                </div>
                <div className="message-bubble">
                  {a.draft.trim() ||
                    "Choose a template in the Notification Center to preview the message here."}
                </div>
                {a.draft.trim() && (
                  <Button className="btn primary full mt20" onClick={() => setMode("recovery")}>
                    View flight details <Icon name="arrow" />
                  </Button>
                )}
                <p className="fine mt16">
                  Preview for {p.name} · {p.booking_ref}
                  <br />
                  No real notification is sent.
                </p>
              </div>
            </div>
          </div>
        ) : q.error ? (
          <TripError error={q.error} retry={() => q.refetch()} />
        ) : !q.data ? (
          <p className="fine">Loading your trip…</p>
        ) : (
          <>
            <div hidden={mode !== "recovery"}>
              <PassengerContent
                key={p.link_token}
                d={q.data}
                onAsk={(text) => {
                  setPending(text);
                  setMode("assistant");
                }}
              />
            </div>
            {chatStarted && (
              <div hidden={mode !== "assistant"}>
                <AssistantChat
                  key={p.link_token}
                  token={p.link_token}
                  d={q.data}
                  refreshOps
                  dataVersion={a.d?.data_version}
                  initialMessage={pending}
                  onConsumed={() => setPending(undefined)}
                />
              </div>
            )}
          </>
        )}
        <p className="file-note">
          Operator preview only. A real passenger would see only their own booking.
        </p>
      </div>
    </>
  );
}
