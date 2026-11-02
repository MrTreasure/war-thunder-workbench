import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/loadouts")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): { recommendation?: string; country?: string; vehicle?: string } => ({
    recommendation:
      typeof search.recommendation === "string" && /^[A-Za-z0-9_-]{12}$/.test(search.recommendation)
        ? search.recommendation
        : undefined,
    country: typeof search.country === "string" ? search.country : undefined,
    vehicle: typeof search.vehicle === "string" ? search.vehicle : undefined,
  }),
  component: lazyRouteComponent(() => import("../LoadoutWorkbench"), "LoadoutWorkbench"),
});
