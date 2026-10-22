import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import catalogSettings from "../data/catalog-settings.json";
import { GameSelect } from "./components/GameSelect";
import { rankNumber } from "./planner";
import { Modal } from "./Modal";
import { statsRequest, statsDate, statsNumber, statsCategoryNames } from "./player-stats-api";
import type { PlayerProfile, StatsSession } from "./player-stats-api";

type Item = { id: string; name: string; country: string; category: string; rank?: string | null };
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
  unpriced: { id: string; name: string; reason: string }[];
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
function ValueComposition({ scenario }: { scenario: Scenario }) {
  const parts = [
    { name: "研发点", cents: scenario.rpCents, color: "#d9b868" },
    { name: "金鹰载具", cents: scenario.geCents, color: "#78aba8" },
    { name: "礼包", cents: scenario.packCents, color: "#a28cba" },
  ];
  const total = parts.reduce((sum, p) => sum + BigInt(p.cents), 0n);
  let offset = 0;
  return (
    <aside className="wt-valuation-composition" aria-label="正常价值占比">
      <h3>正常价值占比</h3>
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
    value?.research.filter(
      (v) =>
        (researchCountry === "all" || v.country === researchCountry) &&
        (researchCategory === "all" || v.category === researchCategory) &&
        (researchRank === "all" || (v.rank || "unknown") === researchRank),
    ) || [];
  const countryName = (id: string) =>
    (catalogSettings.countries as Record<string, string>)[id] || id;
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
          }}
          className="wt-valuation-dialog"
        >
          <div className="wt-valuation-overview">
            <p className="wt-valuation-intro">
              {value.ownership?.verified ? (
                <>
                  依据官方公开车库中 {value.ownership.ownedCount} 辆已拥有载具计算，包含{" "}
                  {value.ownership.unplayedCount}{" "}
                  辆未出战载具。研发点按已拥有载具去重汇总，不额外推算未持有的前置。
                </>
              ) : (
                <>根据 {value.observedCount} 辆出战载具与当前前置推算，尚未核验完整已拥有清单。</>
              )}
              同一载具、同一礼包只计算一次。
              {value.ownership?.fetchedAt && (
                <> 车库核验于 {statsDate(value.ownership.fetchedAt)}。</>
              )}
              {value.ownership?.notice && <> {value.ownership.notice}</>}
            </p>
            <ValueComposition scenario={value.scenarios.normal} />
          </div>
          <div className="wt-valuation-totals">
            {Object.entries(value.scenarios).map(([key, s]) => (
              <section key={key}>
                <h3>{s.label}</h3>
                <strong>{valuationMoney(s.knownCents)}</strong>
                <small>{s.totalCents == null ? "已核价部分，存在未计价项目" : "已核价合计"}</small>
                <dl>
                  <div>
                    <dt>研发点</dt>
                    <dd>{valuationMoney(s.rpCents)}</dd>
                  </div>
                  <div>
                    <dt>金鹰载具</dt>
                    <dd>{valuationMoney(s.geCents)}</dd>
                  </div>
                  <div>
                    <dt>礼包</dt>
                    <dd>{valuationMoney(s.packCents)}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
          <section className="wt-valuation-section">
            <h3>计算规则</h3>
            <p>
              正常／折扣：陆战、直升机 ¥3／万 RP，飞机 ¥2／万 RP；折扣金鹰与礼包 5
              折。二手：陆战、直升机 ¥1.5／万 RP，飞机 ¥1／万 RP，金鹰与礼包按原价 3 折。
            </p>
            <p>
              金鹰按 ¥189／5000 GE 换算，共 {statsNumber(value.geTotal)}{" "}
              GE。礼包采用已核验人民币整包原价，保留查价日期；特殊载具优先单列，不重复计入金鹰或礼包。金额按各分项汇总后四舍五入到分。
            </p>
          </section>
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
                    {[...new Set(value.research.map((v) => v.rank || "unknown"))]
                      .sort((a, b) => (rankNumber(a) || 99) - (rankNumber(b) || 99))
                      .map((rank) => (
                        <option key={rank} value={rank}>
                          {rank === "unknown" ? "等级待核验" : `Rank ${rank}`}
                        </option>
                      ))}
                  </GameSelect>
                </label>
                <output>
                  显示 {filteredResearch.length} / {value.researchCount} 辆
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
            <details className="wt-valuation-section">
              <summary>未计价项目 · {value.unpriced.length}</summary>
              <ul>
                {value.unpriced.map((v, i) => (
                  <li key={v.id + i}>
                    <span>{v.name}</span>
                    <span>{v.reason}</span>
                  </li>
                ))}
              </ul>
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
