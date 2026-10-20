export function PageNavigation({ page }: { page: "tree" | "lineups" }) {
  return (
    <nav className="page-navigation" aria-label="工具页面">
      <a href="#/tree" aria-current={page === "tree" ? "page" : undefined}>
        科技树
      </a>
      <a href="#/lineups" aria-current={page === "lineups" ? "page" : undefined}>
        出击队列
      </a>
    </nav>
  );
}
