import { useEffect, useState } from "react";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "always" });

export function RelativeTime({
  value,
  interactive = true,
}: {
  value: string;
  interactive?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  const [showDate, setShowDate] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return <>—</>;
  const seconds = (timestamp - now) / 1000;
  const unit = units.find(([, duration]) => Math.abs(seconds) >= duration);
  const text = unit ? formatter.format(Math.trunc(seconds / unit[1]), unit[0]) : "刚刚";
  const date = new Date(timestamp).toLocaleDateString("zh-CN");
  const content = <time dateTime={value}>{showDate ? date : text}</time>;
  return interactive ? (
    <button
      type="button"
      className="wt-relative-time"
      aria-pressed={showDate}
      aria-label={`${showDate ? date : text}，${showDate ? "切换为相对时间" : "切换为日期"}`}
      title={showDate ? "点击查看相对时间" : "点击查看日期"}
      onClick={() => setShowDate((previous) => !previous)}
    >
      {content}
    </button>
  ) : (
    <time dateTime={value} title={date}>
      {text}
    </time>
  );
}
