import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/stats")({
  codeSplitGroupings: [],
  validateSearch: (search: Record<string, unknown>): { player?: string; view?: string } => ({
    player: typeof search.player === "string" ? search.player : undefined,
    view: search.view === "report" ? "report" : undefined,
  }),
  component: lazyRouteComponent(() => import("../PlayerStats"), "PlayerStats"),
});
