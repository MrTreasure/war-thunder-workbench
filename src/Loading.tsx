import { downloadLabel } from "./data-loader";
import type { DownloadProgress } from "./data-loader";
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
        <div className="wt-loading-caption">载具研发档案</div>
        <h1>{error ? "数据读取失败" : title}</h1>
        <p className="wt-loading-copy">{error || "科技树 · 配件研发 · 研发清单"}</p>
        <progress
          className="wt-loading-progress"
          value={percent}
          max={100}
          aria-label="实际数据下载进度"
        />
        <div className="wt-loading-status">
          <span>
            {error ? "请检查连接后重试" : progress.total ? "正在读取资料" : "正在准备资料"}
          </span>
          <span>{error ? "" : downloadLabel(progress)}</span>
        </div>
        {retry && (
          <button className="wt-loading-retry" onClick={retry}>
            {error ? "重新读取" : "重新加载"}
          </button>
        )}
      </div>
      <span className="wt-loading-version">WAR THUNDER · PC / 国际服</span>
    </section>
  );
}
