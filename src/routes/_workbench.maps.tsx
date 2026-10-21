import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { guidesEnabled } from "../features";

export const Route = createFileRoute("/_workbench/maps")({
  codeSplitGroupings: [],
  beforeLoad: () => {
    if (!guidesEnabled()) throw redirect({ to: "/tree", replace: true });
  },
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
