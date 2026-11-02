import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/loadouts")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): { share?: string; country?: string; vehicle?: string } => ({
    share:
      typeof search.share === "string" && search.share.length <= 80000 ? search.share : undefined,
    country: typeof search.country === "string" ? search.country : undefined,
    vehicle: typeof search.vehicle === "string" ? search.vehicle : undefined,
  }),
  component: lazyRouteComponent(() => import("../LoadoutWorkbench"), "LoadoutWorkbench"),
});
