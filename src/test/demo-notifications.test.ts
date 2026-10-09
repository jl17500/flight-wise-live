import { describe, expect, it } from 'vitest';
import { clampSidebar, DEFAULT_ZONE, REFRESH_INTERVAL, deliveryStats, finalizeBatch, sampleBatch } from '@/lib/demo-notifications';

describe('FlightFix redesign rules', () => {
  it('keeps sidebar resizing between 72 and 252 pixels', () => {
    expect(clampSidebar(20)).toBe(72);
    expect(clampSidebar(300)).toBe(252);
    expect(clampSidebar(180)).toBe(180);
  });
  it('defaults to America/New_York', () => {
    expect(DEFAULT_ZONE).toBe('America/New_York');
  });
  it('polls every 60 seconds', () => {
    expect(REFRESH_INTERVAL).toBe(60_000);
  });
  it('starts with 100 recipients, 92 delivered and 8 failed', () => {
    expect(sampleBatch()).toMatchObject({ recipientCount:100, delivered:92, failed:8, pending:0, syntheticHistory:true });
    expect(deliveryStats([sampleBatch()]).rate).toBe(92);
  });
  it('excludes queued deliveries from the finalized rate', () => {
    expect(deliveryStats([sampleBatch(), {...sampleBatch(), delivered:0, failed:0, pending:50}])).toEqual({delivered:92,failed:8,pending:50,rate:92});
  });
  it('finalizes a queued batch without changing its recipient total', () => {
    const result=finalizeBatch({...sampleBatch(),recipientCount:8,delivered:0,failed:0,pending:8});
    expect(result.pending).toBe(0);
    expect(result.delivered+result.failed).toBe(8);
  });
});