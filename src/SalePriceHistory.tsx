import { useLocale } from "./i18n/react";
import { t, localize, vehicleName } from "./i18n/core";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { readPriceHistory } from "./sale-price-api";
import { priceDate, priceText, groupedOffers, discountedMinimum } from "./sale-price-model";
import type { PriceOffer, PricePoint, PriceSummary } from "./sale-price-model";
import type { SaleVehicle } from "./sale-calendar-model";

export function PriceChart({ offer, days }: { offer: PriceOffer; days: number }) {
  useLocale();
  const [focus, setFocus] = useState<PricePoint | null>(null);
  const [clock] = useState(() => Date.now());
  const cutoff = days ? clock - days * 86_400_000 : 0;
  const points = offer.points.filter(
    (p) => Date.parse(p.observedAt) >= cutoff && p.evidenceKind !== "official_announcement_derived",
  );
  if (points.length < 2)
    return (
      <div className="wt-price-chart-empty">
        {points.length ? t("首次记录，价格走势积累中") : t("此时间范围暂无实测报价")}
        <small>
          {t("已记录")}
          {points.length} {t("个观测点；不以公告折扣补画价格。")}
        </small>
      </div>
    );
  const width = 840,
    height = 240,
    left = 76,
    right = 24,
    top = 24,
    bottom = 38;
  const times = points.map((p) => Date.parse(p.observedAt)),
    amounts = points.map((p) => p.amountMinor);
  const low = Math.min(...amounts, offer.minimum?.amountMinor ?? Infinity);
  const high = Math.max(...amounts);
  const span = Math.max(high - low, high * 0.12, 1),
    minY = Math.max(0, low - span * 0.2),
    maxY = high + span * 0.2;
  const x = (time: number) =>
    left +
    ((time - times[0]) / Math.max(1, times[times.length - 1] - times[0])) * (width - left - right);
  const y = (amount: number) => top + ((maxY - amount) / (maxY - minY)) * (height - top - bottom);
  // Join only close observations; the unsampled time between old announcements is unknown.
  const paths = points.map((p, i) =>
    i &&
    p.contentVersion === points[i - 1].contentVersion &&
    times[i] - times[i - 1] <= 36 * 3_600_000
      ? `M${x(times[i - 1])},${y(points[i - 1].amountMinor)}H${x(times[i])}V${y(p.amountMinor)}`
      : "",
  );
  return (
    <div className="wt-price-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        aria-label={t(
          "{0}价格观测图，横轴为日期，纵轴为{1}。详细数据见下表。",
          offer.title,
          offer.currency === "CNY" ? "整包人民币价格" : "金鹰价格",
        )}
      >
        {[0, 0.5, 1].map((r) => {
          const amount = Math.round(minY + (maxY - minY) * r);
          return (
            <g key={r}>
              <line
                x1={left}
                x2={width - right}
                y1={y(amount)}
                y2={y(amount)}
                className="wt-price-grid"
              />
              <text x={left - 8} y={y(amount) + 4} textAnchor="end">
                {priceText(amount, offer.currency)}
              </text>
            </g>
          );
        })}
        {offer.minimum && (
          <line
            x1={left}
            x2={width - right}
            y1={y(offer.minimum.amountMinor)}
            y2={y(offer.minimum.amountMinor)}
            className="wt-price-low-line"
          />
        )}
        <path d={paths.join(" ")} className="wt-price-step" />
        {points.map((p, i) => (
          <circle
            key={p.observedAt + p.contentVersion}
            cx={x(times[i])}
            cy={y(p.amountMinor)}
            r={focus === p ? 6 : 4}
            tabIndex={0}
            onFocus={() => setFocus(p)}
            onMouseEnter={() => setFocus(p)}
            aria-label={`${priceDate(p.observedAt)}，${priceText(p.amountMinor, offer.currency)}`}
          >
            <title>
              {priceDate(p.observedAt)} · {priceText(p.amountMinor, offer.currency)}
            </title>
          </circle>
        ))}
        <text x={left} y={height - 10}>
          {priceDate(points[0].observedAt)}
        </text>
        <text x={width - right} y={height - 10} textAnchor="end">
          {priceDate(points[points.length - 1].observedAt)}
        </text>
      </svg>
      <div className="wt-price-chart-caption">
        <span>{t("● 实测报价 ┄ 最低采样价")}</span>
        <span>
          {focus
            ? `${priceDate(focus.observedAt)} · ${priceText(focus.amountMinor, offer.currency)}`
            : t("聚焦数据点查看报价")}
        </span>
      </div>
      <small>{t("间隔超过 36 小时或商品内容版本不同的记录不连线；空白时段价格未知。")}</small>
    </div>
  );
}
export function SalePriceHistory({
  vehicle,
  close,
  summary,
}: {
  vehicle: SaleVehicle;
  close: () => void;
  summary?: PriceSummary;
}) {
  useLocale();
  const [data, setData] = useState<PriceSummary | null>(() =>
      summary
        ? {
            ...summary,
            offers: summary.offers.map((offer) => ({
              ...offer,
              points: offer.previewPoints || [],
            })),
          }
        : null,
    ),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const [days, setDays] = useState(180),
    [offerId, setOfferId] = useState("");
  useEffect(() => {
    const c = new AbortController();
    void readPriceHistory(vehicle.id, c.signal, reload > 0)
      .then((v) => {
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            e.name === "TimeoutError" || e.name === "AbortError"
              ? t("价格记录读取超时，请重试。")
              : e.message,
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [vehicle.id, reload]);
  const offers = useMemo(() => groupedOffers(data || undefined), [data]);
  const offer = offers.find((o) => o.id === offerId) || offers[0];
  const minimum = discountedMinimum(offer);
  const [clock] = useState(() => Date.now());
  const rows = useMemo(
    () =>
      offer?.points.filter((p) => !days || Date.parse(p.observedAt) >= clock - days * 86_400_000) ||
      [],
    [offer, days, clock],
  );
  return (
    <Modal
      title={t("{0} · 价格记录", vehicleName(vehicle))}
      subtitle={t(
        "按商品、币种和购买条件分别留存；活动售价仅在历史记录中展示，不改变载具原价或购物车合计。",
      )}
      close={close}
      className="wt-price-history-modal"
    >
      <div className="wt-price-history-body">
        {error && (
          <div className="wt-price-history-error" role="alert">
            <p>{error}</p>
            <button
              onClick={() => {
                setError("");
                setLoading(true);
                setReload((v) => v + 1);
              }}
            >
              {t("重试读取")}
            </button>
          </div>
        )}
        {loading && (
          <output className="wt-price-history-loading">
            {data?.offers.length ? t("已显示最近记录，正在更新完整历史…") : t("正在读取价格记录…")}
          </output>
        )}
        {!loading && data && !data.offers.length && (
          <p className="wt-price-history-empty">
            {t("尚无可核实的商品价格；后续成功核对后开始记录。")}
          </p>
        )}
        {offer && (
          <>
            <div className="wt-price-history-toolbar">
              <label>
                {t("商品口径")}
                <GameSelect
                  value={offer.id}
                  onValueChange={(value) => {
                    setOfferId(value);
                  }}
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} · {o.currency} · {localize(o.conditions)}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label>
                {t("范围")}
                <GameSelect value={String(days)} onValueChange={(value) => setDays(Number(value))}>
                  <option value="30">{t("近30天")}</option>
                  <option value="180">{t("近180天")}</option>
                  <option value="365">{t("近1年")}</option>
                  <option value="0">{t("全部")}</option>
                </GameSelect>
              </label>
            </div>
            <p className="wt-price-provenance">
              Gaijin PC · {offer.region === "unknown" ? t("地区未核验") : offer.region} ·{" "}
              {localize(offer.conditions)} {t("· 自")}
              {priceDate(offer.firstObservedAt)} {t("起，共")}
              {offer.sampleCount} {t("次观测")}
            </p>
            <div className="wt-price-metrics">
              <div>
                <small>
                  {t("最近历史记录")}
                  {offer.currency === "CNY" && t(" · 整包")}
                </small>
                <strong>
                  {priceText(
                    (offer.lastRecorded || offer.latest)?.amountMinor ?? null,
                    offer.currency,
                  )}
                </strong>
                <small>{priceDate((offer.lastRecorded || offer.latest)?.checkedAt ?? null)}</small>
              </div>
              <div>
                <small>{t("已核实的折扣采样最低")}</small>
                <strong>
                  {minimum ? priceText(minimum.amountMinor, offer.currency) : t("历史低价待核实")}
                </strong>
                <small>
                  {minimum ? priceDate(minimum.observedAt) : t("原价快照不能代表历史最低")}
                </small>
              </div>
              <div>
                <small>{t("展示口径")}</small>
                <strong>{t("仅作历史参考")}</strong>
                <small>{t("不更新载具原价与购物车合计")}</small>
              </div>
            </div>
            {!!data?.discountEvidence?.length && (
              <section className="wt-price-discount-evidence" aria-label={t("官方折扣记录")}>
                <h3>{t("已核实的官方折扣")}</h3>
                {data.discountEvidence.map((e) => (
                  <article key={e.sourceUrl + e.purchaseCondition + e.productId}>
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                      {e.title} ↗
                    </a>
                    <span>
                      {priceDate(e.startAt || null)} — {priceDate(e.endAt || null)} {t("· 优惠")}{" "}
                      {e.discountPercent}% · {localize(e.purchaseCondition)}
                    </span>
                    <small>
                      {e.amountMinor == null
                        ? t("当时人民币金额未核实，不从当前原价反推。")
                        : priceText(e.amountMinor, e.currency)}
                    </small>
                  </article>
                ))}
              </section>
            )}
            {offer.minimum && !minimum && (
              <p className="wt-price-provenance">
                {t("最低采样价")}
                {priceText(offer.minimum.amountMinor, offer.currency)}
                {t("；采样尚未覆盖完整促销历史。")}
              </p>
            )}
            <PriceChart offer={offer} days={days} />
            <details className="wt-price-records" open>
              <summary>
                {t("价格记录与来源（")}
                {rows.length}）
              </summary>
              {offer.truncated && (
                <p>{t("图表与下表展示最近4096次观测；最低价按全部已保存记录计算。")}</p>
              )}
              <div className="wt-price-record-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("观测日期")}</th>
                      <th>{offer.currency === "CNY" ? t("整包价格") : t("金鹰价格")}</th>
                      <th>{t("依据")}</th>
                      <th>{t("来源")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((p) => (
                      <tr key={p.observedAt + p.sourceUrl + p.contentVersion}>
                        <td>
                          <time dateTime={p.observedAt}>{priceDate(p.observedAt)}</time>
                        </td>
                        <td>{priceText(p.amountMinor, offer.currency)}</td>
                        <td>
                          {p.evidenceKind === "official_announcement_derived"
                            ? t("公告条件参考，不计实测最低")
                            : p.evidenceKind === "catalog_quote"
                              ? t("目录核验价")
                              : t("直接报价")}
                        </td>
                        <td>
                          <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                            {t("官方来源 ↗")}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
