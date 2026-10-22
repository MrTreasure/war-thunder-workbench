import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import catalogSettings from "../data/catalog-settings.json";
import { GameSelect } from "./components/GameSelect";
import valuationRules from "../data/account-valuation-rules.json";
import { Modal } from "./Modal";
import { statsRequest, statsDate, statsNumber, statsCategoryNames } from "./player-stats-api";
import type { PlayerProfile, StatsSession } from "./player-stats-api";

type Item = { id: string; name: string; country: string; category: string; rank?: string | null };
type ScenarioKey = "normal" | "discount" | "secondHand";
const scenarioKeys: ScenarioKey[] = ["normal", "discount", "secondHand"];
type UnpricedItem = Partial<Item> & {
  id: string;
  name: string;
  reason: string;
  rp?: number | null;
  rpSource?: string | null;
  rpCheckedAt?: string | null;
  owned?: boolean;
  observed?: boolean;
  vehicles?: Item[];
};
type Scenario = {
  label: string;
  rpCents: number;
  geCents: number;
  packCents: number;
  knownCents: number;
  totalCents: number | null;
};
type Valuation = {
  id: string;
  fetchedAt: string;
  calculatedAt: string;
  cached: boolean;
  observedCount: number;
  ownership?: {
    verified: boolean;
    ownedCount: number | null;
    unplayedCount: number | null;
    fetchedAt: string | null;
    notice?: string;
  };

  researchCount: number;
  geTotal: number;
  rpByCategory: Record<string, number>;
  scenarios: Record<"normal" | "discount" | "secondHand", Scenario>;
  gold: (Item & {
    ge: number | null;
    amountCents: number | null;
    source: string;
    checkedAt: string;
  })[];
  packs: {
    productId: string;
    title: string;
    vehicles: Item[];
    amountCents: number | null;
    checkedAt: string | null;
    source: string;
  }[];
  marketKnownGjnCents: number;
  marketUnpricedCount: number;
  market: (Item & {
    averageGjnCents: number | null;
    checkedAt: string | null;
    sampleCount: number | null;
    method: string | null;
    source: string;
  })[];
  research: (Item & {
    rp: number | null;
    observed: boolean;
    owned?: boolean;
    rpSource: string | null;
    rpCheckedAt: string | null;
  })[];
  unpriced: UnpricedItem[];
  rules: {
    ge: { cents: number; units: number };
    rpUnit: number;
    scenarios: Record<string, { rpCents: Record<string, number>; purchasePercent: number }>;
  };
  notice: string;
};
export function valuationMoney(cents: number | null, symbol = "¥") {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const n = BigInt(cents);
  return `${symbol}${(n / 100n).toLocaleString("zh-CN")}.${String(n % 100n).padStart(2, "0")}`;
}
function VehicleArt({ item, compact = false }: { item: Item; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={compact ? "wt-valuation-art wt-valuation-art-compact" : "wt-valuation-art"}>
      {failed ? (
        <span className="wt-valuation-art-missing">图片暂不可用</span>
      ) : (
        <img
          src={catalogSettings.vehicleThumbnailTemplate.replace(
            "{id}",
            encodeURIComponent(item.id),
          )}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
function ProductCard({
  title,
  source,
  items,
  kind,
  price,
  children,
}: {
  title: string;
  source: string;
  items: Item[];
  kind: string;
  price: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="wt-valuation-product">
      <div className="wt-valuation-product-media">
        {items.map((item) => (
          <figure key={item.id}>
            <VehicleArt item={item} />
            {items.length > 1 && <figcaption>{item.name}</figcaption>}
          </figure>
        ))}
      </div>
      <div className="wt-valuation-product-body">
        <small className="wt-valuation-product-kind">{kind}</small>
        <h4>
          <a href={source} target="_blank" rel="noreferrer">
            {title} <span aria-hidden="true">↗</span>
          </a>
        </h4>
        <strong className="wt-valuation-product-price">{price}</strong>
        <div className="wt-valuation-product-notes">{children}</div>
      </div>
    </article>
  );
}
function ValueComposition({ scenario, label }: { scenario: Scenario; label: string }) {
  const parts = [
    { name: "研发点", cents: scenario.rpCents, color: "#d9b868" },
    { name: "金鹰载具", cents: scenario.geCents, color: "#78aba8" },
    { name: "礼包", cents: scenario.packCents, color: "#a28cba" },
  ];
  const total = parts.reduce((sum, p) => sum + BigInt(p.cents), 0n);
  let offset = 0;
  return (
    <aside className="wt-valuation-composition" aria-label={`${label}占比`}>
      <h3>{label}占比</h3>
      <div className="wt-valuation-chart-body">
        <svg
          viewBox="0 0 100 100"
          aria-label={
            total > 0n ? "研发点、金鹰载具和礼包的已核价占比，详见图例" : "暂无已核价金额"
          }
        >
          <circle cx="50" cy="50" r="40" fill="none" stroke="#394247" strokeWidth="16" />
          {parts.map((p) => {
            const share = total > 0n ? (Number(p.cents) / Number(total)) * 100 : 0;
            const start = offset;
            offset += share;
            return (
              <circle
                key={p.name}
                cx="50"
                cy="50"
                r="40"
                pathLength="100"
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start}
                transform="rotate(-90 50 50)"
              >
                <title>
                  {p.name}：{valuationMoney(p.cents)}
                </title>
              </circle>
            );
          })}
          <text x="50" y="48" textAnchor="middle">
            已核价
          </text>
          <text x="50" y="62" textAnchor="middle">
            CNY
          </text>
        </svg>
        <dl>
          {parts.map((p) => (
            <div key={p.name}>
              <dt>
                <i style={{ background: p.color }} />
                {p.name}
              </dt>
              <dd>
                {total > 0n
                  ? `${(Number((BigInt(p.cents) * 10000n) / total) / 100).toFixed(2)}%`
                  : "—"}
                <small>{valuationMoney(p.cents)}</small>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <small>仅统计已核价人民币金额；特殊载具 GJN 单列。</small>
    </aside>
  );
}
export function AccountValuation({
  profile,
  session,
  onSessionChange,
}: {
  profile: PlayerProfile;
  session: StatsSession | null;
  onSessionChange: () => Promise<void>;
}) {
  const [value, setValue] = useState<Valuation | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [researchCountry, setResearchCountry] = useState("all");
  const [researchCategory, setResearchCategory] = useState("all");
  const [researchRank, setResearchRank] = useState("all");
  const [showResearch, setShowResearch] = useState(false);
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("normal");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const limit = session?.limits.valuationLimit;
  const remaining =
    limit == null
      ? "不限次"
      : `${Math.max(0, limit - (session?.valuation?.used || 0) - (session?.valuation?.reserved || 0))} 次`;
  async function calculate() {
    if (busy) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError("");
    try {
      const result = await statsRequest<Valuation>(
        "valuations",
        { snapshotId: profile.snapshotId, requestId: "value_" + crypto.randomUUID() },
        c.signal,
      );
      if (!c.signal.aborted) {
        setValue(result);
        setOpen(true);
      }
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : "估值计算失败，请重试。");
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        void onSessionChange();
      }
    }
  }
  const filteredResearch =
    value?.research
      .filter(
        (v) =>
          (researchCountry === "all" || v.country === researchCountry) &&
          (researchCategory === "all" || v.category === researchCategory) &&
          (researchRank === "all" || (v.rank || "unknown") === researchRank),
      )
      .sort((a, b) => (b.rp ?? -1) - (a.rp ?? -1) || a.name.localeCompare(b.name, "zh-CN")) || [];
  const countryName = (id: string) =>
    (catalogSettings.countries as Record<string, string>)[id] || id;
  const selectedScenario = value?.scenarios[scenarioKey];
  const selectedRule = value?.rules.scenarios[scenarioKey];
  const knownItems = new Map<
    string,
    Partial<Item> & { rp?: number | null; rpSource?: string | null; rpCheckedAt?: string | null }
  >([
    ...profile.vehicles.map(
      (v) =>
        [
          v.id,
          { ...v, country: v.country || undefined, category: v.category || undefined },
        ] as const,
    ),
    ...(value
      ? [
          ...value.research,
          ...value.gold,
          ...value.market,
          ...value.packs.flatMap((p) => p.vehicles),
        ].map((v) => [v.id, v] as const)
      : []),
  ]);
  const unpricedItems =
    value?.unpriced
      .map((item) => ({ ...knownItems.get(item.id), ...item }))
      .sort((a, b) => (b.rp ?? -1) - (a.rp ?? -1) || a.name.localeCompare(b.name, "zh-CN")) || [];
  return (
    <div className="wt-account-valuation">
      <button
        className="wt-valuation-trigger"
        disabled={!session || busy}
        onClick={() => (value ? setOpen(true) : void calculate())}
      >
        {busy ? (
          "正在计算估值…"
        ) : value ? (
          <>
            账号估值 <b>{valuationMoney(value.scenarios.normal.knownCents)}</b>
            {value.scenarios.normal.totalCents == null && "（部分）"}{" "}
            <span aria-hidden="true">›</span>
          </>
        ) : (
          "账号估值"
        )}
      </button>
      {!value && <small>独立额度 · 今日 {session ? remaining : "—"}</small>}
      {error && (
        <small className="wt-record-error" role="alert">
          {error}
        </small>
      )}
      {open && value && (
        <Modal
          title={`${profile.nickname} · 账号估值`}
          close={() => {
            setOpen(false);
            setShowResearch(false);
            setShowUnpriced(false);
          }}
          className="wt-valuation-dialog"
        >
          <div className="wt-valuation-coverage">
            <span className="wt-valuation-verified">
              {value.ownership?.verified ? "公开车库已核验" : "按出战记录推算"}
            </span>
            <span>
              <b>{value.ownership?.ownedCount ?? value.observedCount}</b> 辆
              {value.ownership?.verified ? "已拥有" : "出战载具"}
            </span>
            {value.ownership?.verified && (
              <span>
                <b>{value.ownership.unplayedCount}</b> 辆未出战
              </span>
            )}
            <span>
              <b>{value.unpriced.length}</b> 项待核价
            </span>
          </div>
          <section className="wt-valuation-dashboard" aria-label="价值概览">
            <fieldset className="wt-valuation-scenarios" aria-label="选择价值类型">
              {scenarioKeys.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={scenarioKey === key}
                  onClick={() => setScenarioKey(key)}
                >
                  <span>{valuationRules.scenarios[key].label}</span>
                  <strong>{valuationMoney(value.scenarios[key].knownCents)}</strong>
                </button>
              ))}
            </fieldset>
            {selectedScenario && selectedRule && (
              <div className="wt-valuation-summary">
                <div className="wt-valuation-current" aria-live="polite" aria-atomic="true">
                  <span className="wt-valuation-eyebrow">
                    {valuationRules.scenarios[scenarioKey].label} · CNY
                  </span>
                  <strong className="wt-valuation-amount">
                    {valuationMoney(selectedScenario.knownCents)}
                  </strong>
                  <output className="wt-valuation-price-status">
                    {selectedScenario.totalCents == null
                      ? "已核价部分，未计价项目另列"
                      : "已核价合计"}
                  </output>
                  <dl className="wt-valuation-rate-note">
                    <div>
                      <dt>陆战 / 直升机</dt>
                      <dd>{valuationMoney(selectedRule.rpCents.ground)} / 万 RP</dd>
                    </div>
                    <div>
                      <dt>飞机</dt>
                      <dd>{valuationMoney(selectedRule.rpCents.aviation)} / 万 RP</dd>
                    </div>
                    <div>
                      <dt>金鹰 / 礼包</dt>
                      <dd>
                        {selectedRule.purchasePercent === 100
                          ? "按原价"
                          : `按原价 ${selectedRule.purchasePercent / 10} 折`}
                      </dd>
                    </div>
                  </dl>
                </div>
                <ValueComposition
                  scenario={selectedScenario}
                  label={valuationRules.scenarios[scenarioKey].label}
                />
              </div>
            )}
          </section>
          <details className="wt-valuation-basis">
            <summary>
              估值依据与计算规则{" "}
              <span>
                {value.ownership?.fetchedAt
                  ? `车库核验 ${statsDate(value.ownership.fetchedAt)}`
                  : "出战记录与当前前置推算"}
              </span>
            </summary>
            <p>
              {value.ownership?.verified
                ? "依据官方公开车库中的已拥有载具计算，包含未出战载具。研发点按已拥有载具去重汇总，不额外推算未持有的前置。"
                : "根据出战记录与当前研发前置推算，尚未核验完整已拥有清单。"}{" "}
              同一载具、同一礼包只计算一次。{value.ownership?.notice}
            </p>
            <p>
              正常／折扣：陆战、直升机 ¥3／万 RP，飞机 ¥2／万 RP；折扣金鹰与礼包 5
              折。交易：陆战、直升机 ¥1.5／万 RP，飞机 ¥1／万 RP，金鹰与礼包按原价 3 折。
            </p>
            <p>
              金鹰按 ¥189／5000 GE 换算，共 {statsNumber(value.geTotal)}{" "}
              GE。礼包采用已核验人民币整包原价，保留查价日期；特殊载具优先单列，不重复计入金鹰或礼包。金额按各分项汇总后四舍五入到分。
            </p>
          </details>
          <section className="wt-valuation-section">
            <h3>金鹰载具 · {value.gold.length}</h3>
            {value.gold.length ? (
              <div className="wt-valuation-products">
                {value.gold.map((v) => (
                  <ProductCard
                    key={v.id}
                    title={v.name}
                    source={v.source}
                    items={[v]}
                    kind={`${statsCategoryNames[v.category] || v.category} · 金鹰载具`}
                    price={valuationMoney(v.amountCents)}
                  >
                    <span>{statsNumber(v.ge)} GE · 原价折算</span>
                    {v.checkedAt && <small>核验 {statsDate(v.checkedAt)}</small>}
                  </ProductCard>
                ))}
              </div>
            ) : (
              <p>出战记录中未识别到金鹰载具。</p>
            )}
          </section>
          <section className="wt-valuation-section">
            <h3>礼包载具 · {value.packs.length} 个礼包</h3>
            {value.packs.length ? (
              <div className="wt-valuation-products">
                {value.packs.map((p) => (
                  <ProductCard
                    key={p.productId}
                    title={p.title}
                    source={p.source}
                    items={p.vehicles}
                    kind={`整包原价 · 已识别 ${p.vehicles.length} 辆`}
                    price={valuationMoney(p.amountCents)}
                  >
                    {p.vehicles.length === 1 && <span>{p.vehicles[0].name}</span>}
                    <small>{p.checkedAt ? `核验 ${statsDate(p.checkedAt)}` : "尚无有效报价"}</small>
                  </ProductCard>
                ))}
              </div>
            ) : (
              <p>出战记录中未识别到礼包载具。</p>
            )}
          </section>
          <section className="wt-valuation-section">
            <h3>特殊载具 · {value.market.length}</h3>
            <p>
              Gaijin 币均价单独展示，不计入人民币总价。已核价合计{" "}
              {valuationMoney(value.marketKnownGjnCents, "")} GJN；{value.marketUnpricedCount}{" "}
              辆待核价。
            </p>
            {value.market.length ? (
              <div className="wt-valuation-products">
                {value.market.map((v) => (
                  <ProductCard
                    key={v.id}
                    title={v.name}
                    source={v.source}
                    items={[v]}
                    kind={`${statsCategoryNames[v.category] || v.category} · 市场特殊载具`}
                    price={
                      v.averageGjnCents == null
                        ? "待核价"
                        : valuationMoney(v.averageGjnCents, "") + " GJN"
                    }
                  >
                    <span>
                      {v.sampleCount == null
                        ? "尚无经核验的成交均价"
                        : `${statsNumber(v.sampleCount)} 个成交样本`}
                    </span>
                    <small>
                      {v.checkedAt ? `核验 ${statsDate(v.checkedAt)}` : "未知价格不按零元计算"}
                    </small>
                    {v.method && (
                      <details className="wt-valuation-product-method">
                        <summary>均价口径</summary>
                        <p>{v.method}</p>
                      </details>
                    )}
                  </ProductCard>
                ))}
              </div>
            ) : (
              <p>出战记录中未识别到市场特殊载具。</p>
            )}
          </section>
          <details
            className="wt-valuation-section"
            onToggle={(event) => setShowResearch(event.currentTarget.open)}
          >
            <summary>
              研发点明细 · {value.researchCount} 辆（
              {value.ownership?.verified ? "已拥有" : "含推算前置"}）
            </summary>
            <p>
              {Object.entries(value.rpByCategory)
                .map(([cat, rp]) => `${statsCategoryNames[cat] || cat} ${statsNumber(rp)} RP`)
                .join(" · ") || "暂无已核实研发点"}
            </p>
            {showResearch && (
              <div className="wt-valuation-filters">
                <label>
                  国别
                  <GameSelect value={researchCountry} onValueChange={setResearchCountry}>
                    <option value="all">全部国别</option>
                    {[...new Set(value.research.map((v) => v.country))].sort().map((id) => (
                      <option key={id} value={id}>
                        {countryName(id)}
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  军种
                  <GameSelect value={researchCategory} onValueChange={setResearchCategory}>
                    <option value="all">全部军种</option>
                    {[...new Set(value.research.map((v) => v.category))].sort().map((id) => (
                      <option key={id} value={id}>
                        {statsCategoryNames[id] || id}
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  等级
                  <GameSelect value={researchRank} onValueChange={setResearchRank}>
                    <option value="all">全部等级</option>
                    {valuationRules.researchRanks.map((rank) => (
                      <option key={rank} value={rank}>
                        Rank {rank}
                      </option>
                    ))}
                    {value.research.some((v) => !v.rank) && (
                      <option value="unknown">等级待核验</option>
                    )}
                  </GameSelect>
                </label>
                <output>
                  显示 {filteredResearch.length} / {value.researchCount} 辆 · 研发点降序
                </output>
              </div>
            )}
            {showResearch && !filteredResearch.length && <output>没有符合筛选条件的载具。</output>}
            {showResearch && (
              <div className="wt-valuation-research">
                {filteredResearch.map((v) => (
                  <article key={v.id}>
                    <VehicleArt item={v} compact />
                    <div>
                      <h4>
                        {v.rpSource ? (
                          <a href={v.rpSource} target="_blank" rel="noreferrer">
                            {v.name}
                          </a>
                        ) : (
                          v.name
                        )}
                      </h4>
                      <small>
                        {v.owned
                          ? v.observed
                            ? "已拥有 · 有出战记录"
                            : "已拥有 · 未出战"
                          : v.observed
                            ? "有出战记录"
                            : "根据当前前置推算"}{" "}
                        · {countryName(v.country)} · {statsCategoryNames[v.category] || v.category}{" "}
                        · {v.rank ? `Rank ${v.rank}` : "等级待核验"}
                      </small>
                      <strong>{statsNumber(v.rp)} RP</strong>
                      <small>
                        {v.rpCheckedAt ? `核验 ${statsDate(v.rpCheckedAt)}` : "研发点待核验"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>
          {!!value.unpriced.length && (
            <details
              className="wt-valuation-section"
              onToggle={(event) => setShowUnpriced(event.currentTarget.open)}
            >
              <summary>未计价项目 · {value.unpriced.length}</summary>
              <p>以下项目资料或价格尚未核实，未按零元计入估值。</p>
              {showUnpriced && (
                <div className="wt-valuation-research wt-valuation-unpriced">
                  {unpricedItems.map((v, i) => {
                    const vehicles = v.vehicles?.length ? v.vehicles : [v];
                    return (
                      <article key={v.id + i}>
                        <div className="wt-valuation-unpriced-art">
                          {vehicles.map((item) => (
                            <VehicleArt
                              key={item.id}
                              item={{
                                id: item.id,
                                name: item.name,
                                country: item.country || "",
                                category: item.category || "",
                              }}
                              compact
                            />
                          ))}
                        </div>
                        <div>
                          <h4>
                            {v.rpSource ? (
                              <a href={v.rpSource} target="_blank" rel="noreferrer">
                                {v.name}
                              </a>
                            ) : (
                              v.name
                            )}
                          </h4>
                          {v.owned && (
                            <small>{v.observed ? "已拥有 · 有出战记录" : "已拥有 · 未出战"}</small>
                          )}
                          {vehicles.map((item) => (
                            <small key={item.id}>
                              {vehicles.length > 1 ? `${item.name} · ` : ""}
                              {item.country ? countryName(item.country) : "国别待核验"} ·{" "}
                              {item.category
                                ? statsCategoryNames[item.category] || item.category
                                : "军种待核验"}{" "}
                              · {item.rank ? `Rank ${item.rank}` : "等级待核验"}
                            </small>
                          ))}
                          {v.rp != null && <strong>{statsNumber(v.rp)} RP</strong>}
                          <span className="wt-valuation-unpriced-reason">{v.reason}</span>
                          {v.rpCheckedAt && <small>研发点核验 {statsDate(v.rpCheckedAt)}</small>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </details>
          )}
          <footer className="wt-valuation-section">
            <p>{value.notice}</p>
            <small>
              资料采集 {statsDate(value.fetchedAt)} · 估值计算 {statsDate(value.calculatedAt)}
              {value.cached && " · 已命中估值缓存，本次不扣次"}
            </small>
          </footer>
        </Modal>
      )}
    </div>
  );
}
