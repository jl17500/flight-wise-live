export const DATA_STALE_TIME = 30_000;
export const OPS_POLL_INTERVAL = 60_000;

export function shouldRefreshRecovery(input: string, reply: string): boolean {
  return /^(yes|no)\b|\b(confirm|confirmed|confirmation|approve|approved|go ahead|proceed|do it)\b/i.test(input.trim()) ||
    /confirmed|is submitted|refund request for|airline team|passed your case|sold out/i.test(reply);
}

export function sessionMatchesVersion(saved: string | null, current: string | undefined): boolean {
  return saved === (current ?? '');
}

export function recoveryProgress(resolved: number, passengers: number): number {
  return passengers > 0 ? Math.min(100, Math.max(0, resolved / passengers * 100)) : 0;
}