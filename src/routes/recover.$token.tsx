import { createFileRoute } from '@tanstack/react-router';
import { useRef } from 'react';
import { AssistantChat, PassengerContent, TripError, usePassenger, type ChatHandle } from '@/components/flightfix/passenger';
import { Icon } from '@/components/flightfix/primitives';
export const Route = createFileRoute('/recover/$token')({
 head:()=>({meta:[{title:'Your trip — Northstar Air'},{name:'description',content:'Review your Northstar Air flight and choose recovery with the live assistant.'},{property:'og:title',content:'Your trip — Northstar Air'},{property:'og:description',content:'Review your Northstar Air flight and choose recovery with the live assistant.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),
 component: Recover,
});
function Recover(){const {token}=Route.useParams(),q=usePassenger(token),chat=useRef<ChatHandle|null>(null);return <><header className="passenger-header"><div className="flex gap8"><Icon name="plane"/>Northstar Air</div></header><main className="recover-main">{q.error?<TripError error={q.error} retry={()=>q.refetch()}/>:!q.data?<p className="fine">Loading your trip…</p>:<div className="recover-columns"><PassengerContent d={q.data} onAsk={text=>chat.current?.send(text)}/><div className="standalone-chat"><AssistantChat token={token} d={q.data} apiRef={chat}/></div></div>}<p className="file-note mt24">Synthetic demo data · Live n8n backend · No real tickets, payments or messages.</p></main></>;}
