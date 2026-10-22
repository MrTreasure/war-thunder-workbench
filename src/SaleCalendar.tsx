import { useEffect, useId, useMemo, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { SaleMonthCalendar } from "./SaleMonthCalendar";
import { useStored, object } from "./storage";
import { statsRequest, statsCategoryNames } from "./player-stats-api";
import bootstrap from "./generated/bootstrap.json";
import calendarReference from "../data/sale-calendar-reference.json";
import {
  nextSale,
  beijingDayKey,
  saleCalendarSpan,
  isSaleWatchVehicle,
  saleChannels,
  saleCountdown,
  saleDate,
  saleRange,
  saleRate,
  saleOriginalPrice,
  saleEventNote,
} from "./sale-calendar-model";
import type { SaleCalendarData, SaleEvent, SaleVehicle } from "./sale-calendar-model";

const countries: Record<string, string> = bootstrap.countries;
const watchValid = (value: unknown): value is SaleVehicle[] =>
  Array.isArray(value) &&
  value.length <= 60 &&
  value.every(
    (v) =>
      object(v) &&
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      typeof v.country === "string" &&
      typeof v.category === "string" &&
      typeof v.channel === "string" &&
      v.channel in saleChannels &&
      typeof v.image === "string" &&
      v.image.startsWith("https://static.encyclopedia.warthunder.com/"),
  );
function VehiclePicture({ vehicle }: { vehicle: SaleVehicle }) {
  return (
    <img
      src={vehicle.image}
      alt=""
      loading="lazy"
      width={112}
      height={70}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}
function VehicleOriginalPrice({ vehicle }: { vehicle: SaleVehicle }) {
  const quote = vehicle.originalPrice;
  return (
    <div className="wt-sale-original-price">
      <span>{saleOriginalPrice(vehicle)}</span>
      {quote?.checkedAt && (
        <small>
          核对于{" "}
          {new Date(quote.checkedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}
        </small>
      )}
    </div>
  );
}
function CalendarReference({ close }: { close: () => void }) {
  const [failed, setFailed] = useState(false);
  const asset = calendarReference.asset;
  return (
    <Modal
      title="折扣年历 · 高清参考图"
      subtitle={`${calendarReference.attribution}；保留原图样式，仅放大并轻度清晰化。`}
      close={close}
      className="wt-sale-reference-viewer"
    >
      <div className="wt-sale-reference-caption">
        <p>{calendarReference.notice}</p>
        {asset && (
          <a href={asset.rawUrl} target="_blank" rel="noreferrer">
            查看高清原图 ↗
          </a>
        )}
      </div>
      {asset && !failed ? (
        <img
          src={asset.url}
          width={asset.width}
          height={asset.height}
          alt="战争雷霆折扣年历：全系促销、专题纪念活动及参与条件，历史整理不代表当年公告。"
          onError={(event) => {
            if (event.currentTarget.src !== asset.rawUrl) event.currentTarget.src = asset.rawUrl;
            else setFailed(true);
          }}
        />
      ) : (
        <p role="alert">参考图暂时无法加载，请通过上方链接查看高清原图。</p>
      )}
    </Modal>
  );
}
function AddVehicles({
  saved,
  add,
  close,
}: {
  saved: SaleVehicle[];
  add: (v: SaleVehicle) => void;
  close: () => void;
}) {
  const [country, setCountry] = useState("china"),
    [category, setCategory] = useState("all"),
    [rank, setRank] = useState("all"),
    [query, setQuery] = useState("");
  const [results, setResults] = useState<SaleVehicle[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setResults([]);
      void statsRequest<{ items: SaleVehicle[]; total: number }>(
        `sales/vehicles?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&rank=${encodeURIComponent(rank)}&q=${encodeURIComponent(query.trim())}`,
        undefined,
        controller.signal,
      )
        .then((r) => {
          if (!controller.signal.aborted) {
            setResults(r.items.filter(isSaleWatchVehicle));
            setTotal(r.total);
          }
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [country, category, rank, query]);
  return (
    <Modal
      title="添加关注载具"
      subtitle="仅支持金鹰与商城礼包载具；关注列表保存在当前浏览器。"
      close={close}
      className="wt-sale-picker"
    >
      <div className="wt-sale-picker-controls">
        <GameSelect aria-label="载具国家" value={country} onValueChange={setCountry}>
          {Object.entries(countries).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>
        <GameSelect aria-label="载具军种" value={category} onValueChange={setCategory}>
          <option value="all">全部军种</option>
          {Object.entries(statsCategoryNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>
        <GameSelect aria-label="载具等级" value={rank} onValueChange={setRank}>
          <option value="all">全部等级</option>
          {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"].map((value) => (
            <option key={value} value={value}>
              {value}级
            </option>
          ))}
        </GameSelect>
        <input
          aria-label="搜索载具"
          placeholder="名称或载具代号"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="wt-sale-picker-results" aria-live="polite" aria-busy={loading}>
        {error ? (
          <p role="alert">{error}</p>
        ) : loading ? (
          <p>正在查找载具…</p>
        ) : !results.length ? (
          <p>没有找到匹配载具，试试其他名称。</p>
        ) : (
          results.map((vehicle) => {
            const added = saved.some((v) => v.id === vehicle.id);
            return (
              <div className="wt-sale-vehicle-option" key={vehicle.id}>
                <VehiclePicture vehicle={vehicle} />
                <div>
                  <strong>{vehicle.name}</strong>
                  <span>
                    {statsCategoryNames[vehicle.category]} · {vehicle.rank}级 ·{" "}
                    {saleChannels[vehicle.channel]}
                  </span>
                  <VehicleOriginalPrice vehicle={vehicle} />
                </div>
                <button disabled={added || saved.length >= 60} onClick={() => add(vehicle)}>
                  {added ? "已关注" : "＋ 关注"}
                </button>
              </div>
            );
          })
        )}
      </div>
      <footer>
        {loading ? "" : `找到 ${total} 辆，展示前 ${results.length} 辆。可继续输入名称缩小范围。`}
        <button onClick={close}>完成</button>
      </footer>
    </Modal>
  );
}
function SourceLinks({ event }: { event: SaleEvent }) {
  return (
    <>
      {event.sources.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
          {event.status === "predicted" ? "历史公告 ↗" : "官方公告 ↗"}
        </a>
      ))}
    </>
  );
}
export function SaleCalendar() {
  const [data, setData] = useState<SaleCalendarData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const [clock, setClock] = useState(() => Date.now()),
    [offset, setOffset] = useState(0);
  const [year, setYear] = useState(() => Number(beijingDayKey(Date.now()).slice(0, 4))),
    [month, setMonth] = useState(() => String(Number(beijingDayKey(Date.now()).slice(5, 7)))),
    [channel, setChannel] = useState("all"),
    [country, setCountry] = useState("all"),
    [status, setStatus] = useState("all");
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [watchExpanded, setWatchExpanded] = useState(false);
  const watchListId = useId();
  const [picker, setPicker] = useState(false),
    [watch, saveWatch, storageError] = useStored<SaleVehicle[]>(
      "wt-sale-watch-v1",
      [],
      watchValid,
      (entries) => entries.filter(isSaleWatchVehicle),
    );
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void statsRequest<SaleCalendarData>("sales", undefined, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) {
            setData(r);
            setOffset(Date.parse(r.serverNow) - Date.now());
          }
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reload]);
  const now = clock + offset;
  const events = useMemo(() => data?.events || [], [data]);
  const years = useMemo(() => [...new Set(events.map((e) => e.year))].sort(), [events]);
  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (channel === "all" || event.channels.some((c) => c === channel)) &&
          (country === "all" || !event.countries.length || event.countries.includes(country)) &&
          (status === "all" || event.status === status),
      ),
    [events, channel, country, status],
  );
  const periodStart = `${year}-${month === "all" ? "01" : month.padStart(2, "0")}-01`;
  const periodEnd =
    month === "all"
      ? `${year}-12-31`
      : `${year}-${month.padStart(2, "0")}-${new Date(Date.UTC(year, Number(month), 0)).getUTCDate()}`;
  const visible = filtered.filter((event) => {
    const span = saleCalendarSpan(event);
    return span.start <= periodEnd && span.end >= periodStart;
  });
  const today = beijingDayKey(now);
  const switchView = (nextView: "calendar" | "timeline") => {
    if (nextView === "calendar" && month === "all")
      setMonth(year === Number(today.slice(0, 4)) ? String(Number(today.slice(5, 7))) : "1");
    setView(nextView);
  };
  const navigateMonth = (offset: number) => {
    const next = new Date(Date.UTC(year, Number(month) - 1 + offset, 1));
    setYear(next.getUTCFullYear());
    setMonth(String(next.getUTCMonth() + 1));
  };
  const next = events
    .filter((e) =>
      e.status === "confirmed"
        ? Date.parse(e.endAt) > now
        : Date.parse(e.endWindow?.[1] || e.endAt) > now,
    )
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0];
  const known = events.filter((e) => e.year === year && e.status === "confirmed").length;
  const add = (vehicle: SaleVehicle) => {
    if (isSaleWatchVehicle(vehicle) && watch.length < 60 && !watch.some((v) => v.id === vehicle.id))
      saveWatch([...watch, vehicle]);
  };
  return (
    <main className="wt-sales-page">
      <header className="wt-sales-heading">
        <div>
          <h2>
            <button
              className="wt-sale-title-button"
              onClick={() => setReferenceOpen(true)}
              aria-haspopup="dialog"
            >
              折扣日历<span>查看全年参考图 ↗</span>
            </button>
          </h2>
          <p>{calendarReference.notice}</p>
          <small className="wt-sale-attribution">{calendarReference.attribution}</small>
        </div>
        <div className="wt-sales-heading-actions">
          <button className="primary" onClick={() => setPicker(true)}>
            ＋ 添加载具
          </button>
        </div>
      </header>
      <details className="wt-sale-reading-guide">
        <summary>
          日历说明 <span>日期预测 · 参与范围 · 时间与平台</span>
        </summary>
        <dl>
          <div>
            <dt>日期预测</dt>
            <dd>
              按往年日期推算，开始与结束各预留 ±4
              天；黑五按感恩节次日、春节按农历新年调整。两个范围分别表示可能的开始日、结束日，预测中点仅供参考；预测不保证载具参与或折扣力度。
            </dd>
          </div>
          <div>
            <dt>参与范围</dt>
            <dd>
              “已公布”表示活动日期确认，不代表所列国家的全部载具参与。新版本载具、联队载具及其改装、护符、备份、组合购买门槛，以当次公告为准；金鹰充值、交易所商品、乘员与研发
              RP 不随购车活动自动降价。
            </dd>
          </div>
          <div>
            <dt>时间平台</dt>
            <dd>
              统一使用北京时间，结束时刻不含在活动内；公告未注明时刻时只显示日期。当前为 PC／Gaijin
              商城日历，游戏内与商城阶段分开，主机商店可能采用不同时间。
            </dd>
          </div>
        </dl>
      </details>
      {referenceOpen && <CalendarReference close={() => setReferenceOpen(false)} />}
      {error && (
        <div className="wt-sales-error" role="alert">
          {error} <button onClick={() => setReload((n) => n + 1)}>重试</button>
          {data && " · 上次日历仍保留"}
        </div>
      )}
      {storageError && <p role="alert">{storageError}</p>}
      <section className="wt-sales-topline" aria-label="活动概览">
        <div>
          <span>下一场活动</span>
          <strong>{next?.title || (loading ? "正在读取公告" : "暂无可用排期")}</strong>
          <small>{next ? saleCountdown(next, now) : "活动数据由服务器定期核对"}</small>
        </div>
        <div>
          <span>{year} 年排期</span>
          <strong>
            {known} <small>已公布阶段</small>
          </strong>
          <small>预测以虚线与“预计”区分</small>
        </div>
        <div>
          <span>我的关注</span>
          <strong>
            {watch.length} <small>辆载具</small>
          </strong>
          <small>按实际购买渠道寻找优惠窗口</small>
        </div>
      </section>
      <section className="wt-sale-watch">
        <div className="wt-sales-section-title">
          <h3>我的关注</h3>
        </div>
        {!watch.length ? (
          <div className="wt-sale-empty">
            <button
              type="button"
              className="wt-sale-add-icon"
              aria-label="添加关注载具"
              onClick={() => setPicker(true)}
            >
              ＋
            </button>
            <p>先把想买的载具放进关注列表</p>
            <span>关注金鹰与商城礼包载具，查看对应的优惠窗口和倒计时。</span>
            <button onClick={() => setPicker(true)}>选择载具</button>
          </div>
        ) : (
          <>
            <div className="wt-sale-watch-list" id={watchListId}>
              {(watchExpanded ? watch : watch.slice(0, 5)).map((vehicle) => {
                const event = nextSale(vehicle, events, now),
                  exact = event?.status === "confirmed" && event.vehicleIds.includes(vehicle.id);
                return (
                  <article key={vehicle.id} className="wt-sale-watch-row">
                    <VehiclePicture vehicle={vehicle} />
                    <div className="wt-sale-watch-identity">
                      <h4>{vehicle.name}</h4>
                      <span>
                        {countries[vehicle.country]} · {vehicle.rank}级 ·{" "}
                        {saleChannels[vehicle.channel]}
                      </span>
                      <VehicleOriginalPrice vehicle={vehicle} />
                    </div>
                    <div className="wt-sale-watch-opportunity">
                      {event ? (
                        <>
                          <strong>{event.title}</strong>
                          <span>{saleRange(event)}</span>
                          <small>
                            {event.status === "predicted"
                              ? "预测窗口，尚未公布名单"
                              : exact
                                ? "已核对参与名单"
                                : event.coverage === "all-except-exclusions"
                                  ? "常规优惠范围，需核对新车排除名单"
                                  : "可能相关，需核对指定载具名单"}
                          </small>
                        </>
                      ) : (
                        <span>
                          {["market", "excluded"].includes(vehicle.channel)
                            ? "此购买渠道不自动参与常规载具促销"
                            : "尚无匹配的优惠排期"}
                        </span>
                      )}
                    </div>
                    <div className="wt-sale-watch-countdown">
                      {event && (
                        <>
                          <b>{saleCountdown(event, now)}</b>
                          <small>{saleRate(event, vehicle.channel)}</small>
                          <SourceLinks event={event} />
                        </>
                      )}
                    </div>
                    <button
                      className="wt-sale-remove"
                      aria-label={`取消关注${vehicle.name}`}
                      onClick={() => saveWatch(watch.filter((v) => v.id !== vehicle.id))}
                    >
                      ×
                    </button>
                  </article>
                );
              })}
            </div>
            {watch.length > 5 && (
              <div className="wt-sale-watch-fold">
                <span>
                  已显示 {watchExpanded ? watch.length : 5} / {watch.length} 辆
                </span>
                <button
                  type="button"
                  aria-controls={watchListId}
                  aria-expanded={watchExpanded}
                  onClick={() => setWatchExpanded((value) => !value)}
                >
                  {watchExpanded ? "收起至 5 辆 ↑" : `展开全部 ${watch.length} 辆 ↓`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <section className="wt-sale-calendar">
        <div className="wt-sales-section-title">
          <h3>{view === "calendar" ? "优惠月历" : "年度优惠时间轴"}</h3>
          <span>
            <i className="wt-sale-dot" /> 官方已公布 <i className="wt-sale-dot predicted" />{" "}
            历史推算
          </span>
          <fieldset className="wt-sale-view-switch" aria-label="活动视图">
            <button aria-pressed={view === "calendar"} onClick={() => switchView("calendar")}>
              月历
            </button>
            <button aria-pressed={view === "timeline"} onClick={() => switchView("timeline")}>
              时间轴
            </button>
          </fieldset>
        </div>
        <div className="wt-sale-filters">
          <GameSelect
            aria-label="活动年份"
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            {(years.length ? years : [year]).map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </GameSelect>
          <GameSelect aria-label="月份" value={month} onValueChange={setMonth}>
            {view === "timeline" && <option value="all">全年</option>}
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} 月
              </option>
            ))}
          </GameSelect>
          <GameSelect aria-label="优惠渠道" value={channel} onValueChange={setChannel}>
            <option value="all">全部购买渠道</option>
            {Object.entries(saleChannels)
              .filter(([k]) => !["market", "excluded", "unknown"].includes(k))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </GameSelect>
          <GameSelect aria-label="活动国家" value={country} onValueChange={setCountry}>
            <option value="all">全部国家</option>
            {Object.entries(countries).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </GameSelect>
          <GameSelect aria-label="排期状态" value={status} onValueChange={setStatus}>
            <option value="all">已公布与预测</option>
            <option value="confirmed">官方已公布</option>
            <option value="predicted">仅看预测</option>
          </GameSelect>
        </div>
        {view === "calendar" ? (
          <SaleMonthCalendar
            key={`${year}-${month}`}
            year={year}
            month={Number(month)}
            events={filtered}
            today={today}
            years={years.length ? years : [year]}
            navigate={navigateMonth}
            goToday={() => {
              setYear(Number(today.slice(0, 4)));
              setMonth(String(Number(today.slice(5, 7))));
            }}
            loading={loading}
          />
        ) : (
          <>
            <fieldset className="wt-sale-year-strip" aria-label="按月份查看活动">
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1,
                  items = filtered.filter((event) => {
                    const span = saleCalendarSpan(event),
                      start = `${year}-${String(m).padStart(2, "0")}-01`,
                      end = `${year}-${String(m).padStart(2, "0")}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;
                    return span.start <= end && span.end >= start;
                  });
                return (
                  <button
                    key={m}
                    aria-pressed={month === String(m)}
                    onClick={() => setMonth(month === String(m) ? "all" : String(m))}
                  >
                    <span>{m}月</span>
                    <div>
                      {items.map((e) => (
                        <i key={e.id} className={e.status} title={e.title} />
                      ))}
                    </div>
                    <small>{items.length ? `${items.length}阶段` : "暂无"}</small>
                  </button>
                );
              })}
            </fieldset>
            <div className="wt-sale-events" aria-busy={loading}>
              {!visible.length ? (
                <p className="wt-sale-no-events">
                  {loading
                    ? "正在读取服务器日历…"
                    : "当前筛选下没有活动。可切换月份、购买渠道或查看其他年份。"}
                </p>
              ) : (
                visible.map((event) => {
                  const previous = events.find(
                    (e) =>
                      e.family === event.family &&
                      e.phase === event.phase &&
                      e.year === event.year - 1 &&
                      e.status === "confirmed",
                  );
                  const note = saleEventNote(event);
                  const active =
                    event.status === "confirmed" &&
                    Date.parse(event.startAt) <= now &&
                    Date.parse(event.endAt) > now;
                  return (
                    <article key={event.id} className={`wt-sale-event ${event.status}`}>
                      <div className="wt-sale-date-column">
                        <strong>{saleDate(event.startAt)}</strong>
                        <span>
                          {event.status === "predicted"
                            ? "预计中点"
                            : event.startPrecision === "day"
                              ? "开始日期"
                              : "开始"}
                        </span>
                        <small>
                          {active
                            ? "进行中"
                            : Date.parse(event.endAt) < now
                              ? event.status === "predicted"
                                ? "预测期已过"
                                : "历史记录"
                              : event.status === "predicted"
                                ? "待官方公布"
                                : "已公布"}
                        </small>
                      </div>
                      <div className="wt-sale-event-main">
                        <div className="wt-sale-event-title">
                          <h4>{event.title}</h4>
                          <span className={`wt-sale-badge ${event.status}`}>
                            {event.status === "predicted" ? "预测窗口" : "官方日期"}
                          </span>
                        </div>
                        <p className="wt-sale-range">{saleRange(event)}</p>
                        <div className="wt-sale-tags">
                          {event.channels.map((c) => (
                            <span key={c}>{saleChannels[c]}</span>
                          ))}
                          <span>
                            {event.countries.length
                              ? event.countries.map((c) => countries[c]).join("／")
                              : "全国家活动"}
                          </span>
                        </div>
                        {note && (
                          <p className="wt-sale-note">
                            {event.status === "predicted" ? "历史参与情况：" : ""}
                            {note}
                          </p>
                        )}
                        <details>
                          <summary>时间、依据与参与范围</summary>
                          {event.status === "confirmed" ? (
                            <>
                              <p>{`开始：${event.startPrecision === "day" ? `${saleDate(event.startAt)}（原公告未注明开始时刻）` : new Date(event.startAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}；结束：${new Date(event.endAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`}</p>
                              {previous && (
                                <p className="wt-sale-history">
                                  去年 {previous.year}：{saleRange(previous)}
                                </p>
                              )}
                            </>
                          ) : event.basis ? (
                            <p>
                              历史基准：{event.basis.year} 年，{saleDate(event.basis.startAt)}—
                              {saleDate(event.basis.endAt)}
                            </p>
                          ) : (
                            previous && (
                              <p>
                                历史基准：{previous.year} 年，{saleRange(previous)}
                              </p>
                            )
                          )}
                          <SourceLinks event={event} />
                        </details>
                      </div>
                      <div className="wt-sale-event-rate">
                        <strong>{saleRate(event)}</strong>
                        <span>
                          {event.status === "predicted" ? "该年力度待公布" : "适用于指定范围"}
                        </span>
                        <SourceLinks event={event} />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
      <footer className="wt-sale-footnote">
        <p>
          公告核对：
          {data
            ? new Date(data.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
            : "等待服务器"}
          {data?.nextCheckAt
            ? ` · 下次计划核对 ${new Date(data.nextCheckAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
            : ""}
          {data && ["partial", "failed", "interrupted"].includes(data.updateStatus)
            ? " · 最近核对未完整完成，保留上次有效记录。"
            : ""}{" "}
          · 活动排期由管理员在后台核对更新。
        </p>
      </footer>
      {picker && <AddVehicles saved={watch} add={add} close={() => setPicker(false)} />}
    </main>
  );
}
