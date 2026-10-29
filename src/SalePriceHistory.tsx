import { useLocale } from "./i18n/react";
import { t, localize, vehicleName } from "./i18n/core";
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
  const offer = useMemo<PriceOffer | undefined>(
    () =>
      offers.find((o) => o.id === offerId) ||
      offers[0] ||
      (data?.discountEvidence?.some((e) => e.purchaseCondition === "普通单件购买") &&
      vehicle.originalPrice
        ? {
            id: "announcement-reference",
            title: vehicleName(vehicle),
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
      title={t("{0} · 价格记录", [vehicleName(vehicle)])}
      subtitle={t(
        "按商品、币种和购买条件分别留存；活动售价仅在历史记录中展示，不改变载具原价或购物车合计。",
      )}
      close={close}
      className="wt-price-history-modal"
    >
      <div className="wt-price-history-body">
        {localize(
          error && (
            <div className="wt-price-history-error" role="alert">
              <p>{localize(error)}</p>
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
          ),
        )}
        {localize(
          loading && (
            <output className="wt-price-history-loading">
              {localize(
                data?.offers.length
                  ? t("已显示最近记录，正在更新完整历史…")
                  : t("正在读取价格记录…"),
              )}
            </output>
          ),
        )}
        {localize(
          !loading && data && !data.offers.length && !offer && (
            <p className="wt-price-history-empty">
              {t("尚无可核实的商品价格；后续成功核对后开始记录。")}
            </p>
          ),
        )}
        {localize(
          offer && (
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
                    {localize(
                      (offers.length ? offers : [offer]).map((o) => (
                        <option key={o.id} value={o.id}>
                          {localize(o.title)} · {localize(o.currency)} · {localize(o.conditions)}
                        </option>
                      )),
                    )}
                  </GameSelect>
                </label>
                <label>
                  {t("范围")}
                  <GameSelect
                    value={String(days)}
                    onValueChange={(value) => setDays(Number(value))}
                  >
                    <option value="30">{t("近30天")}</option>
                    <option value="180">{t("近180天")}</option>
                    <option value="365">{t("近1年")}</option>
                    <option value="0">{t("全部")}</option>
                  </GameSelect>
                </label>
              </div>
              <p className="wt-price-provenance">
                Gaijin PC · {localize(offer.region === "unknown" ? t("地区未核验") : offer.region)}{" "}
                ·{localize(" ")}
                {localize(offer.conditions)} {t("· 自")}
                {localize(priceDate(offer.firstObservedAt))} {t("起，共")}
                {localize(offer.sampleCount)}
                {localize(" ")}
                {t("次观测")}
              </p>
              <div className="wt-price-metrics">
                <div>
                  <small>
                    {t("最近历史记录")}
                    {localize(offer.currency === "CNY" && t(" · 整包"))}
                  </small>
                  <strong>
                    {localize(
                      priceText(
                        (offer.lastRecorded || offer.latest)?.amountMinor ?? null,
                        offer.currency,
                      ),
                    )}
                  </strong>
                  <small>
                    {localize(priceDate((offer.lastRecorded || offer.latest)?.checkedAt ?? null))}
                  </small>
                </div>
                <div>
                  <small>{t("历史低价 / 公告估算")}</small>
                  <strong>
                    {localize(
                      minimum
                        ? `${minimum.evidenceKind === "official_announcement_derived" ? "≈ " : ""}${priceText(minimum.amountMinor, offer.currency)}`
                        : t("历史低价待核实"),
                    )}
                  </strong>
                  <small>
                    {localize(
                      minimum
                        ? t("{0}{1}", [
                            priceDate(minimum.observedAt),
                            minimum.evidenceKind === "official_announcement_derived"
                              ? t(" · 按资料原价估算")
                              : t(" · 实测报价"),
                          ])
                        : t("原价快照不能代表历史最低"),
                    )}
                  </small>
                </div>
                <div>
                  <small>{t("展示口径")}</small>
                  <strong>{t("仅作历史参考")}</strong>
                  <small>{t("不更新载具原价与购物车合计")}</small>
                </div>
              </div>
              {localize(
                !!data?.discountEvidence?.length && (
                  <section className="wt-price-discount-evidence" aria-label={t("官方折扣记录")}>
                    <h3>{t("已核实的官方折扣")}</h3>
                    {localize(
                      data.discountEvidence.map((e) => (
                        <article key={e.sourceUrl + e.purchaseCondition + e.productId}>
                          <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                            {localize(e.title)} ↗
                          </a>
                          <span>
                            {localize(priceDate(e.startAt || null))} —{" "}
                            {localize(priceDate(e.endAt || null))} {t("· 优惠")}
                            {localize(" ")}
                            {localize(e.discountPercent)}%
                            {localize(e.estimateOnly ? t("（公告最高力度，估算）") : "")} ·
                            {localize(" ")}
                            {localize(e.purchaseCondition)}
                          </span>
                          <small>
                            {localize(
                              observedPromotionPrice(offer, e)
                                ? t("实采报价 {0} · {1}", [
                                    priceText(
                                      observedPromotionPrice(offer, e)!.amountMinor,
                                      e.currency,
                                    ),
                                    priceDate(observedPromotionPrice(offer, e)!.checkedAt),
                                  ])
                                : e.amountMinor == null
                                  ? e.purchaseCondition === "普通单件购买" &&
                                    historicalDisplayPoints(vehicle, offer, [e]).some(
                                      (p) => p.evidenceKind === "official_announcement_derived",
                                    )
                                    ? t("按资料原价估算 ≈ {0}；当时实售价未核实。", [
                                        priceText(
                                          historicalDisplayPoints(vehicle, offer, [e]).find(
                                            (p) =>
                                              p.evidenceKind === "official_announcement_derived",
                                          )!.amountMinor,
                                          e.currency,
                                        ),
                                      ])
                                    : t("仅适用于所示购买条件，不计单件历史低价。")
                                  : priceText(e.amountMinor, e.currency),
                            )}
                          </small>
                        </article>
                      )),
                    )}
                  </section>
                ),
              )}
              {localize(
                offer.minimum && !minimum && (
                  <p className="wt-price-provenance">
                    {t("最低采样价")}
                    {localize(priceText(offer.minimum.amountMinor, offer.currency))}
                    {t("；采样尚未覆盖完整促销历史。")}
                  </p>
                ),
              )}
              <SaleActivityChart points={rows} currency={offer.currency} title={offer.title} />
              <details className="wt-price-records" open>
                <summary>
                  {t("活动价格与来源（")}
                  {localize(rows.length)}）
                </summary>
                {localize(
                  offer.truncated && <p>{t("活动价格由已保存的最近4096次观测及官方公告整理。")}</p>,
                )}
                <div className="wt-price-record-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("活动 / 开始日期")}</th>
                        <th>
                          {localize(offer.currency === "CNY" ? t("整包价格") : t("金鹰价格"))}
                        </th>
                        <th>{t("依据")}</th>
                        <th>{t("来源")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localize(
                        [...rows].reverse().map((p) => (
                          <tr key={p.activityId}>
                            <td>
                              {localize(p.activityTitle)}
                              <br />
                              <time dateTime={p.activityDate}>
                                {localize(priceDate(p.activityDate))}
                              </time>
                            </td>
                            <td>
                              {localize(
                                p.evidenceKind === "official_announcement_derived" ? "≈ " : "",
                              )}
                              {localize(priceText(p.amountMinor, offer.currency))}
                            </td>
                            <td>
                              {localize(
                                p.evidenceKind === "official_announcement_derived"
                                  ? t("公告折扣估算，非实售价")
                                  : p.evidenceKind === "catalog_quote"
                                    ? t("目录核验价")
                                    : t("直接报价"),
                              )}
                            </td>
                            <td>
                              <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                                {t("官方来源 ↗")}
                              </a>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ),
        )}
      </div>
    </Modal>
  );
}
