import { useLocale } from "../i18n/react";
import { createFileRoute } from "@tanstack/react-router";
import { useWorkbenchPage } from "../Workbench";
export const Route = createFileRoute("/_workbench/lineups")({
  codeSplitGroupings: [],
  component: Page,
});
function Page() {
  useLocale();

  return useWorkbenchPage("lineups");
}
