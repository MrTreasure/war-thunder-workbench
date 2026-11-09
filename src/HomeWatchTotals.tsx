import { useEffect, useState } from "react";
import type { SaleVehicle, SaleEvent } from "./sale-calendar-model";
import { readPriceSummary } from "./sale-price-api";
import { priceText, type PriceSummary } from "./sale-price-model";
import { homeWatchPresentation } from "./home-dashboard-model";
import { homeWatchTotals } from "./home-watch-totals-model";

export function HomeWatchTotals({
  watches,
  events,
  now,
}: {
  watches: SaleVehicle[];
  events: SaleEvent[];
  now: number;
}) {
  const countries = [...new Set(watches.map((v) => v.country))].sort().join(",");
  const [retry, setRetry] = useState(0);
  const requestKey = `${countries}:${retry}`;
  const [prices, setPrices] = useState<{
    key: string;
    summaries: Map<string, PriceSummary>;
    failed: boolean;
  }>({ key: "", summaries: new Map(), failed: false });
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled(
      countries
        .split(",")
        .filter(Boolean)
        .map((country) => readPriceSummary(country, controller.signal, retry > 0)),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const summaries = new Map<string, PriceSummary>();
      for (const result of results)
        if (result.status === "fulfilled")
          for (const item of result.value.items) summaries.set(item.vehicleId, item);
      setPrices({
        key: requestKey,
        summaries,
        failed: results.some((result) => result.status === "rejected"),
      });
    });
    return () => controller.abort();
  }, [countries, requestKey, retry]);
  const loading = prices.key !== requestKey;
  const totals = homeWatchTotals(watches, {
    summaries: prices.summaries,
    now,
    events,
    fallback: homeWatchPresentation,
  });
  return (
    <div className="wt-home-watch-totals" aria-busy={loading}>
      <dl>
        <div>
          <dt>当前总价</dt>
          <dd>{loading ? "读取中…" : priceText(totals.cny, "CNY")}</dd>
          {!loading && totals.cny === null && (
            <small>已核实小计 {priceText(totals.knownCny, "CNY")}</small>
          )}
        </div>
        <div>
          <dt>总金鹰数</dt>
          <dd>{loading ? "读取中…" : priceText(totals.ge, "GE")}</dd>
          {!loading && totals.ge === null && (
            <small>已核实小计 {priceText(totals.knownGe, "GE")}</small>
          )}
        </div>
      </dl>
      {!loading && (
        <p>
          全部 {watches.length} 辆关注载具合计，同一礼包只计一次。
          {totals.missing > 0 ? ` ${totals.missing} 项报价待核实。` : ""}
          {totals.unavailable > 0 ? ` ${totals.unavailable} 项当前不可购买。` : ""}
          {totals.conflicts > 0 ? ` ${totals.conflicts} 项报价冲突。` : ""}
        </p>
      )}
      {!loading && prices.failed && (
        <p>
          部分最新报价读取失败。
          <button className="wt-home-text-action" onClick={() => setRetry((v) => v + 1)}>
            重试
          </button>
        </p>
      )}
    </div>
  );
}
