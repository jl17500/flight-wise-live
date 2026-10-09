import type { ButtonHTMLAttributes } from "react";

export function Button({className = "btn", type = "button", ...props}: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type={type} className={className} {...props} />; }

export function Icon({name, className = ""}: {name: string; className?: string}) {
 const paths: Record<string, React.ReactNode> = {
  plane: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  airplane: <><path d="m12 2 2 8 7 5v2l-7-2v5l2 2H8l2-2v-5l-7 2v-2l7-5Z"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  people: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3 6 9 7 9-7"/></>,
  chart: <><path d="M3 3v18h18M7 16V9h3v7m3 0V5h3v11m3 0v-5h3v5"/></>,
  settings: <><path d="m9 3-1 3-3 1-2 4 2 2v3l3 1 2 3h4l2-3 3-1v-3l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4"/></>,
  down: <><path d="m6 9 6 6 6-6"/></>,
  right: <><path d="m9 5 7 7-7 7"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  left: <><path d="m15 5-7 7 7 7"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  shield: <><path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/><path d="m8 12 3 3 5-6"/></>,
  close: <><path d="m6 6 12 12M6 18 18 6"/></>,
  more: <><circle cx="4" cy="12" r=".7"/><circle cx="12" cy="12" r=".7"/><circle cx="20" cy="12" r=".7"/></>,
  external: <><path d="M14 3h7v7m0-7L11 13M9 3H3v18h18v-6"/></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/></>,
  help: <><path d="M3 13v-1a9 9 0 0 1 18 0v1M5 12H3v7h4v-7Zm14 0h2v7h-4v-7Zm0 7c0 2-3 3-6 3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
  warning: <><path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/></>,
  wallet: <><path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1 0-4"/><path d="M20 12h-5v5h5m-3-2.5h.1"/></>,
  refresh: <><path d="M20 7a8 8 0 1 0 1 9M20 3v5h-5"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  seat: <><path d="M6 3v10a3 3 0 0 0 3 3h10M8 20l1-4m8 0 2 4M10 5v6h7v2M6 3h4"/></>,
  play: <><path d="m8 4 12 8-12 8Z"/></>,
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></>,
  send: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5"/></>,
  tool: <><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4Z"/></>,
 };
 return <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">{paths[name] ?? paths['info']}</svg>;
}
export function Logo() {return <svg className="logo" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="5.5" className="logo-fill"/><path d="M9 8.5h10.5M9 8.5v11M9 14h8.3" fill="none" className="logo-path" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function Chevron() {return <svg className="long-chevron" viewBox="0 0 15 56" aria-hidden="true"><path d="m2 3 11 25L2 53"/></svg>;}
