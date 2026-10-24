import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/stats")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): { player?: string; view?: string; snapshot?: string; uid?: string } => ({
    snapshot:
      typeof search.snapshot === "string" && /^snap_[A-Za-z0-9_-]{10,60}$/.test(search.snapshot)
        ? search.snapshot
        : undefined,
    uid:
      typeof search.uid === "string" && /^[0-9]{1,20}$/.test(search.uid) ? search.uid : undefined,
    player: typeof search.player === "string" ? search.player : undefined,
    view: search.view === "report" || search.view === "rankings" ? search.view : undefined,
  }),
  component: lazyRouteComponent(() => import("../PlayerStats"), "PlayerStats"),
});
