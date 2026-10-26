import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/tag-preview")({
  codeSplitGroupings: [],
  component: lazyRouteComponent(() => import("../TagPreview"), "TagPreview"),
});
