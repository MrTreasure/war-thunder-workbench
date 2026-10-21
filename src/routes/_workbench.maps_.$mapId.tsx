import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { guidesEnabled } from "../features";

export const Route = createFileRoute("/_workbench/maps_/$mapId")({
  codeSplitGroupings: [],
  beforeLoad: () => {
    if (!guidesEnabled()) throw redirect({ to: "/tree", replace: true });
  },
  validateSearch: (
    search: Record<string, unknown>,
  ): { side?: string; q?: string; hasGuides?: boolean; team?: 1 | 2 } => ({
    team: search.team === 2 || search.team === "2" ? 2 : undefined,
    side: typeof search.side === "string" ? search.side : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    hasGuides: search.hasGuides === true || search.hasGuides === "true" ? true : undefined,
  }),
  component: lazyRouteComponent(() => import("../MapAtlas"), "GroundMapPage"),
});
