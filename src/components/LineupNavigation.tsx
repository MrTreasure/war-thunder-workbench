import { Link } from "@tanstack/react-router";
export function LineupNavigation({
  garage = false,
  lobby = false,
}: {
  garage?: boolean;
  lobby?: boolean;
}) {
  return (
    <nav className="wt-lineup-sections" aria-label="出击队列功能">
      <Link
        to="/lineups"
        activeOptions={{ exact: true }}
        aria-current={!garage && !lobby ? "page" : undefined}
      >
        出击队列
      </Link>
      <Link to="/lineups/garage" aria-current={garage ? "page" : undefined}>
        我的车库
      </Link>
      <Link to="/lineups/lobby" aria-current={lobby ? "page" : undefined}>
        队列大厅
      </Link>
    </nav>
  );
}
