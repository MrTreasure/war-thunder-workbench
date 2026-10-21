import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_workbench/maps")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): { map?: string; side?: string; q?: string; hasGuides?: boolean } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    hasGuides: search.hasGuides === true || search.hasGuides === "true" ? true : undefined,
    map: typeof search.map === "string" ? search.map : undefined,
    side: typeof search.side === "string" ? search.side : undefined,
  }),
  component: lazyRouteComponent(() => import("../MapAtlas"), "MapAtlas"),
});
