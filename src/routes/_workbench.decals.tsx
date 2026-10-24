import { createFileRoute, redirect } from "@tanstack/react-router";
// Paused until a usable official CDN source is available.
export const Route = createFileRoute("/_workbench/decals")({
  codeSplitGroupings: [],
  beforeLoad: () => {
    throw redirect({ to: "/tree", replace: true });
  },
});
