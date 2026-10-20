import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary, WorkbenchProvider } from "../Workbench";
// The two pages share this workspace; avoid serial startup requests for tiny route adapters.
export const Route = createFileRoute("/_workbench")({
  codeSplitGroupings: [],
  component: WorkbenchLayout,
});
function WorkbenchLayout() {
  return (
    <div className="workbench-layout">
      <div className="workbench-content">
        <ErrorBoundary>
          <WorkbenchProvider>
            <Outlet />
          </WorkbenchProvider>
        </ErrorBoundary>
      </div>
    </div>
  );
}
