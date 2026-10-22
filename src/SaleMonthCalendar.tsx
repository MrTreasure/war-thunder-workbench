/* finesse · component=monthly-sale-calendar · existing workbench tokens and event evidence */
import { useState } from "react";
import type { CSSProperties } from "react";
import {
  beijingDayKey,
  saleCalendarSpan,
  saleDate,
  saleRange,
  saleRate,
  placeSaleCalendarRanges,
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
  const ranges = placeSaleCalendarRanges(items, cells[0].key, cells[cells.length - 1].key);
  const details = selectedEventId
    ? items.filter((event) => event.id === selectedEventId)
    : selected
      ? onDay(selected)
      : [];
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
        活动以连续横条覆盖起止日期，跨周接续显示。点击横条查看完整信息；虚线为预测，浅色区段表示可能提前或延后的时间窗。
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
          {Array.from({ length: count / 7 }, (_, week) => {
            const weekCells = cells.slice(week * 7, week * 7 + 7),
              weekStart = weekCells[0].key,
              weekEnd = weekCells[6].key;
            const segments = ranges.filter(
              (range) => range.start <= weekEnd && range.end >= weekStart,
            );
            const lanes = Math.max(1, ...segments.map((range) => range.lane + 1));
            return (
              <tr key={week}>
                <td colSpan={7} className="wt-sale-week-cell">
                  <div
                    className="wt-sale-week"
                    style={{ "--wt-sale-week-lanes": lanes } as CSSProperties}
                  >
                    {weekCells.map((cell, column) => (
                      <button
                        key={cell.key}
                        className={`wt-sale-month-day ${cell.outside ? "outside" : ""} ${cell.key === selected && !selectedEventId ? "selected" : ""}`}
                        style={{ gridColumn: column + 1, gridRow: "1 / -1" }}
                        aria-pressed={cell.key === selected && !selectedEventId}
                        aria-current={cell.key === today ? "date" : undefined}
                        aria-label={`${dayLabel(cell.key)}，${onDay(cell.key).length}项优惠，点击查看当天活动`}
                        onClick={() => {
                          setSelected(cell.key);
                          setSelectedEventId(null);
                        }}
                      >
                        <span className="wt-sale-month-number">
                          <b>{cell.day}</b>
                          {cell.key === today && <small>今天</small>}
                        </span>
                      </button>
                    ))}
                    {segments.map(({ event, start, end, lane }) => {
                      const from = start < weekStart ? weekStart : start,
                        to = end > weekEnd ? weekEnd : end;
                      const column = Math.round((Date.parse(from) - Date.parse(weekStart)) / DAY),
                        days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
                      const coreFrom = beijingDayKey(event.startAt),
                        coreTo = beijingDayKey(event.endAt);
                      const percent = (day: string, inclusive: boolean) =>
                        Math.max(
                          0,
                          Math.min(
                            100,
                            (((Date.parse(day) - Date.parse(from)) / DAY + (inclusive ? 1 : 0)) /
                              days) *
                              100,
                          ),
                        );
                      const continuesLeft = start < weekStart,
                        continuesRight = end > weekEnd;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`wt-sale-range-bar ${event.status} ${continuesLeft ? "continues-left" : ""} ${continuesRight ? "continues-right" : ""}`}
                          style={
                            {
                              gridColumn: `${column + 1} / span ${days}`,
                              gridRow: lane + 2,
                              "--wt-sale-range-core-start": `${percent(coreFrom, false)}%`,
                              "--wt-sale-range-core-end": `${percent(coreTo, true)}%`,
                            } as CSSProperties
                          }
                          aria-pressed={selectedEventId === event.id}
                          aria-label={`${event.title}，${saleRange(event)}，点击查看活动详情`}
                          title={`${event.title} · ${saleRange(event)}`}
                          onClick={() => {
                            setSelected(from);
                            setSelectedEventId(event.id);
                          }}
                        >
                          <span className="wt-sale-range-start">
                            {continuesLeft
                              ? "‹ 接上周"
                              : event.status === "predicted"
                                ? "预计窗口"
                                : `${saleDate(event.startAt)}起`}
                          </span>
                          <span className="wt-sale-range-name">{event.title}</span>
                          <span className="wt-sale-range-end">
                            {continuesRight
                              ? "下周续 ›"
                              : event.status === "predicted"
                                ? "窗口止"
                                : `${saleDate(event.endAt)}止`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!loading && monthCount === 0 && (
        <p className="wt-sale-no-events">本月没有符合筛选条件的活动，可切换月份或调整筛选。</p>
      )}
      {selected && (
        <section className="wt-sale-day-details" aria-live="polite" aria-label="所选日期活动">
          <div className="wt-sales-section-title">
            <h4>{selectedEventId ? "活动详情" : dayLabel(selected)}</h4>
            <span>{details.length}项活动</span>
            <button
              onClick={() => {
                setSelected(null);
                setSelectedEventId(null);
              }}
              aria-label="关闭日期详情"
            >
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
