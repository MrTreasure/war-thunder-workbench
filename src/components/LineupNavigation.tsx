import { Link } from "@tanstack/react-router";
export function LineupNavigation({ garage = false }: { garage?: boolean }) {
  return (
    <nav className="wt-lineup-sections" aria-label="出击队列功能">
      <Link to="/lineups" aria-current={!garage ? "page" : undefined}>
        出击队列
      </Link>
      <Link to="/lineups/garage" aria-current={garage ? "page" : undefined}>
        我的车库
      </Link>
    </nav>
  );
}
