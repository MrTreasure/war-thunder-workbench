import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary, WorkbenchProvider } from "../Workbench";
import { AppHeader } from "../components/AppHeader";
// The two pages share this workspace; avoid serial startup requests for tiny route adapters.
export const Route = createFileRoute("/_workbench")({
  codeSplitGroupings: [],
  component: WorkbenchLayout,
});
function WorkbenchLayout() {
  return (
    <div className="workbench-layout">
      <ErrorBoundary>
        <WorkbenchProvider>
          <AppHeader />
          <div
            className="workbench-content"
            id="workbench-content"
            data-scroll-restoration-id="workbench-content"
          >
            <Outlet />
          </div>
        </WorkbenchProvider>
      </ErrorBoundary>
    </div>
  );
}
