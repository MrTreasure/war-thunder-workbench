import { Link, useNavigate } from "@tanstack/react-router";
import { GameSelect } from "./GameSelect";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { canUseTestFeatures } from "../application-access";
export function PageNavigation({
  page,
}: {
  page:
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
  const { session } = useWorkbenchAccount();
  const testAccess = canUseTestFeatures(session);
  return (
    <>
      <nav className="page-navigation" aria-label="工具页面">
        <Link to="/tree" preload={false} aria-current={page === "tree" ? "page" : undefined}>
          科技树
        </Link>
        <Link
          to="/lineups/lobby"
          preload={false}
          aria-current={page === "lineups" ? "page" : undefined}
        >
          出击队列
        </Link>
        <Link to="/maps" preload={false} aria-current={page === "maps" ? "page" : undefined}>
          陆战地图
        </Link>
        <Link to="/stats" preload={false} aria-current={page === "stats" ? "page" : undefined}>
          战绩查询
        </Link>
        <Link to="/sales" preload={false} aria-current={page === "sales" ? "page" : undefined}>
          折扣日历
        </Link>
        <Link
          to="/loadouts"
          preload={false}
          aria-current={page === "loadouts" ? "page" : undefined}
        >
          模拟挂载
        </Link>
        {testAccess && (
          <Link
            to="/weakpoints"
            preload={false}
            aria-current={page === "weakpoints" ? "page" : undefined}
          >
            坦克弱点
          </Link>
        )}
      </nav>
      <nav className="mobile-page-navigation" aria-label="工具页面">
        <GameSelect
          aria-label="切换页面"
          value={page}
          onValueChange={(value) => {
            const next = value;
            if (
              (next === "tree" ||
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
          {page === "disclaimer" && (
            <option value="disclaimer" disabled>
              免责声明
            </option>
          )}
          <option value="tree">科技树</option>
          <option value="lineups">出击队列</option>
          <option value="maps">陆战地图</option>
          <option value="stats">战绩查询</option>
          <option value="sales">折扣日历</option>
          <option value="loadouts">模拟挂载</option>
          {testAccess && <option value="weakpoints">坦克弱点</option>}
          {!testAccess && page === "weakpoints" && (
            <option value="weakpoints" disabled>
              坦克弱点（测试权限）
            </option>
          )}
        </GameSelect>
      </nav>
    </>
  );
}
