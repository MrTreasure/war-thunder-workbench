import { t, getLocale, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useVehicleCatalog } from "./vehicle-catalog";
import { VehicleTile } from "./VehicleTile";
import { useEffect, useId, useMemo, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { SaleMonthCalendar } from "./SaleMonthCalendar";
import { useStored, object } from "./storage";
import { statsCategoryNames } from "./player-stats-api";
import { cachedSaleCalendar, readSaleCalendar, readSaleVehicles } from "./sale-calendar-api";
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
  saleEventNote,
  saleActivity,
  projectSaleForecast,
  saleStartCandidates,
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
function SaleVehicleTile({ vehicle }: { vehicle: SaleVehicle }) {
  return (
    <VehicleTile
      footerLabel={`${localize(statsCategoryNames[vehicle.category])} · Rank ${vehicle.rank}`}
      packQuote={
        vehicle.originalPrice?.currency === "CNY"
          ? {
              amountCents: vehicle.originalPrice.amount,
              checkedAt: vehicle.originalPrice.checkedAt,
            }
          : undefined
      }
      unit={{
        ...vehicle,
        kind: vehicle.channel === "ge" ? "gold" : vehicle.channel,
        price: vehicle.originalPrice?.currency === "GE" ? vehicle.originalPrice.amount : null,
      }}
    />
  );
}
function VehicleQuoteDate({ vehicle }: { vehicle: SaleVehicle }) {
  const quote = vehicle.originalPrice;
  return (
    <div className="wt-sale-original-price">
      {localize(
        quote?.checkedAt && (
          <small>
            {t("核对于")}
            {localize(" ")}
            <time dateTime={quote.checkedAt}>
              {localize(
                new Date(quote.checkedAt).toLocaleDateString(getLocale(), {
                  timeZone: "Asia/Shanghai",
                }),
              )}
            </time>
          </small>
        ),
      )}
    </div>
  );
}
function CalendarReference({ close }: { close: () => void }) {
  const [failed, setFailed] = useState(false);
  const asset = calendarReference.asset;
  return (
    <Modal
      title={t("折扣年历 · 高清参考图")}
      subtitle={t("{0}；按原表格样式重新排字与绘制。", [localize(calendarReference.attribution)])}
      close={close}
      className="wt-sale-reference-viewer"
    >
      <div className="wt-sale-reference-caption">
        <p>{localize(calendarReference.notice)}</p>
        {localize(
          asset && (
            <a href={calendarReference.png.rawUrl} target="_blank" rel="noreferrer">
              {t("查看高清原图 ↗")}
            </a>
          ),
        )}
      </div>
      <div className="wt-sale-reference-image">
        {localize(
          asset && !failed ? (
            <img
              src={asset.url}
              width={asset.width}
              height={asset.height}
              alt={t(
                "战争雷霆折扣年历：全系促销、专题纪念活动及参与条件，历史整理不代表当年公告。",
              )}
              onError={(event) => {
                if (event.currentTarget.src !== asset.rawUrl)
                  event.currentTarget.src = asset.rawUrl;
                else setFailed(true);
              }}
            />
          ) : (
            <p role="alert">{t("参考图暂时无法加载，请通过上方链接查看高清原图。")}</p>
          ),
        )}
      </div>
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
  useVehicleCatalog([country]);
  const [page, setPage] = useState(1);
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
      setPage(1);
      void readSaleVehicles(
        `country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&rank=${encodeURIComponent(rank)}&q=${encodeURIComponent(query.trim())}`,
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
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [country, category, rank, query]);
  return (
    <Modal
      title={t("添加关注载具")}
      subtitle={t("仅支持金鹰与商城礼包载具；关注列表保存在当前浏览器。")}
      close={close}
      className="wt-sale-picker"
    >
      <div className="wt-sale-picker-controls">
        <GameSelect aria-label={t("载具国家")} value={country} onValueChange={setCountry}>
          {localize(
            Object.entries(countries).map(([id, name]) => (
              <option key={id} value={id}>
                {localize(name)}
              </option>
            )),
          )}
        </GameSelect>
        <GameSelect aria-label={t("载具军种")} value={category} onValueChange={setCategory}>
          <option value="all">{t("全部军种")}</option>
          {localize(
            Object.entries(statsCategoryNames).map(([id, name]) => (
              <option key={id} value={id}>
                {localize(name)}
              </option>
            )),
          )}
        </GameSelect>
        <GameSelect aria-label={t("载具等级")} value={rank} onValueChange={setRank}>
          <option value="all">{t("全部等级")}</option>
          {localize(
            ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"].map((value) => (
              <option key={value} value={value}>
                {localize(value)}
                {t("级")}
              </option>
            )),
          )}
        </GameSelect>
        <input
          aria-label={t("搜索载具")}
          placeholder={t("名称或载具代号")}
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="wt-sale-picker-results" aria-live="polite" aria-busy={loading}>
        {localize(
          error ? (
            <p role="alert">{localize(error)}</p>
          ) : loading ? (
            <p>{t("正在查找载具…")}</p>
          ) : !results.length ? (
            <p>{t("没有找到匹配载具，试试其他名称。")}</p>
          ) : (
            results.slice((page - 1) * 24, page * 24).map((vehicle) => {
              const added = saved.some((v) => v.id === vehicle.id);
              return (
                <div className="wt-sale-vehicle-option" key={vehicle.id}>
                  <SaleVehicleTile vehicle={vehicle} />
                  <VehicleQuoteDate vehicle={vehicle} />
                  <button
                    className="wt-sale-follow-button"
                    disabled={added || saved.length >= 60}
                    onClick={() => add(vehicle)}
                  >
                    {localize(added ? t("已关注") : t("＋ 关注"))}
                  </button>
                </div>
              );
            })
          ),
        )}
      </div>
      <footer>
        <span>{loading ? "" : t("找到 {0} 辆", [total])}</span>
        <div className="wt-sale-picker-pages">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("上一页")}
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil(results.length / 24))}
          </span>
          <button disabled={page * 24 >= results.length} onClick={() => setPage(page + 1)}>
            {t("下一页")}
          </button>
        </div>
        <button onClick={close}>{t("完成")}</button>
      </footer>
    </Modal>
  );
}
function SourceLinks({ event }: { event: SaleEvent }) {
  return (
    <>
      {localize(
        event.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            {localize(event.status === "predicted" ? t("历史公告 ↗") : t("官方公告 ↗"))}
          </a>
        )),
      )}
    </>
  );
}
export function SaleCalendar() {
  useLocale();
  const [data, setData] = useState<SaleCalendarData | null>(cachedSaleCalendar),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(() => !data),
    [reload, setReload] = useState(0);
  const [clock, setClock] = useState(() => Date.now()),
    [offset, setOffset] = useState(() => (data ? Date.parse(data.serverNow) - Date.now() : 0));
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
  useVehicleCatalog(watch.map((v) => v.country));
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(!cachedSaleCalendar());
      setError("");
      void readSaleCalendar(controller.signal, true)
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
  const today = beijingDayKey(now);
  const events = useMemo(
    () =>
      (data?.events || []).flatMap((event) => {
        const projected = projectSaleForecast(event, Date.parse(today + "T00:00:00+08:00"));
        return projected ? [projected] : [];
      }),
    [data, today],
  );
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
              {t("折扣日历")}
              <span>{t("查看全年参考图 ↗")}</span>
            </button>
          </h2>
          <p>{localize(calendarReference.notice)}</p>
          <small className="wt-sale-attribution">{localize(calendarReference.attribution)}</small>
        </div>
        <div className="wt-sales-heading-actions">
          <button className="primary" onClick={() => setPicker(true)}>
            {t("＋ 添加载具")}
          </button>
        </div>
      </header>
      <details className="wt-sale-reading-guide">
        <summary>
          {t("日历说明")}
          <span>{t("日期预测 · 参与范围 · 时间与平台")}</span>
        </summary>
        <dl>
          <div>
            <dt>{t("日期预测")}</dt>
            <dd>
              {t(
                "按往年日期推算，开始与结束各预留 ±4 天；预测开始日遇周末统一顺延到下一个工作日，并保留历史活动时长；开始候选日期排除周六、周日，活动持续期间及结束日可跨周末。周末顺延是预测假设，具体以官方公布为准。黑五按感恩节次日、春节按农历新年调整。两个范围分别表示可能的开始日、结束日，预测中点仅供参考，预测状态按预计起止日标注；预测不保证载具参与或折扣力度。 已过去的日期自动移出预计开始窗口，窗口全部过期后不再作为未来活动展示。候选日期的高／中／低仅表示与历史推算参考日接近程度的相对判断，不是统计概率。",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("参与范围")}</dt>
            <dd>
              {t(
                "“已公布”表示活动日期确认，不代表所列国家的全部载具参与。新版本载具、联队载具及其改装、护符、备份、组合购买门槛，以当次公告为准；金鹰充值、交易所商品、乘员与研发 RP 不随购车活动自动降价。",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("时间平台")}</dt>
            <dd>
              {t(
                "统一使用北京时间，结束时刻不含在活动内；公告未注明时刻时只显示日期。当前为 PC／Gaijin 商城日历，游戏内与商城阶段分开，主机商店可能采用不同时间。",
              )}
            </dd>
          </div>
        </dl>
      </details>
      {localize(referenceOpen && <CalendarReference close={() => setReferenceOpen(false)} />)}
      {localize(
        error && (
          <div className="wt-sales-error" role="alert">
            {localize(error)} <button onClick={() => setReload((n) => n + 1)}>{t("重试")}</button>
            {localize(data && t(" · 上次日历仍保留"))}
          </div>
        ),
      )}
      {localize(storageError && <p role="alert">{localize(storageError)}</p>)}
      <section className="wt-sales-topline" aria-label={t("活动概览")}>
        <div>
          <span>{t("下一场活动")}</span>
          <strong>
            {localize(next?.title || (loading ? t("正在读取公告") : t("暂无可用排期")))}
          </strong>
          <small>{localize(next ? saleCountdown(next, now) : t("活动数据由服务器定期核对"))}</small>
        </div>
        <div>
          <span>
            {localize(year)}
            {t("年排期")}
          </span>
          <strong>
            {localize(known)} <small>{t("已公布阶段")}</small>
          </strong>
          <small>{t("预测以虚线与“预计”区分")}</small>
        </div>
        <div>
          <span>{t("我的关注")}</span>
          <strong>
            {localize(watch.length)} <small>{t("辆载具")}</small>
          </strong>
          <small>{t("按实际购买渠道寻找优惠窗口")}</small>
        </div>
      </section>
      <section className="wt-sale-watch">
        <div className="wt-sales-section-title">
          <h3>{t("我的关注")}</h3>
        </div>
        {localize(
          !watch.length ? (
            <div className="wt-sale-empty">
              <button
                type="button"
                className="wt-sale-add-icon"
                aria-label={t("添加关注载具")}
                onClick={() => setPicker(true)}
              >
                ＋
              </button>
              <p>{t("先把想买的载具放进关注列表")}</p>
              <span>{t("关注金鹰与商城礼包载具，查看对应的优惠窗口和倒计时。")}</span>
              <button onClick={() => setPicker(true)}>{t("选择载具")}</button>
            </div>
          ) : (
            <>
              <div className="wt-sale-watch-list" id={watchListId}>
                {localize(
                  (watchExpanded ? watch : watch.slice(0, 5)).map((vehicle) => {
                    const event = nextSale(vehicle, events, now),
                      exact =
                        event?.status === "confirmed" && event.vehicleIds.includes(vehicle.id);
                    return (
                      <article key={vehicle.id} className="wt-sale-watch-row">
                        <SaleVehicleTile vehicle={vehicle} />
                        <div className="wt-sale-watch-identity">
                          <span>
                            {localize(countries[vehicle.country])}·{localize(" ")}
                            {localize(saleChannels[vehicle.channel])}
                          </span>
                          <VehicleQuoteDate vehicle={vehicle} />
                        </div>
                        <div className="wt-sale-watch-opportunity">
                          {localize(
                            event ? (
                              <>
                                <strong>{localize(event.title)}</strong>
                                <span>{localize(saleRange(event))}</span>
                                <small>
                                  {localize(
                                    event.status === "predicted"
                                      ? t("预测窗口，尚未公布名单")
                                      : exact
                                        ? t("已核对参与名单")
                                        : event.coverage === "all-except-exclusions"
                                          ? t("常规优惠范围，需核对新车排除名单")
                                          : t("可能相关，需核对指定载具名单"),
                                  )}
                                </small>
                              </>
                            ) : (
                              <span>
                                {localize(
                                  ["market", "excluded"].includes(vehicle.channel)
                                    ? t("此购买渠道不自动参与常规载具促销")
                                    : t("尚无匹配的优惠排期"),
                                )}
                              </span>
                            ),
                          )}
                        </div>
                        <div className="wt-sale-watch-countdown">
                          {localize(
                            event && (
                              <>
                                <b>{localize(saleCountdown(event, now))}</b>
                                <small>{localize(saleRate(event, vehicle.channel))}</small>
                                <SourceLinks event={event} />
                              </>
                            ),
                          )}
                        </div>
                        <button
                          className="wt-sale-remove"
                          aria-label={t("取消关注{0}", [localize(vehicle.name)])}
                          onClick={() => saveWatch(watch.filter((v) => v.id !== vehicle.id))}
                        >
                          ×
                        </button>
                      </article>
                    );
                  }),
                )}
              </div>
              {localize(
                watch.length > 5 && (
                  <div className="wt-sale-watch-fold">
                    <span>
                      {t("已显示")}
                      {localize(watchExpanded ? watch.length : 5)} / {localize(watch.length)}
                      {t("辆")}
                    </span>
                    <button
                      type="button"
                      aria-controls={watchListId}
                      aria-expanded={watchExpanded}
                      onClick={() => setWatchExpanded((value) => !value)}
                    >
                      {localize(
                        watchExpanded
                          ? t("收起至 5 辆 ↑")
                          : t("展开全部 {0} 辆 ↓", [localize(watch.length)]),
                      )}
                    </button>
                  </div>
                ),
              )}
            </>
          ),
        )}
      </section>
      <section className="wt-sale-calendar">
        <div className="wt-sales-section-title">
          <h3>{localize(view === "calendar" ? t("优惠月历") : t("年度优惠时间轴"))}</h3>
          <span>
            <i className="wt-sale-dot" />
            {t("官方已公布")}
            <i className="wt-sale-dot predicted" />
            {localize(" ")}
            {t("历史推算")}
          </span>
          <fieldset className="wt-sale-view-switch" aria-label={t("活动视图")}>
            <button aria-pressed={view === "calendar"} onClick={() => switchView("calendar")}>
              {t("月历")}
            </button>
            <button aria-pressed={view === "timeline"} onClick={() => switchView("timeline")}>
              {t("时间轴")}
            </button>
          </fieldset>
        </div>
        <div className="wt-sale-filters">
          <GameSelect
            aria-label={t("活动年份")}
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            {localize(
              (years.length ? years : [year]).map((y) => (
                <option key={y} value={y}>
                  {localize(y)}
                  {t("年")}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect aria-label={t("月份")} value={month} onValueChange={setMonth}>
            {localize(view === "timeline" && <option value="all">{t("全年")}</option>)}
            {localize(
              Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {localize(i + 1)}
                  {t("月")}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect aria-label={t("优惠渠道")} value={channel} onValueChange={setChannel}>
            <option value="all">{t("全部购买渠道")}</option>
            {localize(
              Object.entries(saleChannels)
                .filter(([k]) => !["market", "excluded", "unknown"].includes(k))
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {localize(v)}
                  </option>
                )),
            )}
          </GameSelect>
          <GameSelect aria-label={t("活动国家")} value={country} onValueChange={setCountry}>
            <option value="all">{t("全部国家")}</option>
            {localize(
              Object.entries(countries).map(([k, v]) => (
                <option key={k} value={k}>
                  {localize(v)}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect aria-label={t("排期状态")} value={status} onValueChange={setStatus}>
            <option value="all">{t("已公布与预测")}</option>
            <option value="confirmed">{t("官方已公布")}</option>
            <option value="predicted">{t("仅看预测")}</option>
          </GameSelect>
        </div>
        {localize(
          view === "calendar" ? (
            <SaleMonthCalendar
              key={`${year}-${month}`}
              year={year}
              month={Number(month)}
              events={filtered}
              today={today}
              now={now}
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
              <fieldset className="wt-sale-year-strip" aria-label={t("按月份查看活动")}>
                {localize(
                  Array.from({ length: 12 }, (_, i) => {
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
                        <span>
                          {localize(m)}
                          {t("月")}
                        </span>
                        <div>
                          {localize(
                            items.map((e) => <i key={e.id} className={e.status} title={e.title} />),
                          )}
                        </div>
                        <small>
                          {localize(
                            items.length ? t("{0}阶段", [localize(items.length)]) : t("暂无"),
                          )}
                        </small>
                      </button>
                    );
                  }),
                )}
              </fieldset>
              <div className="wt-sale-events" aria-busy={loading}>
                {localize(
                  !visible.length ? (
                    <p className="wt-sale-no-events">
                      {localize(
                        loading
                          ? t("正在读取服务器日历…")
                          : t("当前筛选下没有活动。可切换月份、购买渠道或查看其他年份。"),
                      )}
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
                      const activity = saleActivity(event, now);
                      return (
                        <article
                          key={event.id}
                          className={`wt-sale-event ${event.status} activity-${activity.state}`}
                        >
                          <div className="wt-sale-date-column">
                            <strong>{localize(saleDate(event.startAt))}</strong>
                            <span>
                              {localize(
                                event.status === "predicted"
                                  ? t("预计中点")
                                  : event.startPrecision === "day"
                                    ? t("开始日期")
                                    : t("开始"),
                              )}
                            </span>
                            <small className="wt-sale-activity-status">
                              {localize(activity.fullLabel)}
                            </small>
                          </div>
                          <div className="wt-sale-event-main">
                            <div className="wt-sale-event-title">
                              <h4>{localize(event.title)}</h4>
                              <span className={`wt-sale-badge ${event.status}`}>
                                {localize(
                                  event.status === "predicted" ? t("预测窗口") : t("官方日期"),
                                )}
                              </span>
                            </div>
                            <p className="wt-sale-range">{localize(saleRange(event))}</p>
                            <div className="wt-sale-tags">
                              {localize(
                                event.channels.map((c) => (
                                  <span key={c}>{localize(saleChannels[c])}</span>
                                )),
                              )}
                              <span>
                                {localize(
                                  event.countries.length
                                    ? event.countries.map((c) => countries[c]).join("／")
                                    : t("全国家活动"),
                                )}
                              </span>
                            </div>
                            {localize(
                              note && (
                                <p className="wt-sale-note">
                                  {localize(
                                    event.status === "predicted" ? t("历史参与情况：") : "",
                                  )}
                                  {localize(note)}
                                </p>
                              ),
                            )}
                            <details>
                              <summary>{t("时间、依据与参与范围")}</summary>
                              {localize(
                                event.status === "confirmed" ? (
                                  <>
                                    <p>
                                      {localize(
                                        t("开始：{0}；结束：{1}", [
                                          localize(
                                            event.startPrecision === "day"
                                              ? `${saleDate(event.startAt)}（原公告未注明开始时刻）`
                                              : new Date(event.startAt).toLocaleString(
                                                  getLocale(),
                                                  { timeZone: "Asia/Shanghai" },
                                                ),
                                          ),
                                          localize(
                                            new Date(event.endAt).toLocaleString(getLocale(), {
                                              timeZone: "Asia/Shanghai",
                                            }),
                                          ),
                                        ]),
                                      )}
                                    </p>
                                    {localize(
                                      previous && (
                                        <p className="wt-sale-history">
                                          {t("去年")}
                                          {localize(previous.year)}：{localize(saleRange(previous))}
                                        </p>
                                      ),
                                    )}
                                  </>
                                ) : event.basis ? (
                                  <p>
                                    {t("历史基准：")}
                                    {localize(event.basis.year)}
                                    {t("年，")}
                                    {localize(saleDate(event.basis.startAt))}—
                                    {localize(saleDate(event.basis.endAt))}
                                  </p>
                                ) : (
                                  previous && (
                                    <p>
                                      {t("历史基准：")}
                                      {localize(previous.year)}
                                      {t("年，")}
                                      {localize(saleRange(previous))}
                                    </p>
                                  )
                                ),
                              )}
                              {localize(
                                event.status === "predicted" && (
                                  <div
                                    className="wt-sale-candidate-list"
                                    aria-label={t("候选开始日与相对可能性")}
                                  >
                                    {localize(
                                      saleStartCandidates(event, now).map((candidate) => (
                                        <span
                                          key={candidate.day}
                                          className={`confidence-${candidate.confidence}`}
                                        >
                                          {localize(saleDate(candidate.at))}{" "}
                                          <b>{localize(candidate.label)}</b>
                                          {localize(candidate.preferred ? t(" · 参考") : "")}
                                        </span>
                                      )),
                                    )}
                                  </div>
                                ),
                              )}
                              <SourceLinks event={event} />
                            </details>
                          </div>
                          <div className="wt-sale-event-rate">
                            <strong>{localize(saleRate(event))}</strong>
                            <span>
                              {localize(
                                event.status === "predicted"
                                  ? t("该年力度待公布")
                                  : t("适用于指定范围"),
                              )}
                            </span>
                            <SourceLinks event={event} />
                          </div>
                        </article>
                      );
                    })
                  ),
                )}
              </div>
            </>
          ),
        )}
      </section>
      <footer className="wt-sale-footnote">
        <p>
          {t("公告核对：")}
          {localize(
            data
              ? new Date(data.checkedAt).toLocaleString(getLocale(), { timeZone: "Asia/Shanghai" })
              : t("等待服务器"),
          )}
          {localize(
            data?.nextCheckAt
              ? t(" · 下次计划核对 {0}", [
                  localize(
                    new Date(data.nextCheckAt).toLocaleString(getLocale(), {
                      timeZone: "Asia/Shanghai",
                    }),
                  ),
                ])
              : "",
          )}
          {localize(
            data && ["partial", "failed", "interrupted"].includes(data.updateStatus)
              ? t(" · 最近核对未完整完成，保留上次有效记录。")
              : "",
          )}
          {localize(" ")}
          {t("· 活动排期由管理员在后台核对更新。")}
        </p>
      </footer>
      {localize(picker && <AddVehicles saved={watch} add={add} close={() => setPicker(false)} />)}
    </main>
  );
}
