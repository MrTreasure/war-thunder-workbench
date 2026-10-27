import { Link, useNavigate } from "@tanstack/react-router";
import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { GameSelect } from "./GameSelect";
export function PageNavigation({
  page,
}: {
  page: "tree" | "lineups" | "maps" | "stats" | "sales" | "decals" | "disclaimer";
}) {
  const navigate = useNavigate();
  useLocale();

  return (
    <>
      <nav className="page-navigation" aria-label={t("工具页面")}>
        <Link to="/tree" preload={false} aria-current={page === "tree" ? "page" : undefined}>
          {t("科技树")}
        </Link>
        <Link
          to="/lineups/lobby"
          preload={false}
          aria-current={page === "lineups" ? "page" : undefined}
        >
          {t("出击队列")}
        </Link>
        <Link to="/maps" preload={false} aria-current={page === "maps" ? "page" : undefined}>
          {t("陆战地图")}
        </Link>
        <Link to="/stats" preload={false} aria-current={page === "stats" ? "page" : undefined}>
          {t("战绩查询")}
        </Link>
        <Link to="/sales" preload={false} aria-current={page === "sales" ? "page" : undefined}>
          {t("折扣日历")}
        </Link>
      </nav>
      <nav className="mobile-page-navigation" aria-label={t("工具页面")}>
        <GameSelect
          aria-label={t("切换页面")}
          value={page}
          onValueChange={(value) => {
            const next = value;
            if (
              (next === "tree" ||
                next === "lineups" ||
                next === "maps" ||
                next === "stats" ||
                next === "sales") &&
              next !== page
            )
              void navigate({ to: next === "lineups" ? "/lineups/lobby" : `/${next}` });
          }}
        >
          {page === "disclaimer" && (
            <option value="disclaimer" disabled>
              {t("免责声明")}
            </option>
          )}
          <option value="tree">{t("科技树")}</option>
          <option value="lineups">{t("出击队列")}</option>
          <option value="maps">{t("陆战地图")}</option>
          <option value="stats">{t("战绩查询")}</option>
          <option value="sales">{t("折扣日历")}</option>
        </GameSelect>
      </nav>
    </>
  );
}
