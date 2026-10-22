import { useEffect } from "react";
import { LanguageSwitch } from "./LanguageSwitch";
import { updateSearchMetadata } from "../search-metadata";
import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { useRouterState } from "@tanstack/react-router";
import { WorkbenchAccountControl } from "./WorkbenchAccountControl";
import { CreatorLink } from "./CreatorLink";
import { PageNavigation } from "./PageNavigation";
import { workbenchPage } from "../features";

export function AppHeader() {
  const locale = useLocale();

  const page = useRouterState({
    select: (state) => workbenchPage(state.location.pathname),
  });
  useEffect(() => updateSearchMetadata(page), [page, locale]);
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
            <h1>{t("研发工作台")}</h1>
            <span>{t("战争雷霆玩家工具")}</span>
          </div>
        </div>
        <PageNavigation page={page} />
        <div className="app-header-actions">
          <LanguageSwitch />
          <CreatorLink />
          <a
            className="app-repository-link"
            href="https://github.com/MrTreasure/war-thunder-workbench"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("GitHub 仓库：MrTreasure/war-thunder-workbench（新窗口打开）")}
            title="GitHub · github.com/MrTreasure/war-thunder-workbench"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.913-3.13.68-3.791-1.508-3.791-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.722 2.638 1.224 3.28.936.102-.728.393-1.224.715-1.506-2.5-.285-5.128-1.25-5.128-5.566 0-1.23.44-2.233 1.16-3.02-.117-.285-.503-1.43.11-2.98 0 0 .945-.303 3.094 1.154a10.79 10.79 0 0 1 5.625 0c2.148-1.457 3.092-1.154 3.092-1.154.614 1.55.228 2.695.112 2.98.722.787 1.158 1.79 1.158 3.02 0 4.327-2.633 5.278-5.14 5.557.404.35.764 1.043.764 2.1 0 1.516-.014 2.739-.014 3.111 0 .3.203.65.774.54A11.251 11.251 0 0 0 12 .75Z" />
            </svg>
          </a>
          <WorkbenchAccountControl />
        </div>
      </div>
    </header>
  );
}
