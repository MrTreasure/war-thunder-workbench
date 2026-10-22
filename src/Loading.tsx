import { downloadLabel } from "./data-loader";
import type { DownloadProgress } from "./data-loader";
const loadingFeatures = [
  ["01", "科技树与研发", "十国载具 · 配件报价 · 研发清单", "#/tree"],
  ["02", "出击队列", "阵容配置 · BR 核对 · 分享码", "#/lineups"],
  ["03", "陆战地图", "地图详情 · 战术标注 · 攻略", "#/maps"],
  ["04", "战绩查询", "官方排行榜 · 玩家数据 · AI 战报", "#/stats"],
  ["05", "账号估值", "公开车库 · 未出战载具 · 价值明细", "#/stats"],
  ["06", "折扣日历", "折扣记录 · 降价预测 · 载具关注", "#/sales"],
];
export function WarThunderLoading({
  title,
  progress,
  error,
  retry,
  compact = false,
}: {
  title: string;
  progress: DownloadProgress;
  error?: string;
  retry?: () => void;
  compact?: boolean;
}) {
  const percent = progress.total ? Math.min(100, (progress.received / progress.total) * 100) : 0;
  return (
    <section
      className={`wt-loading ${compact ? "wt-loading-compact" : ""}`}
      aria-label={error ? "数据加载失败" : title}
    >
      <div className="wt-loading-content">
        <img
          className="wt-loading-logo"
          src="https://warthunder.com/assets/img/svg/logo-wt.svg"
          width={208}
          height={100}
          alt="War Thunder"
        />
        <div className="wt-loading-caption">WAR THUNDER / PLAYER WORKBENCH</div>
        <h1>{error ? "数据读取失败" : title}</h1>
        <p className="wt-loading-copy">
          {error ||
            (compact
              ? "包含本国全部军种与改装资料，载入后可直接切换。"
              : "从研发规划到战场复盘，常用工具集中在这里。")}
        </p>
        {!compact && (
          <nav className="wt-loading-features" aria-label="工作台功能">
            {loadingFeatures.map(([number, name, description, href]) => (
              <a key={number} href={href}>
                <span className="wt-loading-feature-number" aria-hidden="true">
                  {number}
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>{description}</small>
                </span>
                <span className="wt-loading-feature-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </nav>
        )}
        <div className="wt-loading-transfer">
          <progress
            className="wt-loading-progress"
            value={progress.total ? percent : undefined}
            max={100}
            aria-label={progress.total ? "资料读取进度" : "正在加载国家资料"}
          />
          <div className="wt-loading-status">
            <span>
              {error ? "请检查连接后重试" : progress.total ? "正在读取资料" : "正在准备资料"}
            </span>
            <span>{error ? "" : downloadLabel(progress)}</span>
          </div>
        </div>
        {retry && error && (
          <button className="wt-loading-retry" onClick={retry}>
            {error ? "重新读取" : "重新加载"}
          </button>
        )}
      </div>
      <span className="wt-loading-version">WAR THUNDER · PC / 国际服</span>
    </section>
  );
}
