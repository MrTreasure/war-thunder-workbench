import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_workbench/maps_/$mapId")({
  codeSplitGroupings: [],
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
