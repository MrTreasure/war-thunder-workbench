import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { GameSelect } from "./GameSelect";
export function PageNavigation({
  page,
}: {
  page: "tree" | "lineups" | "maps" | "stats" | "sales" | "decals" | "disclaimer";
}) {
  useLocale();

  return (
    <>
      <nav className="page-navigation" aria-label={t("工具页面")}>
        <a href="#/tree" aria-current={page === "tree" ? "page" : undefined}>
          {t("科技树")}
        </a>
        <a href="#/lineups" aria-current={page === "lineups" ? "page" : undefined}>
          {t("出击队列")}
        </a>
        <a href="#/maps" aria-current={page === "maps" ? "page" : undefined}>
          {t("陆战地图")}
        </a>
        <a href="#/stats" aria-current={page === "stats" ? "page" : undefined}>
          {t("战绩查询")}
        </a>
        <a href="#/sales" aria-current={page === "sales" ? "page" : undefined}>
          {t("折扣日历")}
        </a>
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
              location.hash = `/${next}`;
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
