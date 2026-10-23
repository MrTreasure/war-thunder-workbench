/* finesse · component=monthly-sale-calendar · existing workbench tokens and event evidence */
import { useState } from "react";
import type { CSSProperties } from "react";
import {
  beijingDayKey,
  saleCalendarSpan,
  saleDate,
  saleRange,
  saleRate,
  saleEventNote,
  saleActivity,
  placeSaleCalendarRanges,
  saleStartCandidates,
} from "./sale-calendar-model";
import type { SaleEvent } from "./sale-calendar-model";

const DAY = 86400000;
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
function stage(event: SaleEvent, key: string, now: number): string {
  if (event.status === "predicted") {
    if (key < beijingDayKey(now)) return "日期已过";
    const candidate = saleStartCandidates(event, now).find((item) => item.day === key);
    if (candidate) return `候选开始 · ${candidate.label}`;
  }
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
  now,
  years,
  navigate,
  goToday,
  loading,
}: {
  year: number;
  month: number;
  events: SaleEvent[];
  today: string;
  now: number;
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
        实线为官方活动，虚线为预测。◆
        标记候选开始日，高／中／低表示相对可能性；过往日期不再作为开始候选。
      </p>
      <div className="wt-sale-confidence-legend" aria-label="候选开始日图例">
        <span className="confidence-high">◆ 高：参考日</span>
        <span className="confidence-medium">◆ 中：附近日期</span>
        <span className="confidence-low">◆ 低：较远日期</span>
      </div>
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
                      const candidates = saleStartCandidates(event, now).filter(
                        (item) => item.day >= from && item.day <= to,
                      );
                      const candidateLabel = candidates
                        .map((item) => `${saleDate(item.at)}开始可能性${item.label}`)
                        .join("，");
                      const continuesLeft = start < weekStart,
                        continuesRight = end > weekEnd;
                      const activity = saleActivity(event, now);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`wt-sale-range-bar ${event.status} activity-${activity.state} ${continuesLeft ? "continues-left" : ""} ${continuesRight ? "continues-right" : ""}`}
                          style={
                            {
                              gridColumn: `${column + 1} / span ${days}`,
                              gridRow: lane + 2,
                            } as CSSProperties
                          }
                          aria-pressed={selectedEventId === event.id}
                          aria-label={`${event.title}，${activity.fullLabel}，${saleRange(event)}，${candidateLabel}，点击查看活动详情`}
                          title={`${event.title} · ${activity.fullLabel} · ${saleRange(event)}${candidateLabel ? " · " + candidateLabel : ""}`}
                          onClick={(click) => {
                            const marker = (click.target as Element).closest<HTMLElement>(
                              "[data-start-day]",
                            );
                            setSelected(marker?.dataset.startDay || from);
                            setSelectedEventId(event.id);
                          }}
                        >
                          <span className="wt-sale-range-heading">
                            <span className="wt-sale-range-start">
                              {!continuesLeft &&
                                (event.status === "predicted"
                                  ? "预计窗口"
                                  : `${saleDate(event.startAt)}起`)}
                            </span>
                            <span className="wt-sale-activity-status">
                              {event.status === "predicted" && <i>预计</i>}
                              {activity.label}
                            </span>
                            <span className="wt-sale-range-name">{event.title}</span>
                            <span className="wt-sale-range-end">
                              {!continuesRight &&
                                (event.status === "predicted"
                                  ? "窗口止"
                                  : `${saleDate(event.endAt)}止`)}
                            </span>
                          </span>
                          {event.status === "predicted" && (
                            <span className="wt-sale-start-markers">
                              {candidates.map((candidate) => (
                                <span
                                  key={candidate.day}
                                  className={`wt-sale-start-marker confidence-${candidate.confidence} ${candidate.preferred ? "preferred" : ""}`}
                                  data-start-day={candidate.day}
                                  style={{
                                    left: `${(((Date.parse(candidate.day) - Date.parse(from)) / DAY + 0.5) / days) * 100}%`,
                                  }}
                                  title={`${saleDate(candidate.at)} · 预计开始 · 可能性${candidate.label}`}
                                >
                                  <span aria-hidden="true">◆</span>
                                  {candidate.shortLabel}
                                </span>
                              ))}
                            </span>
                          )}
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
                  <span className={`wt-sale-badge ${event.status}`}>
                    {stage(event, selected, now)}
                  </span>
                  <span
                    className={`wt-sale-activity-status activity-${saleActivity(event, now).state}`}
                  >
                    {saleActivity(event, now).fullLabel}
                  </span>
                  <strong>{saleRate(event)}</strong>
                </div>
                <p>{saleRange(event)}</p>
                {event.status === "predicted" && (
                  <div className="wt-sale-candidate-list" aria-label="候选开始日与相对可能性">
                    {saleStartCandidates(event, now).map((candidate) => (
                      <span key={candidate.day} className={`confidence-${candidate.confidence}`}>
                        {saleDate(candidate.at)} <b>{candidate.label}</b>
                        {candidate.preferred ? " · 参考" : ""}
                      </span>
                    ))}
                  </div>
                )}
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
                  </p>
                )}
                {saleEventNote(event) && (
                  <p>
                    {event.status === "predicted" ? "历史参与情况：" : ""}
                    {saleEventNote(event)}
                  </p>
                )}
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
