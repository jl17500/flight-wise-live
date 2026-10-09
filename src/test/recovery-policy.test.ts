import { describe, expect, it } from 'vitest';
import { DATA_STALE_TIME, OPS_POLL_INTERVAL, recoveryProgress, sessionMatchesVersion, shouldRefreshRecovery } from '@/lib/recovery-policy';

describe('Paid execution policy', () => {
  it('keeps data fresh for 30 seconds', () => expect(DATA_STALE_TIME).toBe(30_000));
  it('polls Operations every 60 seconds', () => expect(OPS_POLL_INTERVAL).toBe(60_000));
  it.each(['YES', 'NO', 'Yes, please', 'Please confirm', 'Go ahead'])('refreshes for confirmation input %s', input => {
    expect(shouldRefreshRecovery(input, 'Okay')).toBe(true);
  });
  it.each(['Confirmed', 'is submitted', 'refund request for', 'airline team', 'passed your case', 'sold out'])('refreshes for reply containing %s', phrase => {
    expect(shouldRefreshRecovery('What are my options?', `Your request ${phrase}.`)).toBe(true);
  });
  it('does not refresh informational messages or hidden Hi', () => {
    expect(shouldRefreshRecovery('What are my options?', 'You can take NS218. Reply YES to book.')).toBe(false);
    expect(shouldRefreshRecovery('Hi', 'Welcome to Northstar Air.')).toBe(false);
    expect(shouldRefreshRecovery('Book NS218', 'Reply YES to confirm.')).toBe(false);
  });
  it('discards saved chats when the data version changes', () => {
    expect(sessionMatchesVersion('2026-10-09T19:00:00Z', '2026-10-09T20:00:00Z')).toBe(false);
    expect(sessionMatchesVersion('2026-10-09T20:00:00Z', '2026-10-09T20:00:00Z')).toBe(true);
    expect(sessionMatchesVersion(null, '2026-10-09T20:00:00Z')).toBe(false);
  });
  it('derives cancellation progress from resolved / passengers', () => {
    expect(recoveryProgress(0, 8)).toBe(0);
    expect(recoveryProgress(2, 8)).toBe(25);
    expect(recoveryProgress(8, 8)).toBe(100);
    expect(recoveryProgress(0, 0)).toBe(0);
  });
});