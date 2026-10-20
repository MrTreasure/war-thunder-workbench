import { useRouterState } from "@tanstack/react-router";
import { CreatorLink } from "./CreatorLink";
import { PageNavigation } from "./PageNavigation";

export function AppHeader() {
  const page = useRouterState({
    select: (state) => (state.location.pathname === "/lineups" ? "lineups" : "tree"),
  });
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-identity">
          <img
            src="https://warthunder.com/assets/img/svg/logo-wt.svg"
            alt="War Thunder"
            width={94}
            height={45}
          />
          <div className="app-brand-copy">
            <h1>载具研发树</h1>
            <span>个人研发工具</span>
          </div>
        </div>
        <PageNavigation page={page} />
        <CreatorLink />
      </div>
    </header>
  );
}
