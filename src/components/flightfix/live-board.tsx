import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { fetchOps, JOIN_URL, type OpsData } from "@/lib/flightfix";
import { LIVE_POLL_INTERVAL } from "@/lib/recovery-policy";
import { Button, Icon } from "./primitives";

/** The flight the audience joins by QR code. */
export const RACE_FLIGHT = "NS612";

type Activity = OpsData["activity"][number];

const clockOf = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Pauses polling while the tab is hidden, so a forgotten board doesn't spend n8n executions. */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Remembers the first time the board saw something happen, per demo run (data_version). */
function useFirstSeen(version: string | undefined) {
  const store = useRef<Record<string, number>>({});
  const key = `ff-live-${version ?? "none"}`;
  useEffect(() => {
    try {
      store.current = JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      store.current = {};
    }
  }, [key]);
  return (name: string, when: number) => {
    if (store.current[name] === undefined) {
      store.current[name] = when;
      try {
        sessionStorage.setItem(key, JSON.stringify(store.current));
      } catch {
        /* storage may be blocked */
      }
    }
    return store.current[name];
  };
}

export function LiveBoard() {
  const visible = usePageVisible();
  const q = useQuery({
    queryKey: ["ops"],
    queryFn: fetchOps,
    refetchInterval: visible ? LIVE_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const firstSeen = useFirstSeen(q.data?.data_version);
  const initialSeats = useRef<Record<string, number>>({});

  const d = q.data;
  const flight = d?.flights.find((f) => f.flight_no === RACE_FLIGHT);
  const cancelled = flight?.status === "cancelled";
  const people = d?.passengers.filter((p) => p.flight_no === RACE_FLIGHT) ?? [];
  const joined = people.filter((p) => p.claimed_at);
  const seats = d?.replacement_seats.filter((s) => s.replaces_flight === RACE_FLIGHT) ?? [];
  for (const s of seats)
    initialSeats.current[s.flight_no] = Math.max(
      initialSeats.current[s.flight_no] ?? 0,
      s.seats_left,
    );
  const feed: Activity[] = (d?.activity ?? []).filter((e) => e.flight_no === RACE_FLIGHT);

  const cancelEvent = feed.find((e) => e.type === "cancel");
  const cancelledAt = cancelled
    ? firstSeen("cancel", cancelEvent ? +new Date(cancelEvent.time) : now)
    : undefined;
  const count = (status: string) => joined.filter((p) => p.recovery_status === status).length;
  const resolved = joined.filter((p) =>
    ["rebooked", "refund_pending", "needs_help"].includes(p.recovery_status),
  );
  // "All resolved" waits for a few people to join, so early birds don't end the race.
  const allDone = cancelled && joined.length >= 3 && resolved.length === joined.length;
  // When the last joined passenger settled; recomputed each poll, so late joiners reopen the clock.
  const doneAt = allDone
    ? Math.max(...resolved.map((p) => +new Date(p.updated_at)).filter(Number.isFinite))
    : undefined;
  const soldOut = seats
    .filter((s) => s.seats_left === 0 && cancelledAt)
    .map((s) => {
      const last = feed.find((e) => e.type === "rebooked" && e.title.includes(s.flight_no));
      const at = firstSeen(`sold-${s.flight_no}`, last ? +new Date(last.time) : now);
      return { flight_no: s.flight_no, after: at - (cancelledAt ?? at) };
    });

  return (
    <div className="live-board">
      <header className="live-head">
        <div>
          <p className="live-eyebrow">Northstar Air · live recovery board</p>
          <h1>
            {RACE_FLIGHT} {flight ? `${flight.origin} → ${flight.destination}` : ""}
            {flight && (
              <span className={`live-status ${cancelled ? "cancelled" : ""}`}>
                {cancelled ? "Cancelled" : flight.status === "delayed" ? "Delayed" : "Scheduled"}
              </span>
            )}
          </h1>
        </div>
        <div className="live-tools">
          {cancelledAt && (
            <span className="live-timer" aria-live="off">
              {clockOf((doneAt ?? now) - cancelledAt)} since cancellation
            </span>
          )}
          <Button
            className="btn compact"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen?.()
            }
          >
            Full screen
          </Button>
          <Link className="btn compact" to="/">
            Dashboard
          </Link>
        </div>
      </header>
      {q.isError && (
        <div className="notice red live-error" role="alert">
          <Icon name="warning" />
          <span>Couldn't reach the backend. {q.error.message}</span>
          <Button className="link-btn" onClick={() => q.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <div className="live-grid">
        <section className="live-join" aria-label="Join the demo">
          <div className="live-qr">
            <QRCodeSVG value={JOIN_URL} size={320} marginSize={2} level="M" />
          </div>
          <p className="live-qr-label">Scan to become a passenger</p>
          <p className="live-joined">
            Joined <strong>{joined.length}</strong> / {people.length || 30}
          </p>
        </section>
        <section className="live-race" aria-label="Replacement flights">
          {!d ? (
            <p className="live-waiting">Loading the board…</p>
          ) : !cancelled ? (
            <div className="live-waiting">
              <Icon name="clock" className="xl" />
              <p>Waiting for the operator to cancel {RACE_FLIGHT}…</p>
              <small>Scan now: you'll get your passenger the moment you join.</small>
            </div>
          ) : (
            <>
              <h2>Replacement seats</h2>
              <div className="live-bars">
                {seats.map((s) => {
                  const total = initialSeats.current[s.flight_no] || s.seats_left || 1;
                  return (
                    <div className="live-bar" key={s.flight_no}>
                      <div className="live-bar-label">
                        <strong>{s.flight_no}</strong>
                        <span>{s.departs}</span>
                        {s.seats_left === 0 ? (
                          <b className="sold">SOLD OUT</b>
                        ) : (
                          <b>
                            {s.seats_left} seat{s.seats_left === 1 ? "" : "s"} left
                          </b>
                        )}
                      </div>
                      <div className="live-track">
                        <div
                          className="live-fill"
                          style={{ width: `${(s.seats_left / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <h2>Race results</h2>
              <div className="live-counts">
                {(
                  [
                    ["Rebooked", count("rebooked"), "green"],
                    ["Refund requested", count("refund_pending"), "amber"],
                    ["Need help", count("needs_help"), "red"],
                    ["Still deciding", joined.length - resolved.length, "blue"],
                  ] as const
                ).map(([label, n, tone]) => (
                  <div className={`live-count ${tone}`} key={label}>
                    <strong>{n}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {soldOut.length > 0 && (
                <p className="live-soldout">
                  {soldOut.map((s) => `${s.flight_no} sold out at ${clockOf(s.after)}`).join(" · ")}
                </p>
              )}
              {allDone && cancelledAt && doneAt && (
                <div className="live-banner" role="status">
                  All {joined.length} passengers resolved in {clockOf(doneAt - cancelledAt)} · 0
                  double bookings
                </div>
              )}
            </>
          )}
        </section>
        <section className="live-feed" aria-label="Live activity">
          <h2>Live activity</h2>
          <ol>
            {feed.slice(0, 8).map((e) => (
              <li key={`${e.time}-${e.title}`} className={e.type}>
                <span className={`dot demo-dot ${e.type}`} />
                <span>{e.title}</span>
              </li>
            ))}
            {!feed.length && <li className="muted">Activity for {RACE_FLIGHT} appears here.</li>}
          </ol>
        </section>
      </div>
      <p className="live-foot">
        Synthetic demo · Northstar Air is fictional · updates every {LIVE_POLL_INTERVAL / 1000} s
      </p>
    </div>
  );
}
