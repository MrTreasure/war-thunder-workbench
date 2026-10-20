import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { guidesEnabled } from "../features";

export const Route = createFileRoute("/_workbench/maps")({
  codeSplitGroupings: [],
  beforeLoad: () => {
    if (!guidesEnabled()) throw redirect({ to: "/tree", replace: true });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    map: typeof search.map === "string" ? search.map : undefined,
    side: typeof search.side === "string" ? search.side : undefined,
  }),
  component: lazyRouteComponent(() => import("../MapAtlas"), "MapAtlas"),
});
