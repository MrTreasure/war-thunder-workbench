import { createFileRoute } from "@tanstack/react-router";
import { DisclaimerPage } from "../components/DisclaimerPage";
export const Route = createFileRoute("/_workbench/disclaimer")({
  codeSplitGroupings: [],
  component: DisclaimerPage,
});
