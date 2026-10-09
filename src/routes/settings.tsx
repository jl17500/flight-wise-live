import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/settings')({
 head: () => ({meta:[{title:'Settings — FlightFix'},{name:'description',content:'Manage FlightFix display preferences and simulated message history.'},{property:'og:title',content:'Settings — FlightFix'},{property:'og:description',content:'Manage FlightFix display preferences and simulated message history.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="settings"/>;}
