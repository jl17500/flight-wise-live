import type { OpsData } from './flightfix';
export const SIDEBAR_MIN = 72;
export const SIDEBAR_MAX = 252;
export const REFRESH_INTERVAL = 60_000;
export const DEFAULT_ZONE = 'America/New_York';
export const clampSidebar = (n: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(n)));
export type Channel = 'sms' | 'email' | 'app';
export type Batch = { id: string; flightId: string; channel: Channel; recipientIds: string[]; recipientCount: number; delivered: number; failed: number; pending: number; createdAt: string; text: string; syntheticHistory?: boolean; flightStatus?: string; deliveredIds?: string[]; failedIds?: string[] };
export const sampleBatch = (): Batch => ({id:'historical-example', flightId:'Historical sample batch', channel:'sms', recipientIds:[], recipientCount:100, delivered:92, failed:8, pending:0, createdAt:'2026-10-09T16:00:00Z', text:'Labelled historical example · 100 recipients · Simulated delivery. No real campaign.', syntheticHistory:true});
export function deliveryStats(batches: Batch[]) { const s=batches.reduce((a,b)=>({delivered:a.delivered+b.delivered, failed:a.failed+b.failed, pending:a.pending+b.pending}),{delivered:0,failed:0,pending:0});return {...s,rate:s.delivered+s.failed ? Math.round(s.delivered/(s.delivered+s.failed)*100):null}; }
export function awaitingPassengers(d: OpsData, batches: Batch[], flightId?: string) { return d.passengers.filter(p=>{ const f=d.flights.find(f=>f.flight_no===p.flight_no); return f && f.status!=='scheduled' && (!flightId || p.flight_no===flightId) && !batches.some(b=>b.flightId===p.flight_no && b.flightStatus===f.status && ((b.pending>0 && b.recipientIds.includes(p.booking_ref)) || (b.deliveredIds??b.recipientIds.slice(0,b.delivered)).includes(p.booking_ref))); }); }
export function finalizeBatch(b: Batch): Batch { const failed=b.recipientCount>=5?Math.max(1,Math.floor(b.recipientCount*.08)):0;return {...b,delivered:b.recipientCount-failed,failed,pending:0,deliveredIds:b.recipientIds.slice(0,b.recipientCount-failed),failedIds:b.recipientIds.slice(b.recipientCount-failed)}; }
export function templateText(kind: string, f: OpsData['flights'][number]) {
 const route=`${f.flight_no} (${f.origin} to ${f.destination})`;
 if(kind==='recovery')return `Your flight ${route} has been cancelled. Review replacement flights or request your unused-ticket refund on your recovery page. No change is made until you confirm. [Demo recovery link]`;
 if(kind==='delay'){
 if(f.status==='cancelled')return `Your flight ${route} has been cancelled. Your recovery options are ready. Please review and choose a replacement flight or ticket refund. [Demo recovery link]`;
 if(f.status==='delayed') {const airportZones:Record<string,string>={JFK:'America/New_York',SFO:'America/Los_Angeles',SEA:'America/Los_Angeles',ORD:'America/Chicago',MIA:'America/New_York',ATL:'America/New_York',BOS:'America/New_York',LAX:'America/Los_Angeles',DEN:'America/Denver',PHX:'America/Phoenix',DCA:'America/New_York',DFW:'America/Chicago',MCO:'America/New_York',SAN:'America/Los_Angeles'}; const departure=f.departs_at?new Intl.DateTimeFormat('en-US',{timeZone:airportZones[f.origin]??DEFAULT_ZONE,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(+new Date(f.departs_at)+f.delay_minutes*60_000)):f.departs;return `Update for ${route}: the airline has confirmed a ${f.delay_minutes} minute delay. New departure: ${departure}. We will share further confirmed changes here. [Demo update link]`;}
 return `We are monitoring a possible delay to ${route}. Your departure time has not changed. Please keep your original travel plans until the airline confirms an update. [Demo update link]`;
 }
 return `An update for ${route} is available. Please check your flight details and contact the airline team if you need help. [Demo update link]`;
}
