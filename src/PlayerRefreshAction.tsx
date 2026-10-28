import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useEffect, useState } from "react";
import { RefreshTextAction } from "./RefreshTextAction";
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
  useLocale();
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
    <RefreshTextAction
      busy={busy}
      disabled={disabled}
      refresh={refresh}
      highlighted={expired}
      title={t("重新获取官方资料")}
      label={expired ? t("缓存已过期，点击刷新") : t("强制刷新")}
      busyLabel={t("正在获取…")}
    />
  );
}
