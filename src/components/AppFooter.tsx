import { Link, useRouterState } from "@tanstack/react-router";
import "./app-footer.css";

/** Compact shared footer; the immersive research tree has no footer. */
export function AppFooter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/tree" || pathname === "/") return null;
  const international = location.hostname === "wt.mrtreasure.cc";
  const main = location.hostname === "render.qmuse.pub";
  return (
    <footer className="wt-app-footer" aria-label="站点信息">
      <div className="wt-app-footer-inner">
        <span>非官方玩家工具</span>
        <Link to="/disclaimer" preload={false}>
          免责声明
        </Link>
        <a
          href="https://github.com/MrTreasure/war-thunder-workbench/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          反馈 ↗
        </a>
        <nav aria-label="切换站点">
          <a
            href="https://render.qmuse.pub/p/muse/8645013411493394"
            aria-current={main ? "page" : undefined}
          >
            主站{main ? "（当前）" : " ↗"}
          </a>
          <a href="https://wt.mrtreasure.cc/" aria-current={international ? "page" : undefined}>
            国际站{international ? "（当前）" : " ↗"}
          </a>
        </nav>
        <span className="wt-app-platform-credit">
          本应用通过{" "}
          <a
            href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
            target="_blank"
            rel="noopener noreferrer"
          >
            QMuse Vibecoding 平台 ↗
          </a>{" "}
          搭建
        </span>
      </div>
    </footer>
  );
}
