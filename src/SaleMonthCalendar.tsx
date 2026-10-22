/* finesse · component=monthly-sale-calendar · existing workbench tokens and event evidence */
import { useState } from "react";
import {
  beijingDayKey,
  saleCalendarSpan,
  saleDate,
  saleRange,
  saleRate,
} from "./sale-calendar-model";
import type { SaleEvent } from "./sale-calendar-model";

const DAY = 86400000;
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
function stage(event: SaleEvent, key: string): string {
  const start = beijingDayKey(event.startAt),
    end = beijingDayKey(event.endAt);
  if (start === key && end === key)
    return event.status === "predicted" ? "预计起止" : "当日开始／结束";
  if (key === start) return event.status === "predicted" ? "预计开始" : "开始";
  if (key === end) return event.status === "predicted" ? "预计结束" : "结束";
  if (key < start || key > end) return "预测时间窗";
  return event.status === "predicted" ? "预计期间" : "优惠期间";
}
export function SaleMonthCalendar({
  year,
  month,
  events,
  today,
  years,
  navigate,
  goToday,
  loading,
}: {
  year: number;
  month: number;
  events: SaleEvent[];
  today: string;
  years: number[];
  navigate: (offset: number) => void;
  goToday: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const first = Date.UTC(year, month - 1, 1),
    offset = (new Date(first).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: count }, (_, i) => {
    const value = new Date(first + (i - offset) * DAY);
    return {
      key: value.toISOString().slice(0, 10),
      day: value.getUTCDate(),
      outside: value.getUTCMonth() !== month - 1,
    };
  });
  const items = [...events].sort(
    (a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id),
  );
  const onDay = (key: string) =>
    items.filter((event) => {
      const span = saleCalendarSpan(event);
      return span.start <= key && span.end >= key;
    });
  const details = selected ? onDay(selected) : [];
  const previousYear = month === 1 ? year - 1 : year,
    nextYear = month === 12 ? year + 1 : year;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;
  const monthCount = items.filter((event) => {
    const span = saleCalendarSpan(event);
    return span.start <= monthEnd && span.end >= monthStart;
  }).length;
  return (
    <div className="wt-sale-month" aria-busy={loading}>
      <div className="wt-sale-month-toolbar">
        <div>
          <h4>
            {year}年{month}月
          </h4>
          <span>{loading ? "正在读取活动…" : `${monthCount} 个活动阶段`}</span>
        </div>
        <div className="wt-sale-month-navigation">
          <button
            aria-label="上个月"
            disabled={!years.includes(previousYear)}
            onClick={() => navigate(-1)}
          >
            ‹
          </button>
          <button onClick={goToday}>本月</button>
          <button
            aria-label="下个月"
            disabled={!years.includes(nextYear)}
            onClick={() => navigate(1)}
          >
            ›
          </button>
        </div>
      </div>
      <p className="wt-sale-month-guide">
        点击日期查看完整活动。实线为官方日期，虚线为预测；“预计开始／结束”是参考日，浅色部分为可能提前或延后的时间窗。
      </p>
      <table className="wt-sale-month-grid" aria-label={`${year}年${month}月优惠月历`}>
        <thead>
          <tr>
            {weekdays.map((day, index) => (
              <th key={day} scope="col" className={index >= 5 ? "weekend" : undefined}>
                周{day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count / 7 }, (_, week) => (
            <tr key={week}>
              {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                const list = onDay(cell.key);
                return (
                  <td
                    key={cell.key}
                    className={`${cell.outside ? "outside" : ""} ${cell.key === selected ? "selected" : ""}`}
                  >
                    <button
                      className="wt-sale-month-day"
                      aria-pressed={cell.key === selected}
                      aria-current={cell.key === today ? "date" : undefined}
                      aria-label={`${dayLabel(cell.key)}，${list.length}项优惠${list.length ? "，点击查看开始和结束信息" : ""}`}
                      onClick={() => setSelected(cell.key)}
                    >
                      <span className="wt-sale-month-number">
                        <b>{cell.day}</b>
                        {cell.key === today && <small>今天</small>}
                      </span>
                      <span className="wt-sale-month-day-events">
                        {list.slice(0, 2).map((event) => {
                          const label = stage(event, cell.key),
                            windowOnly = label === "预测时间窗";
                          return (
                            <span
                              key={event.id}
                              className={`wt-sale-month-chip ${event.status} ${windowOnly ? "window-only" : ""}`}
                              title={`${event.title} · ${label} · ${saleRange(event)}`}
                            >
                              <span className="wt-sale-month-stage">{label}</span>
                              <span className="wt-sale-month-event-name">{event.title}</span>
                            </span>
                          );
                        })}
                      </span>
                      {list.length > 2 && (
                        <span className="wt-sale-month-more">另有 {list.length - 2} 项</span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && monthCount === 0 && (
        <p className="wt-sale-no-events">本月没有符合筛选条件的活动，可切换月份或调整筛选。</p>
      )}
      {selected && (
        <section className="wt-sale-day-details" aria-live="polite" aria-label="所选日期活动">
          <div className="wt-sales-section-title">
            <h4>{dayLabel(selected)}</h4>
            <span>{details.length}项活动</span>
            <button onClick={() => setSelected(null)} aria-label="关闭日期详情">
              ×
            </button>
          </div>
          {!details.length ? (
            <p>当天没有符合筛选条件的活动。</p>
          ) : (
            details.map((event) => (
              <article key={event.id}>
                <div className="wt-sale-day-detail-heading">
                  <h4>{event.title}</h4>
                  <span className={`wt-sale-badge ${event.status}`}>{stage(event, selected)}</span>
                  <strong>{saleRate(event)}</strong>
                </div>
                <p>{saleRange(event)}</p>
                {event.status === "confirmed" && (
                  <p>
                    开始：
                    {event.startPrecision === "day"
                      ? `${saleDate(event.startAt)}（公告未注明时刻）`
                      : new Date(event.startAt).toLocaleString("zh-CN", {
                          timeZone: "Asia/Shanghai",
                        })}{" "}
                    · 结束：
                    {new Date(event.endAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                    （北京时间，结束时刻不含在活动内）
                  </p>
                )}
                <p>{event.notes}</p>
                {event.sources.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {event.status === "predicted" ? "历史依据" : "官方公告"} ↗
                  </a>
                ))}
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
