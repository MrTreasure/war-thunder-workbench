import { createFileRoute } from "@tanstack/react-router";
import { useWorkbenchPage } from "../Workbench";
export const Route = createFileRoute("/_workbench/lineups")({ component: Page });
function Page() {
  return useWorkbenchPage("lineups");
}
