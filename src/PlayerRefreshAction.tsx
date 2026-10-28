import { useEffect, useState } from "react";
import type { PlayerProfile } from "./player-stats-api";

export function PlayerRefreshAction({
  profile,
  busy,
  disabled,
  refresh,
}: {
  profile: Pick<PlayerProfile, "expiresAt" | "stale">;
  busy: boolean;
  disabled: boolean;
  refresh: () => void;
}) {
  const [expired, setExpired] = useState(
    () => !!profile.stale || Date.parse(profile.expiresAt) <= Date.now(),
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = Date.parse(profile.expiresAt) - Date.now();
      setExpired(!!profile.stale || remaining <= 0);
      if (!profile.stale && Number.isFinite(remaining) && remaining > 0)
        timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [profile.expiresAt, profile.stale]);
  return (
    <span className="wt-record-refresh-action">
      <button
        type="button"
        className="wt-record-player-refresh"
        data-expired={expired || undefined}
        aria-busy={busy}
        title="重新获取官方资料，计入新查询次数"
        disabled={disabled}
        onClick={refresh}
      >
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            d="M16.5 7A7 7 0 1 0 17 11M16.5 2.5V7H12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span aria-live="polite">
          {busy ? "正在获取…" : expired ? "缓存已过期，点击刷新" : "强制刷新"}
        </span>
      </button>
      <small>计入新查询次数</small>
    </span>
  );
}
