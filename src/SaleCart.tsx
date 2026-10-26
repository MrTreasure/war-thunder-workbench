import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { useAccountWorkspace } from "./workspace-context";
import { nextSale, saleCountdown, saleRange } from "./sale-calendar-model";
import type { SaleEvent, SaleVehicle } from "./sale-calendar-model";
import { readPriceSummary } from "./sale-price-api";
import { cartTotals, priceDate, priceText, primaryOffer } from "./sale-price-model";
import type { PriceOffer, PriceSummary } from "./sale-price-model";
import { useSalePricePreferences } from "./use-sale-price-preferences";
import { SalePriceHistory } from "./SalePriceHistory";
import "./sale-cart.css";

function MiniPriceTrend({ offer }: { offer: PriceOffer }) {
  const points = (offer.previewPoints || []).filter(
    (p) => p.evidenceKind !== "official_announcement_derived",
  );
  if (points.length < 2) return null;
  const low = Math.min(...points.map((p) => p.amountMinor)),
    high = Math.max(...points.map((p) => p.amountMinor));
  const start = Date.parse(points[0].observedAt),
    span = Math.max(1, Date.parse(points.at(-1)!.observedAt) - start);
  const x = (at: string) => 4 + ((Date.parse(at) - start) / span) * 100,
    y = (n: number) => 26 - ((n - low) / Math.max(1, high - low)) * 20;
  const d = points
    .map((p, i) =>
      i && Date.parse(p.observedAt) - Date.parse(points[i - 1].observedAt) <= 36 * 3600000
        ? `M${x(points[i - 1].observedAt)},${y(points[i - 1].amountMinor)}H${x(p.observedAt)}V${y(p.amountMinor)}`
        : "",
    )
    .join(" ");
  return (
    <svg
      className="wt-price-mini"
      viewBox="0 0 108 32"
      aria-label={`${points.length}个价格观测点，详情见历史记录`}
    >
      <path d={d} />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.observedAt)} cy={y(p.amountMinor)} r="2" />
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
  const workspace = useAccountWorkspace(),
    preferences = useSalePricePreferences();
  const [summaries, setSummaries] = useState<Record<string, PriceSummary>>({}),
    [priceError, setPriceError] = useState("");
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
    void Promise.allSettled(
      countries
        .split(",")
        .filter(Boolean)
        .map((country) => readPriceSummary(country, c.signal)),
    ).then((results) => {
      if (c.signal.aborted) return;
      const next: Record<string, PriceSummary> = {};
      let failed = false;
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const item of r.value.items) next[item.vehicleId] = item;
        } else failed = true;
      }
      setSummaries(next);
      setPriceError(failed ? "部分历史记录读取失败，原价清单仍可使用。" : "");
    });
    return () => c.abort();
  }, [countries]);
  const savePreferences = (items: typeof preferences.items) =>
    preferences.save(
      Object.fromEntries(Object.entries(items).filter(([id]) => vehicles.some((v) => v.id === id))),
    );
  const totals = cartTotals(vehicles, preferences.items);
  const rows = vehicles.filter((v) => {
    if (!(v.name + v.nameEn).toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "unknown") return !v.originalPrice?.amount;
    return true;
  });
  const enabled = ready && preferences.ready;
  return (
    <Modal
      title="我的购物车"
      subtitle={
        workspace?.userId
          ? "载具沿用账号关注列表；购车勾选按账号保存。按原价合计，活动价格仅供历史查询。"
          : "游客清单保存在本浏览器。按原价分别合计整包人民币与金鹰价格。"
      }
      close={close}
      className="wt-sale-cart-modal"
    >
      <div className="wt-sale-cart-toolbar">
        <label className="wt-sale-cart-search">
          <span className="sr-only">搜索购物车</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索已加入的载具"
          />
        </label>
        <label>
          <span className="sr-only">筛选购物车</span>
          <GameSelect value={filter} onValueChange={setFilter}>
            <option value="all">全部载具（{vehicles.length}）</option>
            <option value="unknown">资料待核对</option>
          </GameSelect>
        </label>
        <button onClick={add}>＋ 添加载具</button>
      </div>
      {(error || priceError || preferences.error) && (
        <div className="wt-sale-cart-errors" role="alert">
          {error || priceError || preferences.error}
          {preferences.error && (
            <>
              <button onClick={() => download({ pending: preferences.exportPending(), vehicles })}>
                导出待同步记录
              </button>
              <button onClick={() => void preferences.reload()}>重新读取云端</button>
            </>
          )}
        </div>
      )}
      <div className="wt-sale-cart-scroll">
        <div className="wt-sale-cart-columns" aria-hidden="true">
          <span>购车计划 / 载具</span>
          <span>原价</span>
          <span>已记录最低</span>
          <span>价格观测</span>
          <span>活动窗口</span>
          <span>操作</span>
        </div>
        {!vehicles.length ? (
          <div className="wt-sale-cart-empty">
            <h3>把想买的载具放进购物车</h3>
            <p>支持金鹰载具和 Gaijin 商城礼包，已有关注会自动保留。</p>
            <button className="primary" onClick={add}>
              选择载具
            </button>
          </div>
        ) : !rows.length ? (
          <p className="wt-sale-cart-empty">当前筛选没有匹配载具。</p>
        ) : (
          rows.map((v) => {
            const offer = primaryOffer(summaries[v.id]),
              event = nextSale(v, events, now);
            const quote = v.originalPrice,
              price = quote?.amount ?? null,
              currency = quote?.currency || "CNY";
            const selected = preferences.items[v.id]?.selected !== false;
            return (
              <article className="wt-sale-cart-row" key={v.id}>
                <div className="wt-sale-cart-vehicle">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`将${v.name}计入本轮购车计划`}
                      checked={selected}
                      disabled={!enabled}
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
                  {tile(v)}
                </div>
                <div className="wt-sale-cart-price">
                  <strong>{currency === "CNY" ? priceText(price, currency) : "常规金鹰价"}</strong>
                  <small>
                    {currency === "CNY" ? "整包原价" : "常规金鹰价格"} ·{" "}
                    {priceDate(quote?.checkedAt ?? null)}
                  </small>
                </div>
                <div className="wt-sale-cart-price">
                  <b>
                    {priceText(offer?.minimum?.amountMinor ?? null, offer?.currency || currency)}
                  </b>
                  <small>
                    {offer?.sampleCount === 1
                      ? "首次记录"
                      : priceDate(offer?.minimum?.observedAt ?? null)}
                  </small>
                </div>
                <div className="wt-sale-cart-observations">
                  {offer && <MiniPriceTrend offer={offer} />}
                  <span>{offer?.sampleCount || 0} 次观测</span>
                  <small>
                    {offer && offer.sampleCount > 1
                      ? `自 ${priceDate(offer.firstObservedAt)}`
                      : "走势积累中"}
                  </small>
                  <button className="quiet-button" onClick={() => setHistory(v)}>
                    查看历史 ↗
                  </button>
                </div>
                <div className="wt-sale-cart-event">
                  {event ? (
                    <>
                      <strong>{event.title}</strong>
                      <span>{saleCountdown(event, now)}</span>
                      <small>{saleRange(event)}</small>
                      <small>
                        {event.status === "predicted"
                          ? "预测窗口，名单未公布"
                          : event.vehicleIds.includes(v.id)
                            ? "已核对参与名单"
                            : "需核对活动适用名单"}
                      </small>
                    </>
                  ) : (
                    <small>暂无匹配的活动窗口</small>
                  )}
                </div>
                <div className="wt-sale-cart-actions">
                  {v.store && (
                    <a href={v.store} target="_blank" rel="noreferrer">
                      官方购买 ↗
                    </a>
                  )}
                  <button
                    disabled={!ready}
                    onClick={() => {
                      const index = vehicles.findIndex((x) => x.id === v.id);
                      if (save(vehicles.filter((x) => x.id !== v.id)))
                        setRemoved({ vehicle: v, index });
                    }}
                    aria-label={`移除${v.name}`}
                  >
                    移除
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
            已选 {totals.selected} 辆 · {totals.products} 件商品
          </strong>
          <span>
            {totals.conflicts ? (
              "报价冲突，暂不能合计"
            ) : (
              <>
                {priceText(totals.cny, "CNY")} <small>＋</small> {priceText(totals.ge, "GE")}
              </>
            )}
          </span>
          <small>
            {totals.missing
              ? `${totals.missing} 辆缺少有效报价，未计入小计`
              : "按原价合计；历史活动价不参与展示和合计"}
            {totals.duplicates > 0 && ` · ${totals.duplicates} 个重复礼包已去重`}
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
                      selected: !vehicles.every((x) => preferences.items[x.id]?.selected !== false),
                    },
                  ]),
                ),
              )
            }
          >
            全选 / 取消
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
            导出清单
          </button>
        </div>
      </footer>
      {removed && (
        <output className="wt-sale-cart-undo">
          已移除 {removed.vehicle.name}
          <button
            disabled={!ready}
            onClick={() => {
              const next = [...vehicles];
              if (next.some((v) => v.id === removed.vehicle.id) || next.length >= 60) return;
              next.splice(Math.min(removed.index, next.length), 0, removed.vehicle);
              if (save(next)) setRemoved(null);
            }}
          >
            撤销
          </button>
          <button onClick={() => setRemoved(null)} aria-label="关闭移除提示">
            ×
          </button>
        </output>
      )}
      {history && (
        <SalePriceHistory key={history.id} vehicle={history} close={() => setHistory(null)} />
      )}
    </Modal>
  );
}
