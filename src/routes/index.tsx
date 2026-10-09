import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ExternalLink, LayoutDashboard, LifeBuoy, Plane, RefreshCw, Search, Users,
} from "lucide-react";
import { fetchOps, timeAgo, type OpsData, type RecoveryStatus } from "@/lib/flightfix";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations — FlightFix" },
      { name: "description", content: "Live cancellation recovery dashboard for Northstar Air staff." },
      { property: "og:title", content: "Operations — FlightFix" },
      { property: "og:description", content: "Live cancellation recovery dashboard for Northstar Air staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ops,
});

const STATUS: Record<RecoveryStatus, { label: string; cls: string }> = {
  waiting: { label: "Waiting", cls: "pill-blue" },
  rebooked: { label: "Rebooked", cls: "pill-green" },
  refund_pending: { label: "Refund pending", cls: "pill-amber" },
  needs_help: { label: "Needs help", cls: "pill-red" },
  scheduled: { label: "Scheduled", cls: "pill-gray" },
};
const FLIGHT: Record<string, string> = { cancelled: "pill-red", delayed: "pill-amber", scheduled: "pill-gray" };
const DOT: Record<string, string> = {
  staged: "bg-info", rebooked: "bg-success", refund: "bg-warning", declined: "bg-muted-foreground",
  expired: "bg-muted-foreground", blocked: "bg-alert", help: "bg-destructive",
};

