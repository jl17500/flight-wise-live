import { createFileRoute } from "@tanstack/react-router";
import { LiveBoard } from "@/components/flightfix/live-board";
export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live board — FlightFix" },
      { name: "description", content: "Live seat race for the FlightFix class demo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LiveBoard,
});
