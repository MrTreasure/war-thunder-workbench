import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/stats_/garage")({
  codeSplitGroupings: [],
  validateSearch: (search: Record<string, unknown>): { snapshot?: string; uid?: string } => ({
    snapshot:
      typeof search.snapshot === "string" && /^snap_[A-Za-z0-9_-]{10,60}$/.test(search.snapshot)
        ? search.snapshot
        : undefined,
    uid:
      typeof search.uid === "string" && /^[0-9]{1,20}$/.test(search.uid) ? search.uid : undefined,
  }),
  component: lazyRouteComponent(() => import("../PlayerGaragePage"), "PlayerGaragePage"),
});
