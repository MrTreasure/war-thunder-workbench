import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/home")({
  codeSplitGroupings: [],
  component: lazyRouteComponent(() => import("../HomeDashboard"), "HomeDashboard"),
});
