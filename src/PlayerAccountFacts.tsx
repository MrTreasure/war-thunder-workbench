import { useLocale } from "./i18n/react";
import { t, localize, getLocale } from "./i18n/core";
import { useState } from "react";
import { RelativeTime } from "./RelativeTime";
import type { PlayerDetails } from "./player-rankings-api";

/** Reuse the current snapshot's details; never trigger another player query. */
export function PlayerAccountFacts({
  details,
  loading,
}: {
  details: PlayerDetails | null;
  loading: boolean;
}) {
  useLocale();
  const [showHours, setShowHours] = useState(true);
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
  const years = hours == null ? null : hours / (365 * 8);
  const unavailable = loading && !details ? t("读取中…") : "—";
  return (
    <dl className="wt-record-player-facts">
      <div>
        <dt>{t("注册时间")}</dt>
        <dd>
          {localize(validDate ? <RelativeTime value={validDate.toISOString()} /> : unavailable)}
        </dd>
      </div>
      <div>
        <dt>{t("服役时长")}</dt>
        <dd>
          {localize(
            hours == null || years == null ? (
              unavailable
            ) : (
              <button
                type="button"
                aria-pressed={showHours}
                aria-label={showHours ? t("切换为服役年数") : t("切换为精确小时数")}
                title={t(
                  "按官方已返回的各玩法、各模式载具使用时长合计，每天 8 小时、每年 365 天折算；点击切换年数与小时数。不含排队时间，不代表客户端在线或 Steam 运行时间。",
                )}
                onClick={() => setShowHours((value) => !value)}
              >
                {localize(
                  showHours
                    ? new Intl.NumberFormat(getLocale(), {
                        style: "unit",
                        unit: "hour",
                        unitDisplay: "long",
                        maximumFractionDigits: 4,
                      }).format(hours)
                    : years > 0 && years < 0.01
                      ? t("不足 0.01 年")
                      : new Intl.NumberFormat(getLocale(), {
                          style: "unit",
                          unit: "year",
                          unitDisplay: "long",
                          maximumFractionDigits: 2,
                        }).format(years),
                )}
              </button>
            ),
          )}
        </dd>
      </div>
    </dl>
  );
}
