import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/messages')({
 head: () => ({meta:[{title:'Messages — FlightFix'},{name:'description',content:'Review simulated passenger notification deliveries in FlightFix.'},{property:'og:title',content:'Messages — FlightFix'},{property:'og:description',content:'Review simulated passenger notification deliveries in FlightFix.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="messages"/>;}
