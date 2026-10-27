import { useLocale } from "./i18n/react";
import { t, vehicleName } from "./i18n/core";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { useAccountWorkspace } from "./workspace-context";
import { nextSale, saleCountdown, saleRange } from "./sale-calendar-model";
import type { SaleEvent, SaleVehicle } from "./sale-calendar-model";
import { readPriceSummary } from "./sale-price-api";
import {
  cartTotals,
  priceDate,
  priceText,
  primaryOffer,
  historicalDisplayPoints,
  historicalDisplayMinimum,
} from "./sale-price-model";
import { GameTag } from "./components/GameTag";
import type { PricePoint, PriceSummary } from "./sale-price-model";
import { useSalePricePreferences } from "./use-sale-price-preferences";
import { SalePriceHistory } from "./SalePriceHistory";
import "./sale-cart.css";

function MiniPriceTrend({ points }: { points: PricePoint[] }) {
  useLocale();
  if (!points.length) return <span className="wt-price-mini-empty">{t("暂无历史价格")}</span>;
  const low = Math.min(...points.map((p) => p.amountMinor)),
    high = Math.max(...points.map((p) => p.amountMinor));
  const start = Date.parse(points[0].observedAt),
    span = Math.max(1, Date.parse(points.at(-1)!.observedAt) - start);
  const x = (at: string) => 5 + ((Date.parse(at) - start) / span) * 150;
  const y = (amount: number) => 36 - ((amount - low) / Math.max(high - low, high * 0.12, 1)) * 28;
  return (
    <svg className="wt-price-mini" viewBox="0 0 160 44" aria-hidden="true">
      {points.slice(1).map((p, index) => {
        const previous = points[index];
        return (
          <path
            key={index}
            d={`M${x(previous.observedAt)},${y(previous.amountMinor)}L${x(p.observedAt)},${y(p.amountMinor)}`}
            className={
              p.evidenceKind === "official_announcement_derived" ||
              previous.evidenceKind === "official_announcement_derived"
                ? "is-estimate"
                : undefined
            }
          />
        );
      })}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.observedAt)}
          cy={y(p.amountMinor)}
          r="2.5"
          className={p.evidenceKind === "official_announcement_derived" ? "is-estimate" : undefined}
        />
      ))}
    </svg>
  );
}
function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "war-thunder-shopping-cart.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SaleCart({
  vehicles,
  save,
  events,
  now,
  ready,
  error,
  close,
  add,
  tile,
}: {
  vehicles: SaleVehicle[];
  save: (vehicles: SaleVehicle[]) => boolean;
  events: SaleEvent[];
  now: number;
  ready: boolean;
  error: string;
  close: () => void;
  add: () => void;
  tile: (vehicle: SaleVehicle) => ReactNode;
}) {
  useLocale();
  const workspace = useAccountWorkspace(),
    preferences = useSalePricePreferences();
  const [summaries, setSummaries] = useState<Record<string, PriceSummary>>({}),
    [priceError, setPriceError] = useState("");
  const [loadedCountries, setLoadedCountries] = useState<string[]>([]),
    [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [history, setHistory] = useState<SaleVehicle | null>(null);
  const [removed, setRemoved] = useState<{ vehicle: SaleVehicle; index: number } | null>(null);
  const countries = useMemo(
    () => [...new Set(vehicles.map((v) => v.country))].sort().join(","),
    [vehicles],
  );
  useEffect(() => {
    const c = new AbortController();
    for (const country of countries.split(",").filter(Boolean)) {
      void readPriceSummary(country, c.signal, retry > 0)
        .then((result) => {
          if (c.signal.aborted) return;
          setSummaries((old) => ({
            ...old,
            ...Object.fromEntries(result.items.map((item) => [item.vehicleId, item])),
          }));
          setLoadedCountries((old) => [...new Set([...old, country])]);
        })
        .catch(() => {
          if (!c.signal.aborted) setPriceError(t("部分历史记录读取失败，原价清单仍可使用。"));
        });
    }
    return () => c.abort();
  }, [countries, retry]);
  const savePreferences = (items: typeof preferences.items) =>
    preferences.save(
      Object.fromEntries(Object.entries(items).filter(([id]) => vehicles.some((v) => v.id === id))),
    );
  const totals = cartTotals(vehicles, preferences.items, workspace?.ownedVehicleIds);
  const rows = vehicles.filter((v) => {
    if (!(v.name + v.nameEn).toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "owned") return !!workspace?.ownedVehicleIds.has(v.id);
    if (filter === "unpurchased") return !workspace?.ownedVehicleIds.has(v.id);
    if (filter === "unknown") return !v.originalPrice?.amount;
    return true;
  });
  const enabled = ready && preferences.ready;
  return (
    <Modal
      title={t("我的购物车")}
      subtitle={
        workspace?.userId
          ? t(
              "载具沿用账号关注列表；购车勾选按账号保存。已拥有载具不计费，其余按原价合计；活动价格仅供历史查询。",
            )
          : t("游客清单保存在本浏览器。按原价分别合计整包人民币与金鹰价格。")
      }
      close={close}
      className="wt-sale-cart-modal"
    >
      <div className="wt-sale-cart-toolbar">
        <label className="wt-sale-cart-search">
          <span className="sr-only">{t("搜索购物车")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("搜索已加入的载具")}
          />
        </label>
        <label>
          <span className="sr-only">{t("筛选购物车")}</span>
          <GameSelect value={filter} onValueChange={setFilter}>
            <option value="all">
              {t("全部载具（")}
              {vehicles.length}）
            </option>
            <option value="unpurchased">{t("尚未拥有")}</option>
            <option value="owned">{t("已拥有")}</option>
            <option value="unknown">{t("资料待核对")}</option>
          </GameSelect>
        </label>
        <button onClick={add}>{t("＋ 添加载具")}</button>
      </div>
      {(error || priceError || preferences.error) && (
        <div className="wt-sale-cart-errors" role="alert">
          {error || priceError || preferences.error}
          {priceError && (
            <button
              onClick={() => {
                setPriceError("");
                setRetry((v) => v + 1);
              }}
            >
              {t("重试历史资料")}
            </button>
          )}
          {preferences.error && (
            <>
              <button onClick={() => download({ pending: preferences.exportPending(), vehicles })}>
                {t("导出待同步记录")}
              </button>
              <button onClick={() => void preferences.reload()}>{t("重新读取云端")}</button>
            </>
          )}
        </div>
      )}
      <div className="wt-sale-cart-scroll">
        <div className="wt-sale-cart-columns" aria-hidden="true">
          <span>{t("购车计划 / 载具")}</span>
          <span>{t("原价")}</span>
          <span>{t("历史低价")}</span>
          <span>{t("历史走势")}</span>
          <span>{t("活动窗口")}</span>
          <span>{t("操作")}</span>
        </div>
        {!vehicles.length ? (
          <div className="wt-sale-cart-empty">
            <h3>{t("把想买的载具放进购物车")}</h3>
            <p>{t("支持金鹰载具和 Gaijin 商城礼包，已有关注会自动保留。")}</p>
            <button className="primary" onClick={add}>
              {t("选择载具")}
            </button>
          </div>
        ) : !rows.length ? (
          <p className="wt-sale-cart-empty">{t("当前筛选没有匹配载具。")}</p>
        ) : (
          rows.map((v) => {
            const offer = primaryOffer(summaries[v.id]),
              event = nextSale(v, events, now);
            const quote = v.originalPrice,
              price = quote?.amount ?? null,
              currency = quote?.currency || "CNY";
            const selected = preferences.items[v.id]?.selected !== false;
            const owned = !!workspace?.ownedVehicleIds.has(v.id);
            const evidence = summaries[v.id]?.discountEvidence || [];
            const points = historicalDisplayPoints(v, offer, evidence);
            const promotion = summaries[v.id]?.discountEvidence
              ?.filter((e) => e.purchaseCondition === "普通单件购买")
              .sort((a, b) => b.discountPercent - a.discountPercent)[0];
            const minimum = historicalDisplayMinimum(v, offer, evidence),
              loaded = loadedCountries.includes(v.country);
            return (
              <article className="wt-sale-cart-row" key={v.id}>
                <div className="wt-sale-cart-vehicle">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={t("将{0}计入本轮购车计划", vehicleName(v))}
                      checked={selected && !owned}
                      disabled={!enabled || owned}
                      onChange={(e) =>
                        savePreferences({
                          ...preferences.items,
                          [v.id]: {
                            selected: e.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <div className="wt-sale-cart-tile">
                    {tile(v)}
                    {owned && <GameTag tone="emerald">{t("已拥有")}</GameTag>}
                  </div>
                </div>
                <div className="wt-sale-cart-price wt-sale-cart-original">
                  <strong>
                    {currency === "CNY" ? priceText(price, currency) : t("常规金鹰价")}
                  </strong>
                  {owned && <small>{t("已拥有 · 不计入合计")}</small>}
                  <small>
                    {currency === "CNY" ? t("整包原价") : t("常规金鹰价格")} ·{" "}
                    {priceDate(quote?.checkedAt ?? null)}
                  </small>
                </div>
                <div className="wt-sale-cart-price">
                  <b data-label={t("历史低价") + " · "}>
                    {!loaded
                      ? priceError
                        ? t("读取失败")
                        : t("读取中…")
                      : minimum
                        ? `${minimum.evidenceKind === "official_announcement_derived" ? "≈ " : ""}${priceText(minimum.amountMinor, currency)}`
                        : t("待核实")}
                  </b>
                  <small>
                    {minimum
                      ? `${priceDate(minimum.observedAt)}${minimum.evidenceKind === "official_announcement_derived" ? t(" · 公告折扣估算") : ""}`
                      : promotion
                        ? t("曾优惠 {0}%，金额待核实", promotion.discountPercent)
                        : offer
                          ? t("仅有原价采样，非历史最低")
                          : t("尚无报价记录")}
                  </small>
                </div>
                <div className="wt-sale-cart-observations">
                  <button
                    className="wt-price-trend-link"
                    onClick={() => setHistory(v)}
                    aria-label={t("展开{0}历史价格详情", vehicleName(v))}
                  >
                    <MiniPriceTrend points={points} />
                    <small>
                      {points.length
                        ? `${priceDate(points[0].observedAt)} — ${priceDate(points.at(-1)!.observedAt)}${points.some((p) => p.evidenceKind === "official_announcement_derived") ? t(" · 含估算") : ""}`
                        : loaded
                          ? t("尚无历史记录")
                          : t("读取中…")}
                    </small>
                  </button>
                </div>
                <div className="wt-sale-cart-event">
                  {event ? (
                    <>
                      <strong>{event.title}</strong>
                      <span>{saleCountdown(event, now)}</span>
                      <small className="wt-sale-cart-event-detail">{saleRange(event)}</small>
                      {event.startNotBefore && (
                        <small className="wt-sale-cart-event-detail">
                          {t("预计接续游戏内折扣结束后，具体开始以公告为准")}
                        </small>
                      )}
                      <small className="wt-sale-cart-event-detail">
                        {event.status === "predicted"
                          ? t("预测窗口，名单未公布")
                          : event.vehicleIds.includes(v.id)
                            ? t("已核对参与名单")
                            : t("需核对活动适用名单")}
                      </small>
                    </>
                  ) : (
                    <small>{t("暂无匹配的活动窗口")}</small>
                  )}
                </div>
                <div className="wt-sale-cart-actions">
                  {v.store && (
                    <a href={v.store} target="_blank" rel="noreferrer">
                      {t("官方购买 ↗")}
                    </a>
                  )}
                  <button
                    disabled={!ready}
                    onClick={() => {
                      const index = vehicles.findIndex((x) => x.id === v.id);
                      if (save(vehicles.filter((x) => x.id !== v.id)))
                        setRemoved({ vehicle: v, index });
                    }}
                    aria-label={t("移除{0}", vehicleName(v))}
                  >
                    {t("移除")}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
      <footer className="wt-sale-cart-footer">
        <div>
          <strong>
            {t("已选")}
            {totals.selected} {t("辆 ·")}
            {totals.products} {t("件商品")}
          </strong>
          <span>
            {totals.conflicts ? (
              t("报价冲突，暂不能合计")
            ) : (
              <>
                {priceText(totals.cny, "CNY")} <small>＋</small> {priceText(totals.ge, "GE")}
              </>
            )}
          </span>
          <small>
            {totals.missing
              ? t("{0} 辆缺少有效报价，未计入小计", totals.missing)
              : t("按原价合计；历史活动价不参与展示和合计")}
            {totals.owned > 0 && t(" · {0} 辆已拥有，已免计", totals.owned)}
            {totals.duplicates > 0 && t(" · {0} 个重复礼包已去重", totals.duplicates)}
          </small>
        </div>
        <div>
          <button
            disabled={!enabled}
            onClick={() =>
              savePreferences(
                Object.fromEntries(
                  vehicles.map((v) => [
                    v.id,
                    {
                      selected: !vehicles
                        .filter((x) => !workspace?.ownedVehicleIds.has(x.id))
                        .every((x) => preferences.items[x.id]?.selected !== false),
                    },
                  ]),
                ),
              )
            }
          >
            {t("全选 / 取消")}
          </button>
          <button
            onClick={() =>
              download({
                schemaVersion: 1,
                exportedAt: new Date().toISOString(),
                vehicles,
                preferences: preferences.items,
              })
            }
          >
            {t("导出清单")}
          </button>
        </div>
      </footer>
      {removed && (
        <output className="wt-sale-cart-undo">
          {t("已移除")}
          {removed.vehicle.name}
          <button
            disabled={!ready}
            onClick={() => {
              const next = [...vehicles];
              if (next.some((v) => v.id === removed.vehicle.id) || next.length >= 60) return;
              next.splice(Math.min(removed.index, next.length), 0, removed.vehicle);
              if (save(next)) setRemoved(null);
            }}
          >
            {t("撤销")}
          </button>
          <button onClick={() => setRemoved(null)} aria-label={t("关闭移除提示")}>
            ×
          </button>
        </output>
      )}
      {history && (
        <SalePriceHistory
          key={history.id}
          vehicle={history}
          summary={summaries[history.id]}
          close={() => setHistory(null)}
        />
      )}
    </Modal>
  );
}
