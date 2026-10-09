import { createFileRoute } from '@tanstack/react-router';
import { FlightFixPage } from '@/components/flightfix/app';
export const Route = createFileRoute('/')({
 head: () => ({meta:[{title:'Operations — FlightFix'},{name:'description',content:'Live cancellation recovery dashboard for Northstar Air staff.'},{property:'og:title',content:'Operations — FlightFix'},{property:'og:description',content:'Live cancellation recovery dashboard for Northstar Air staff.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: Page,
});
function Page() {return <FlightFixPage page="ops"/>;}
