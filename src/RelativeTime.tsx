import { useEffect, useState } from "react";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "always" });

export function RelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return <>—</>;
  const seconds = (timestamp - now) / 1000;
  const unit = units.find(([, duration]) => Math.abs(seconds) >= duration);
  const text = unit ? formatter.format(Math.trunc(seconds / unit[1]), unit[0]) : "刚刚";
  return (
    <time dateTime={value} title={new Date(timestamp).toLocaleString("zh-CN")}>
      {text}
    </time>
  );
}
