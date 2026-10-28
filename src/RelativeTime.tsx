import { useLocale } from "./i18n/react";
import { t, localize, getLocale } from "./i18n/core";
import { useState, useSyncExternalStore } from "react";
import { relativeClockSnapshot, subscribeRelativeClock } from "./relative-time-clock";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function RelativeTime({
  value,
  interactive = true,
}: {
  value: string;
  interactive?: boolean;
}) {
  useLocale();
  const now = useSyncExternalStore(
    subscribeRelativeClock,
    relativeClockSnapshot,
    relativeClockSnapshot,
  );
  const [showDate, setShowDate] = useState(false);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return <>—</>;
  const formatter = new Intl.RelativeTimeFormat(getLocale(), { numeric: "always" });
  const seconds = (timestamp - now) / 1000;
  const unit = units.find(([, duration]) => Math.abs(seconds) >= duration);
  const text = unit ? formatter.format(Math.trunc(seconds / unit[1]), unit[0]) : t("刚刚");
  const date = new Date(timestamp).toLocaleDateString(getLocale());
  const content = <time dateTime={value}>{localize(showDate ? date : text)}</time>;
  return interactive ? (
    <button
      type="button"
      className="wt-relative-time"
      aria-pressed={showDate}
      aria-label={`${showDate ? date : text}，${showDate ? t("切换为相对时间") : t("切换为日期")}`}
      title={showDate ? t("点击查看相对时间") : t("点击查看日期")}
      onClick={() => setShowDate((previous) => !previous)}
    >
      {localize(content)}
    </button>
  ) : (
    <time dateTime={value} title={date}>
      {localize(text)}
    </time>
  );
}
