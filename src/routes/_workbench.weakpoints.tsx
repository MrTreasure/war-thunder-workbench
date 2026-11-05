import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_workbench/weakpoints")({
  codeSplitGroupings: [],
  validateSearch: (search: Record<string, unknown>): { vehicle?: string; video?: string } => ({
    video:
      typeof search.video === "string" && /^BV[A-Za-z0-9]{10}$/.test(search.video)
        ? search.video
        : undefined,
    vehicle:
      typeof search.vehicle === "string" && /^[a-z0-9_]+$/.test(search.vehicle)
        ? search.vehicle
        : undefined,
  }),
  component: lazyRouteComponent(() => import("../TankWeakpoints"), "TankWeakpoints"),
});
