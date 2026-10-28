import type { PlayerDetails } from "./player-rankings-api";

/** Reuse the current snapshot's details; never trigger another player query. */
export function PlayerAccountFacts({
  details,
  loading,
}: {
  details: PlayerDetails | null;
  loading: boolean;
}) {
  const registered = details?.registeredAt;
  const date = registered != null && registered > 0 ? new Date(registered * 1000) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const durations = (details?.usage || [])
    .flatMap((group) => group.roles)
    .map((role) => role.seconds)
    .filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
  const hours = durations.length
    ? durations.reduce((total, seconds) => total + seconds, 0) / 3600
    : null;
  const unavailable = loading && !details ? "读取中…" : "—";
  return (
    <dl className="wt-record-player-facts">
      <div>
        <dt>注册时间</dt>
        <dd>
          {validDate ? (
            <time dateTime={validDate.toISOString()}>{validDate.toLocaleDateString("zh-CN")}</time>
          ) : (
            unavailable
          )}
        </dd>
      </div>
      <div>
        <dt>游玩时长</dt>
        <dd title="按官方已返回的各玩法、各模式载具使用时长合计，不含排队时间；不代表客户端在线或 Steam 运行时间。">
          {hours == null
            ? unavailable
            : hours > 0 && hours < 0.1
              ? "不足 0.1 小时"
              : `${hours.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 小时`}
        </dd>
      </div>
    </dl>
  );
}
