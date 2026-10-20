export function PageNavigation({ page }: { page: "tree" | "lineups" }) {
  return (
    <>
      <nav className="page-navigation" aria-label="工具页面">
        <a href="#/tree" aria-current={page === "tree" ? "page" : undefined}>
          科技树
        </a>
        <a href="#/lineups" aria-current={page === "lineups" ? "page" : undefined}>
          出击队列
        </a>
      </nav>
      <nav className="mobile-page-navigation" aria-label="工具页面">
        <select
          aria-label="切换页面"
          value={page}
          onChange={(event) => {
            const next = event.target.value;
            if ((next === "tree" || next === "lineups") && next !== page)
              location.hash = `/${next}`;
          }}
        >
          <option value="tree">科技树</option>
          <option value="lineups">出击队列</option>
        </select>
      </nav>
    </>
  );
}
