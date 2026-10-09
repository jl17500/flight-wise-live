import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/flights')({
 head: () => ({meta:[{title:'Flights — FlightFix'},{name:'description',content:'Monitor live Northstar Air flight risks and confirmed status.'},{property:'og:title',content:'Flights — FlightFix'},{property:'og:description',content:'Monitor live Northstar Air flight risks and confirmed status.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="flights"/>;}
