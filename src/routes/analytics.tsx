import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/analytics')({
 head: () => ({meta:[{title:'Analytics — FlightFix'},{name:'description',content:'Explore live recovery outcomes and simulated notification statistics.'},{property:'og:title',content:'Analytics — FlightFix'},{property:'og:description',content:'Explore live recovery outcomes and simulated notification statistics.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="analytics"/>;}
