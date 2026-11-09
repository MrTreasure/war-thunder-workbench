import { localize } from "../i18n/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { GameSelect } from "./GameSelect";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { canUseTestFeatures } from "../application-access";
export function PageNavigation({
  page,
}: {
  page:
    | "home"
    | "tree"
    | "lineups"
    | "maps"
    | "stats"
    | "sales"
    | "decals"
    | "disclaimer"
    | "loadouts"
    | "weakpoints";
}) {
  const navigate = useNavigate();
  useLocale();
  const { session } = useWorkbenchAccount();
  const testAccess = canUseTestFeatures(session);
  return (
    <>
      <nav className="page-navigation" aria-label={t("工具页面")}>
        <Link to="/home" preload={false} aria-current={page === "home" ? "page" : undefined}>
          {t("我的")}
        </Link>
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
        <Link
          to="/loadouts"
          preload={false}
          aria-current={page === "loadouts" ? "page" : undefined}
        >
          {t("模拟挂载")}
        </Link>
        {localize(
          testAccess && (
            <Link
              to="/weakpoints"
              preload={false}
              aria-current={page === "weakpoints" ? "page" : undefined}
            >
              {t("坦克弱点")}
            </Link>
          ),
        )}
      </nav>
      <nav className="mobile-page-navigation" aria-label={t("工具页面")}>
        <GameSelect
          aria-label={t("切换页面")}
          value={page}
          onValueChange={(value) => {
            const next = value;
            if (
              (next === "home" ||
                next === "tree" ||
                next === "lineups" ||
                next === "maps" ||
                next === "stats" ||
                next === "sales" ||
                next === "loadouts" ||
                (next === "weakpoints" && testAccess)) &&
              next !== page
            )
              void navigate({ to: next === "lineups" ? "/lineups/lobby" : `/${next}` });
          }}
        >
          {localize(
            page === "disclaimer" && (
              <option value="disclaimer" disabled>
                {t("免责声明")}
              </option>
            ),
          )}
          <option value="home">{t("我的")}</option>
          <option value="tree">{t("科技树")}</option>
          <option value="lineups">{t("出击队列")}</option>
          <option value="maps">{t("陆战地图")}</option>
          <option value="stats">{t("战绩查询")}</option>
          <option value="sales">{t("折扣日历")}</option>
          <option value="loadouts">{t("模拟挂载")}</option>
          {localize(testAccess && <option value="weakpoints">{t("坦克弱点")}</option>)}
          {localize(
            !testAccess && page === "weakpoints" && (
              <option value="weakpoints" disabled>
                {t("坦克弱点（测试权限）")}
              </option>
            ),
          )}
        </GameSelect>
      </nav>
    </>
  );
}
