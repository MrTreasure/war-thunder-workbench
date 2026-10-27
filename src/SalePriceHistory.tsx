import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { readPriceHistory } from "./sale-price-api";
import {
  priceDate,
  priceText,
  groupedOffers,
  historicalDisplayPoints,
  historicalDisplayMinimum,
} from "./sale-price-model";
import type { PriceOffer, PricePoint, PriceSummary } from "./sale-price-model";
import type { SaleVehicle } from "./sale-calendar-model";

export function PriceChart({ offer, days }: { offer: PriceOffer; days: number }) {
  const [focus, setFocus] = useState<PricePoint | null>(null);
  const [clock] = useState(() => Date.now());
  const cutoff = days ? clock - days * 86_400_000 : 0;
  const points = offer.points.filter((p) => Date.parse(p.observedAt) >= cutoff);
  if (points.length < 2)
    return (
      <div className="wt-price-chart-empty">
        {points.length ? "首次记录，价格走势积累中" : "此时间范围暂无实测报价"}
        <small>已记录 {points.length} 个历史点，公告估算与实测报价分别标识。</small>
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
  const paths = points.slice(1).map((p, index) => {
    const previous = points[index];
    return (
      <path
        key={index}
        d={`M${x(times[index])},${y(previous.amountMinor)}L${x(times[index + 1])},${y(p.amountMinor)}`}
        className={`wt-price-step ${p.evidenceKind === "official_announcement_derived" || previous.evidenceKind === "official_announcement_derived" ? "is-estimate" : ""}`}
      />
    );
  });
  return (
    <div className="wt-price-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`${offer.title}价格观测图，横轴为日期，纵轴为${offer.currency === "CNY" ? "整包人民币价格" : "金鹰价格"}。详细数据见下表。`}
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
        {paths}
        {points.map((p, i) => (
          <circle
            key={p.observedAt + p.contentVersion}
            cx={x(times[i])}
            cy={y(p.amountMinor)}
            r={focus === p ? 6 : 4}
            className={
              p.evidenceKind === "official_announcement_derived" ? "is-estimate" : undefined
            }
            tabIndex={0}
            onFocus={() => setFocus(p)}
            onMouseEnter={() => setFocus(p)}
            aria-label={`${priceDate(p.observedAt)}，${priceText(p.amountMinor, offer.currency)}`}
          >
            <title>
              {priceDate(p.observedAt)} · {priceText(p.amountMinor, offer.currency)}
              {p.evidenceKind === "official_announcement_derived" ? "（公告折扣估算）" : ""}
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
        <span>● 实测报价　 ○ 公告折扣估算</span>
        <span>
          {focus
            ? `${priceDate(focus.observedAt)} · ${priceText(focus.amountMinor, offer.currency)}`
            : "聚焦数据点查看报价"}
        </span>
      </div>
      <small>
        折线连接已知记录，不代表间隔期间持续该价；空心点与虚线按资料原价和公告折扣估算，非当时实售价。
      </small>
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
  const [days, setDays] = useState(0),
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
              ? "价格记录读取超时，请重试。"
              : e.message,
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [vehicle.id, reload]);
  const offers = useMemo(() => groupedOffers(data || undefined), [data]);
  const offer = useMemo<PriceOffer | undefined>(
    () =>
      offers.find((o) => o.id === offerId) ||
      offers[0] ||
      (data?.discountEvidence?.some((e) => e.purchaseCondition === "普通单件购买") &&
      vehicle.originalPrice
        ? {
            id: "announcement-reference",
            title: vehicle.name,
            currency: vehicle.originalPrice.currency,
            platform: "gaijin_pc",
            region: "unknown",
            conditions: "普通单件购买",
            contentVersion: "reference",
            latest: null,
            minimum: null,
            firstObservedAt: null,
            sampleCount: 0,
            available: false,
            points: [],
          }
        : undefined),
    [offers, offerId, data?.discountEvidence, vehicle],
  );
  const minimum = historicalDisplayMinimum(vehicle, offer, data?.discountEvidence);
  const displayPoints = useMemo(
    () => historicalDisplayPoints(vehicle, offer, data?.discountEvidence),
    [vehicle, offer, data],
  );
  const [clock] = useState(() => Date.now());
  const rows = useMemo(
    () =>
      displayPoints.filter((p) => !days || Date.parse(p.observedAt) >= clock - days * 86_400_000),
    [displayPoints, days, clock],
  );
  return (
    <Modal
      title={`${vehicle.name} · 价格记录`}
      subtitle="按商品、币种和购买条件分别留存；活动售价仅在历史记录中展示，不改变载具原价或购物车合计。"
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
              重试读取
            </button>
          </div>
        )}
        {loading && (
          <output className="wt-price-history-loading">
            {data?.offers.length ? "已显示最近记录，正在更新完整历史…" : "正在读取价格记录…"}
          </output>
        )}
        {!loading && data && !data.offers.length && !offer && (
          <p className="wt-price-history-empty">尚无可核实的商品价格；后续成功核对后开始记录。</p>
        )}
        {offer && (
          <>
            <div className="wt-price-history-toolbar">
              <label>
                商品口径
                <GameSelect
                  value={offer.id}
                  onValueChange={(value) => {
                    setOfferId(value);
                  }}
                >
                  {(offers.length ? offers : [offer]).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} · {o.currency} · {o.conditions}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label>
                范围
                <GameSelect value={String(days)} onValueChange={(value) => setDays(Number(value))}>
                  <option value="30">近30天</option>
                  <option value="180">近180天</option>
                  <option value="365">近1年</option>
                  <option value="0">全部</option>
                </GameSelect>
              </label>
            </div>
            <p className="wt-price-provenance">
              Gaijin PC · {offer.region === "unknown" ? "地区未核验" : offer.region} ·{" "}
              {offer.conditions} · 自 {priceDate(offer.firstObservedAt)} 起，共 {offer.sampleCount}{" "}
              次观测
            </p>
            <div className="wt-price-metrics">
              <div>
                <small>最近历史记录{offer.currency === "CNY" && " · 整包"}</small>
                <strong>
                  {priceText(
                    (offer.lastRecorded || offer.latest)?.amountMinor ?? null,
                    offer.currency,
                  )}
                </strong>
                <small>{priceDate((offer.lastRecorded || offer.latest)?.checkedAt ?? null)}</small>
              </div>
              <div>
                <small>历史低价 / 公告估算</small>
                <strong>
                  {minimum
                    ? `${minimum.evidenceKind === "official_announcement_derived" ? "≈ " : ""}${priceText(minimum.amountMinor, offer.currency)}`
                    : "历史低价待核实"}
                </strong>
                <small>
                  {minimum
                    ? `${priceDate(minimum.observedAt)}${minimum.evidenceKind === "official_announcement_derived" ? " · 按资料原价估算" : " · 实测报价"}`
                    : "原价快照不能代表历史最低"}
                </small>
              </div>
              <div>
                <small>展示口径</small>
                <strong>仅作历史参考</strong>
                <small>不更新载具原价与购物车合计</small>
              </div>
            </div>
            {!!data?.discountEvidence?.length && (
              <section className="wt-price-discount-evidence" aria-label="官方折扣记录">
                <h3>已核实的官方折扣</h3>
                {data.discountEvidence.map((e) => (
                  <article key={e.sourceUrl + e.purchaseCondition + e.productId}>
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                      {e.title} ↗
                    </a>
                    <span>
                      {priceDate(e.startAt || null)} — {priceDate(e.endAt || null)} · 优惠{" "}
                      {e.discountPercent}%{e.estimateOnly ? "（公告最高力度，估算）" : ""} ·{" "}
                      {e.purchaseCondition}
                    </span>
                    <small>
                      {e.amountMinor == null
                        ? e.purchaseCondition === "普通单件购买" &&
                          historicalDisplayPoints(vehicle, offer, [e]).some(
                            (p) => p.evidenceKind === "official_announcement_derived",
                          )
                          ? `按资料原价估算 ≈ ${priceText(historicalDisplayPoints(vehicle, offer, [e]).find((p) => p.evidenceKind === "official_announcement_derived")!.amountMinor, e.currency)}；当时实售价未核实。`
                          : "仅适用于所示购买条件，不计单件历史低价。"
                        : priceText(e.amountMinor, e.currency)}
                    </small>
                  </article>
                ))}
              </section>
            )}
            {offer.minimum && !minimum && (
              <p className="wt-price-provenance">
                最低采样价 {priceText(offer.minimum.amountMinor, offer.currency)}
                ；采样尚未覆盖完整促销历史。
              </p>
            )}
            <PriceChart offer={{ ...offer, points: displayPoints, minimum }} days={days} />
            <details className="wt-price-records" open>
              <summary>价格记录与来源（{rows.length}）</summary>
              {offer.truncated && <p>图表与下表展示最近4096次观测；最低价按全部已保存记录计算。</p>}
              <div className="wt-price-record-table">
                <table>
                  <thead>
                    <tr>
                      <th>观测日期</th>
                      <th>{offer.currency === "CNY" ? "整包价格" : "金鹰价格"}</th>
                      <th>依据</th>
                      <th>来源</th>
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
                            ? "公告折扣估算，非实售价"
                            : p.evidenceKind === "catalog_quote"
                              ? "目录核验价"
                              : "直接报价"}
                        </td>
                        <td>
                          <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                            官方来源 ↗
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
