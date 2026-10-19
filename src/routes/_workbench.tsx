import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary, WorkbenchProvider } from "../Workbench";
import { CreatorFooter } from "../components/CreatorFooter";
export const Route = createFileRoute("/_workbench")({ component: WorkbenchLayout });
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
      <CreatorFooter />
    </div>
  );
}
