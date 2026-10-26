import { t } from "../i18n/core";
import { useLocale } from "../i18n/react";
import { Link, useRouterState } from "@tanstack/react-router";
import "./app-footer.css";

/** Compact shared footer; the immersive research tree has no footer. */
export function AppFooter() {
  useLocale();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/tree" || pathname === "/") return null;
  const international = location.hostname === "wt.mrtreasure.cc";
  const main = location.hostname === "render.qmuse.pub";
  return (
    <footer className="wt-app-footer" aria-label={t("站点信息")}>
      <div className="wt-app-footer-inner">
        <span>{t("非官方玩家工具")}</span>
        <Link to="/disclaimer" preload={false}>
          {t("免责声明")}
        </Link>
        <a
          href="https://github.com/MrTreasure/war-thunder-workbench/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("反馈 ↗")}
        </a>
        <nav aria-label={t("切换站点")}>
          <a
            href="https://render.qmuse.pub/p/muse/8645013411493394"
            aria-current={main ? "page" : undefined}
          >
            {t("主站")}
            {main ? t("（当前）") : " ↗"}
          </a>
          <a href="https://wt.mrtreasure.cc/" aria-current={international ? "page" : undefined}>
            {t("国际站")}
            {international ? t("（当前）") : " ↗"}
          </a>
        </nav>
        <span className="wt-app-platform-credit">
          <a
            href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("本应用通过 QMuse Vibecoding 平台搭建")} ↗
          </a>{" "}
        </span>
      </div>
    </footer>
  );
}
