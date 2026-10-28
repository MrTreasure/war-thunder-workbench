import "../workbench-appearance";
import { AppFooter } from "../components/AppFooter";
import { useLocale } from "../i18n/react";
import { AccountWorkspaceProvider } from "../AccountWorkspace";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary, WorkbenchProvider } from "../Workbench";
import { WorkbenchAccountProvider } from "../WorkbenchAccount";
import { AppHeader } from "../components/AppHeader";
// The two pages share this workspace; avoid serial startup requests for tiny route adapters.
export const Route = createFileRoute("/_workbench")({
  codeSplitGroupings: [],
  component: WorkbenchLayout,
});
function WorkbenchLayout() {
  useLocale();
  return (
    <div className="workbench-layout">
      <ErrorBoundary>
        <WorkbenchAccountProvider>
          <AccountWorkspaceProvider>
            <WorkbenchProvider>
              <AppHeader />
              <div
                className="workbench-content"
                id="workbench-content"
                data-scroll-restoration-id="workbench-content"
              >
                <Outlet />
                <AppFooter />
              </div>
            </WorkbenchProvider>
          </AccountWorkspaceProvider>
        </WorkbenchAccountProvider>
      </ErrorBoundary>
    </div>
  );
}
