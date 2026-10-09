import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/assistant')({
 head: () => ({meta:[{title:'Recovery Assistant — FlightFix'},{name:'description',content:'Inspect the live n8n recovery assistant workflow and passenger outcomes.'},{property:'og:title',content:'Recovery Assistant — FlightFix'},{property:'og:description',content:'Inspect the live n8n recovery assistant workflow and passenger outcomes.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="assistant"/>;}
