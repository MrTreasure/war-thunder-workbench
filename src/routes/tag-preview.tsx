import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/tag-preview")({
  codeSplitGroupings: [],
  component: lazyRouteComponent(() => import("../TagPreview"), "TagPreview"),
});
