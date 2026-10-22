import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/sales")({
  codeSplitGroupings: [],
  component: lazyRouteComponent(() => import("../SaleCalendar"), "SaleCalendar"),
});
