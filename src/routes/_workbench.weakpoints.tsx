import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_workbench/weakpoints")({
  codeSplitGroupings: [],
  validateSearch: (search: Record<string, unknown>): { vehicle?: string } => ({
    vehicle:
      typeof search.vehicle === "string" && /^[a-z0-9_]+$/.test(search.vehicle)
        ? search.vehicle
        : undefined,
  }),
  component: lazyRouteComponent(() => import("../TankWeakpoints"), "TankWeakpoints"),
});
