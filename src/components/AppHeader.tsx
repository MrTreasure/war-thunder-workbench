import { useRouterState } from "@tanstack/react-router";
import { WorkbenchAccountControl } from "./WorkbenchAccountControl";
import { CreatorLink } from "./CreatorLink";
import { PageNavigation } from "./PageNavigation";
import { workbenchPage } from "../features";

export function AppHeader() {
  const page = useRouterState({
    select: (state) => workbenchPage(state.location.pathname),
  });
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-identity">
          <img
            className="wt-brand-logo"
            src="https://warthunder.com/assets/img/svg/logo-wt.svg"
            alt="War Thunder"
            width={94}
            height={45}
          />
          <div className="app-brand-copy">
            <h1>研发工作台</h1>
            <span>战争雷霆玩家工具</span>
          </div>
        </div>
        <PageNavigation page={page} />
        <div className="app-header-actions">
          <CreatorLink />
          <WorkbenchAccountControl />
        </div>
      </div>
    </header>
  );
}
