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
  observedPromotionPrice,
} from "./sale-price-model";
import type { PriceOffer, PriceSummary } from "./sale-price-model";
import type { SaleEvent, SaleVehicle } from "./sale-calendar-model";

import { activityPricePoints } from "./sale-activity-prices";
import { SaleActivityChart } from "./SaleActivityChart";

export function SalePriceHistory({
  vehicle,
  events,
  close,
  summary,
}: {
  vehicle: SaleVehicle;
  events: SaleEvent[];
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
  const minimum = historicalDisplayMinimum(vehicle, offer, data?.discountEvidence || []);
  const displayPoints = useMemo(
    () => activityPricePoints(vehicle, offer, data?.discountEvidence, events),
    [vehicle, offer, data, events],
  );
  const [clock] = useState(() => Date.now());
  const rows = useMemo(
    () =>
      displayPoints.filter((p) => !days || Date.parse(p.activityDate) >= clock - days * 86_400_000),
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
                      {observedPromotionPrice(offer, e)
                        ? `实采报价 ${priceText(observedPromotionPrice(offer, e)!.amountMinor, e.currency)} · ${priceDate(observedPromotionPrice(offer, e)!.checkedAt)}`
                        : e.amountMinor == null
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
            <SaleActivityChart points={rows} currency={offer.currency} title={offer.title} />
            <details className="wt-price-records" open>
              <summary>活动价格与来源（{rows.length}）</summary>
              {offer.truncated && <p>活动价格由已保存的最近4096次观测及官方公告整理。</p>}
              <div className="wt-price-record-table">
                <table>
                  <thead>
                    <tr>
                      <th>活动 / 开始日期</th>
                      <th>{offer.currency === "CNY" ? "整包价格" : "金鹰价格"}</th>
                      <th>依据</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((p) => (
                      <tr key={p.activityId}>
                        <td>
                          {p.activityTitle}
                          <br />
                          <time dateTime={p.activityDate}>{priceDate(p.activityDate)}</time>
                        </td>
                        <td>
                          {p.evidenceKind === "official_announcement_derived" ? "≈ " : ""}
                          {priceText(p.amountMinor, offer.currency)}
                        </td>
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