function Ops() {
  const q = useQuery({ queryKey: ["ops"], queryFn: fetchOps, refetchInterval: 60_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, staleTime: 5_000, retry: 1 });
  const d = q.data;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-5 md:flex">
        <div className="flex items-center gap-2 text-lg font-bold"><Plane className="h-5 w-5 text-primary" />FlightFix</div>
        <nav className="mt-8 space-y-1 text-sm">
          <a href="#operations" className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground"><LayoutDashboard className="h-4 w-4" />Operations</a>
          <a href="#passengers" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"><Users className="h-4 w-4" />Passengers</a>
          <a href="#help" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"><LifeBuoy className="h-4 w-4" />Help queue</a>
        </nav>
        <p className="mt-auto text-xs text-muted-foreground">Synthetic demo data</p>
      </aside>

      <main id="operations" className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-card/90 px-6 py-4 backdrop-blur">
          <h1 className="text-xl font-semibold">Operations</h1>
          <span className="pill pill-green"><span className="h-2 w-2 rounded-full bg-success" />Live</span>
          {d && <span className="text-sm text-muted-foreground">Updated {new Date(d.generated_at).toLocaleTimeString("en-US")}</span>}
          <button onClick={() => q.refetch()} disabled={q.isFetching} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />Refresh
          </button>
        </header>

        <div className="space-y-6 p-6">
          {q.isError && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="flex-1">Couldn't load operations data. {(q.error as Error).message}</span>
              <button onClick={() => q.refetch()} className="rounded-lg bg-destructive px-3 py-1 font-medium text-destructive-foreground">Retry</button>
            </div>
          )}
          {!d && q.isLoading && <p className="text-sm text-muted-foreground">Loading live data…</p>}
          {d && <Body d={d} />}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`ff-card p-5 ${danger ? "border-destructive/40" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function Body({ d }: { d: OpsData }) {
  const s = d.summary;
  const [filter, setFilter] = useState<RecoveryStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(i); }, []);

  const pax = useMemo(() => d.passengers.filter((p) =>
    (filter === "all" || p.recovery_status === filter) &&
    `${p.name} ${p.booking_ref} ${p.flight_no}`.toLowerCase().includes(search.toLowerCase())), [d, filter, search]);
  const activity = [...d.activity].sort((a, b) => +new Date(b.time) - +new Date(a.time));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Metric label="Passengers to recover" value={s.waiting} />
        <Metric label="Rebooked" value={s.rebooked} />
        <Metric label="Refund requested" value={s.refund_pending} />
        <Metric label="Needs help" value={s.needs_help} danger={s.needs_help > 0} />
        <Metric label="Replacement seats left" value={s.seats_left} />
      </div>

      <section className="ff-card overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold">Flights</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Flight", "Route", "Status", "Departs", "Arrives", "Reason", "Recovery"].map((h) => <th key={h} className="px-5 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {d.flights.map((f) => (
                <tr key={f.flight_no} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{f.flight_no}<div className="text-xs font-normal text-muted-foreground">{f.date}</div></td>
                  <td className="px-5 py-3">{f.origin} → {f.destination}</td>
                  <td className="px-5 py-3"><span className={`pill ${FLIGHT[f.status]}`}>{f.status === "delayed" ? `Delayed ${f.delay_minutes}m` : f.status.charAt(0).toUpperCase() + f.status.slice(1)}</span></td>
                  <td className="px-5 py-3 whitespace-nowrap">{f.departs}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{f.arrives}</td>
                  <td className="px-5 py-3 text-muted-foreground">{f.reason ?? "—"}</td>
                  <td className="px-5 py-3 min-w-40">
                    {f.status === "cancelled" ? (
                      <div>
                        <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-success" style={{ width: `${f.passengers ? (f.resolved / f.passengers) * 100 : 0}%` }} /></div>
                        <p className="mt-1 text-xs text-muted-foreground">{f.resolved} / {f.passengers} resolved</p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">{f.passengers} passengers</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section id="passengers" className="ff-card overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
            <h2 className="mr-auto font-semibold">Passenger recovery</h2>
            <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ref, flight" className="w-44 bg-transparent outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {(["all", "waiting", "rebooked", "refund_pending", "needs_help", "scheduled"] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {k === "all" ? "All" : STATUS[k].label} ({k === "all" ? d.passengers.length : d.passengers.filter((p) => p.recovery_status === k).length})
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Name", "Booking", "Flight", "Status", "Outcome", ""].map((h, i) => <th key={i} className="px-5 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pax.map((p) => (
                  <tr key={p.booking_ref} className="border-t border-border align-top">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 font-mono text-xs">{p.booking_ref}</td>
                    <td className="px-5 py-3">{p.flight_no}</td>
                    <td className="px-5 py-3"><span className={`pill ${STATUS[p.recovery_status]?.cls ?? "pill-gray"}`}>{STATUS[p.recovery_status]?.label ?? p.recovery_status}</span></td>
                    <td className="px-5 py-3">
                      {p.outcome ?? "—"}
                      {p.follow_up && <div className="mt-1 text-xs text-alert">Follow-up: {p.follow_up}</div>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <a href={`/recover/${p.link_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent">
                        Open recovery page <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
                {pax.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No passengers match.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="ff-card p-5">
            <h2 className="font-semibold">Replacement seats</h2>
            <ul className="mt-3 divide-y divide-border">
              {d.replacement_seats.map((r) => (
                <li key={r.flight_no} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{r.flight_no} <span className="font-normal text-muted-foreground">· replaces {r.replaces_flight}</span></p>
                    <p className="text-xs text-muted-foreground">{r.date} · {r.departs} → {r.arrives}</p>
                  </div>
                  {r.seats_left === 0 ? <span className="pill pill-gray">Sold out</span>
                    : r.seats_left === 1 ? <span className="pill pill-red">Last seat</span>
                    : <span className="text-sm font-medium">{r.seats_left} left</span>}
                </li>
              ))}
            </ul>
          </section>

          <section id="help" className="ff-card p-5">
            <h2 className="font-semibold">Help queue</h2>
            {d.help_cases.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No one needs help right now.</p> : (
              <ul className="mt-3 space-y-3">
                {d.help_cases.map((h) => (
                  <li key={h.id} className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
                    <div className="flex justify-between gap-2"><span className="font-medium">{h.name} <span className="font-mono text-xs text-muted-foreground">{h.booking_ref}</span></span><span className="text-xs text-muted-foreground">{timeAgo(h.opened_at)}</span></div>
                    <p className="mt-1">{h.reason}</p>
                    {h.note && <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ff-card p-5">
            <h2 className="font-semibold">Recent activity</h2>
            {activity.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p> : (
              <ul className="mt-3 space-y-3">
                {activity.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.type] ?? "bg-muted-foreground"}`} />
                    <div className="flex-1">{a.title}<div className="text-xs text-muted-foreground">{a.booking_ref} · {a.flight_no} · {timeAgo(a.time)}</div></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
