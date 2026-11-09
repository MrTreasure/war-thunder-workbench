import { createFileRoute } from "@tanstack/react-router";
import { useWorkbenchPage } from "../Workbench";
export const Route = createFileRoute("/_workbench/tree")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): { country?: string; category?: string; plan?: boolean } => ({
    country: typeof search.country === "string" ? search.country : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    plan: search.plan === true || search.plan === "true" ? true : undefined,
  }),
  component: Page,
});
function Page() {
  return useWorkbenchPage("tree");
}
