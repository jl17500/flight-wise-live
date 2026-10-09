import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, LifeBuoy, Plane, RotateCcw, Send } from "lucide-react";
import { fetchPassenger, LinkNotFound, money, sendChat, type PassengerData } from "@/lib/flightfix";

export const Route = createFileRoute("/recover/$token")({
  head: () => ({
    meta: [
      { title: "Your trip — Northstar Air" },
      { name: "description", content: "See your flight status and choose your next step with Northstar Air." },
      { property: "og:title", content: "Your trip — Northstar Air" },
      { property: "og:description", content: "See your flight status and choose your next step with Northstar Air." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Recover,
});

function Recover() {
  const { token } = Route.useParams();
  const q = useQuery({ queryKey: ["passenger", token], queryFn: () => fetchPassenger(token), retry: (n, e) => !(e instanceof LinkNotFound) && n < 1, refetchOnWindowFocus: false });
  const chatRef = useRef<{ send: (t: string) => void }>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-4 font-semibold"><Plane className="h-5 w-5 text-primary" />Northstar Air</div>
      </header>
      <main className="mx-auto max-w-[440px] px-4 py-6 lg:max-w-5xl">
        {q.error instanceof LinkNotFound ? (
          <div className="ff-card mx-auto max-w-[440px] p-8 text-center">
            <h1 className="text-lg font-semibold">We couldn't open this link</h1>
            <p className="mt-2 text-sm text-muted-foreground">{q.error.message}</p>
          </div>
        ) : q.isError ? (
          <div className="ff-card p-6 text-center text-sm">
            <p>We couldn't load your trip right now.</p>
            <button onClick={() => q.refetch()} className="mt-3 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Try again</button>
          </div>
        ) : !q.data ? (
          <p className="text-center text-sm text-muted-foreground">Loading your trip…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Details d={q.data} onAsk={(t) => chatRef.current?.send(t)} />
            <div className="lg:sticky lg:top-6"><Chat token={token} apiRef={chatRef} onReply={() => q.refetch()} /></div>
          </div>
        )}
        <p className="mt-10 text-center text-xs text-muted-foreground">Demo with synthetic passengers. No real tickets, payments or messages.</p>
      </main>
    </div>
  );
}

function Details({ d, onAsk }: { d: PassengerData; onAsk: (t: string) => void }) {
  const f = d.flight;
  const o = d.outcome;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hi {d.passenger.first_name}, here's your next step.</h1>

      <section className="ff-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Flight {f.flight_no} · {d.passenger.booking_ref}</p>
            <p className="mt-1 text-lg font-semibold">{f.route}</p>
            <p className="text-sm text-muted-foreground">{f.date}</p>
          </div>
          {f.status === "cancelled" ? <span className="pill pill-red">Cancelled</span>
            : f.status === "delayed" ? <span className="pill pill-amber">Delayed {f.delay_minutes} min</span>
            : <span className="pill pill-gray">Scheduled</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Departs</p><p className={f.status === "delayed" ? "line-through text-muted-foreground" : ""}>{f.scheduled_departure}</p>{f.status === "delayed" && f.new_departure && <p className="font-medium">{f.new_departure}</p>}</div>
          <div><p className="text-xs text-muted-foreground">Arrives</p><p className={f.status === "delayed" ? "line-through text-muted-foreground" : ""}>{f.scheduled_arrival}</p>{f.status === "delayed" && f.new_arrival && <p className="font-medium">{f.new_arrival}</p>}</div>
        </div>
        {f.reason && f.status !== "scheduled" && <p className="mt-3 text-sm text-muted-foreground">Reason: {f.reason}</p>}
      </section>

      {o?.type === "rebooked" && (
        <section className="rounded-xl border border-success/30 bg-success/10 p-5">
          <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-5 w-5" />You're booked on {o.flight_no}</p>
          <p className="mt-2 text-sm">{o.date} · {o.departs} → {o.arrives}</p>
          <p className="mt-3 text-xs text-muted-foreground">Confirmation code</p>
          <p className="font-mono text-3xl font-semibold tracking-widest">{o.confirmation_code}</p>
          <p className="mt-3 text-sm text-muted-foreground">Your original flight stays cancelled. No refund was requested.</p>
        </section>
      )}
      {o?.type === "refund_requested" && (
        <section className="rounded-xl border border-warning/30 bg-warning/10 p-5">
          <p className="flex items-center gap-2 font-semibold text-warning"><Clock className="h-5 w-5" />Refund request recorded: {money(o.amount)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Pending review. No money has been paid yet.</p>
        </section>
      )}
      {!o && d.help_request && (
        <section className="flex gap-3 rounded-xl border border-info/25 bg-info/5 p-4 text-sm">
          <LifeBuoy className="h-5 w-5 shrink-0 text-info" />
          <p>Our team has your request: {d.help_request}. You can still choose an option below.</p>
        </section>
      )}

      {!o && d.options.length > 0 && (
        <section className="ff-card p-5">
          <h2 className="font-semibold">Replacement flights</h2>
          <ul className="mt-3 divide-y divide-border">
            {d.options.map((op) => (
              <li key={op.flight_no + op.date} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">{op.flight_no} <span className="font-normal text-muted-foreground">· {op.date}</span></p>
                  <p>{op.departs} → {op.arrives}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{op.seats_left === 1 ? <span className="pill pill-red">Last seat</span> : `${op.seats_left} seats left`}</p>
                </div>
                <button onClick={() => onAsk(`Book ${op.flight_no}`)} className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent">Ask to book</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!o && d.refund && (
        <section className="ff-card p-5 text-sm">
          <h2 className="font-semibold">Prefer a refund?</h2>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Base fare</span><span>{money(d.refund.base_fare)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Taxes and fees</span><span>{money(d.refund.taxes_and_fees)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{money(d.refund.total)}</span></div>
          </div>
          <button onClick={() => onAsk("I'd like a refund instead")} className="mt-4 w-full rounded-lg border border-border py-2 font-medium hover:bg-muted">Request refund</button>
        </section>
      )}
    </div>
  );
}

type Msg = { role: "user" | "assistant" | "error"; text: string; retry?: string };
const QUICK = ["What happened to my flight?", "What are my options?", "I'd like a refund instead", "Talk to a person"];
const newId = () => crypto.randomUUID();

function Chat({ token, apiRef, onReply }: { token: string; apiRef: React.RefObject<{ send: (t: string) => void } | null>; onReply: () => void }) {
  const sidKey = `ff-sid-${token}`, msgKey = `ff-msgs-${token}`;
  const [sid, setSid] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [confirmDone, setConfirmDone] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  const run = async (text: string, hidden: boolean, sessionId: string) => {
    setBusy(true);
    setMsgs((m) => [...m.filter((x) => x.role !== "error"), ...(hidden ? [] : [{ role: "user" as const, text }])]);
    try {
      const reply = await sendChat(sessionId, text, token);
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
      setConfirmDone(false);
      onReply();
    } catch {
      setMsgs((m) => [...m, { role: "error", text: "I couldn't reach the assistant. Nothing was changed. Try again.", retry: text }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const start = (sessionId: string) => { started.current = true; run("Hi", true, sessionId); };

  useEffect(() => {
    let id = sessionStorage.getItem(sidKey);
    const saved = sessionStorage.getItem(msgKey);
    if (id && saved) { setSid(id); setMsgs(JSON.parse(saved)); return; }
    if (!started.current) { id = newId(); sessionStorage.setItem(sidKey, id); setSid(id); start(id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { if (sid) sessionStorage.setItem(msgKey, JSON.stringify(msgs.filter((m) => m.role !== "error"))); }, [msgs, sid, msgKey]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const send = (t: string) => { const v = t.trim().slice(0, 400); if (!v || busy || !sid) return; setInput(""); run(v, false, sid); };
  apiRef.current = { send };

  const reset = () => { const id = newId(); sessionStorage.setItem(sidKey, id); setSid(id); setMsgs([]); setConfirmDone(false); start(id); };

  const lastA = [...msgs].reverse().find((m) => m.role !== "error");
  const showConfirm = !busy && !confirmDone && lastA?.role === "assistant" && /reply yes/i.test(lastA.text);

  return (
    <section className="ff-card flex h-[600px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div><h2 className="font-semibold">Recovery Assistant</h2><p className="text-xs text-muted-foreground">AI assistant · bookings need your YES</p></div>
        <button onClick={reset} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Start over</button>
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m, i) => m.role === "error" ? (
          <div key={i} className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {m.text}
            <button onClick={() => sid && run(m.retry!, m.retry === "Hi" && msgs.length === 1, sid)} className="ml-2 font-medium underline">Retry</button>
          </div>
        ) : (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="flex"><div className="animate-pulse rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Assistant is checking…</div></div>}
      </div>
      {showConfirm && (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <button onClick={() => { setConfirmDone(true); send("YES"); }} className="rounded-lg bg-success py-2.5 font-semibold text-primary-foreground">YES, confirm</button>
          <button onClick={() => { setConfirmDone(true); send("NO"); }} className="rounded-lg border border-border py-2.5 font-semibold hover:bg-muted">NO</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} autoFocus rows={1} maxLength={400} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Type a message" className="max-h-28 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-lg bg-primary p-2.5 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{input.length}/400</p>
        {!busy && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {QUICK.map((t) => <button type="button" key={t} onClick={() => send(t)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">{t}</button>)}
          </div>
        )}
      </form>
    </section>
  );
}
