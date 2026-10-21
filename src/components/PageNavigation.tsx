import { GameSelect } from "./GameSelect";
export function PageNavigation({ page }: { page: "tree" | "lineups" | "maps" }) {
  return (
    <>
      <nav className="page-navigation" aria-label="工具页面">
        <a href="#/tree" aria-current={page === "tree" ? "page" : undefined}>
          科技树
        </a>
        <a href="#/lineups" aria-current={page === "lineups" ? "page" : undefined}>
          出击队列
        </a>
        <a href="#/maps" aria-current={page === "maps" ? "page" : undefined}>
          陆战地图
        </a>
      </nav>
      <nav className="mobile-page-navigation" aria-label="工具页面">
        <GameSelect
          aria-label="切换页面"
          value={page}
          onValueChange={(value) => {
            const next = value;
            if ((next === "tree" || next === "lineups" || next === "maps") && next !== page)
              location.hash = `/${next}`;
          }}
        >
          <option value="tree">科技树</option>
          <option value="lineups">出击队列</option>
          <option value="maps">陆战地图</option>
        </GameSelect>
      </nav>
    </>
  );
}
