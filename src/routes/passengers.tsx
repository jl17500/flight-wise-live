import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/passengers')({
 head: () => ({meta:[{title:'Passengers — FlightFix'},{name:'description',content:'Review Northstar Air passenger recovery outcomes and assistance requests.'},{property:'og:title',content:'Passengers — FlightFix'},{property:'og:description',content:'Review Northstar Air passenger recovery outcomes and assistance requests.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="passengers"/>;}
