import { Link, useNavigate } from "@tanstack/react-router";
import { GameSelect } from "./GameSelect";
export function PageNavigation({
  page,
}: {
  page: "tree" | "lineups" | "maps" | "stats" | "sales" | "decals" | "disclaimer";
}) {
  const navigate = useNavigate();
  return (
    <>
      <nav className="page-navigation" aria-label="工具页面">
        <Link to="/tree" preload={false} aria-current={page === "tree" ? "page" : undefined}>
          科技树
        </Link>
        <Link to="/lineups" preload={false} aria-current={page === "lineups" ? "page" : undefined}>
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
                next === "sales") &&
              next !== page
            )
              void navigate({ to: `/${next}` });
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
        </GameSelect>
      </nav>
    </>
  );
}
