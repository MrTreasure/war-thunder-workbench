import { t, getLocale, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { visibleValuation } from "./valuation-visibility";
import { RelativeTime } from "./RelativeTime";
import { RefreshTextAction } from "./RefreshTextAction";
import { statsAvailableRequests } from "./player-stats-api";
import { useVehicleCatalog } from "./vehicle-catalog";
import { VehicleTile } from "./VehicleTile";
import type { VehicleTileUnit } from "./VehicleTile";
import { vehicleDisplayName } from "./vehicle-display-name";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { GameSelect } from "./components/GameSelect";
import valuationRules from "../data/account-valuation-rules.json";
import vehiclePolicies from "../data/account-vehicle-policies.json";
import {
  cacheValuation,
  cachedValuation,
  forgetCachedValuation,
  valuationCacheScope,
} from "./account-valuation-cache";
import { Modal } from "./Modal";
import { StatsError, statsRequest, statsNumber, statsCategoryNames } from "./player-stats-api";
import type { PlayerProfile, StatsSession } from "./player-stats-api";
import { sortValuationPrices } from "./account-valuation-sort";
import { statsCountryId, statsCountryMatches, statsCountryLabel } from "./stats-country";

// Hide only the initial vehicles whose free research AND purchase were verified.
// Keep exclusions for promotional, hidden and other special vehicles visible.
const hiddenInitialVehicles = new Set(
  vehiclePolicies.vehicles
    .filter(
      (policy) =>
        policy.classification === "initial_free" &&
        policy.freeResearch === true &&
        policy.freePurchase === true,
    )
    .map((policy) => policy.id),
);

type Item = VehicleTileUnit & { country: string; category: string; owned?: boolean };
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
  manualCents?: number;
  marketCents: number;
  knownCents: number;
  totalCents: number | null;
};
export type Valuation = {
  calculationVersion: "market-cny-v1" | "market-cny-v2";
  marketTotalCnyCents: number;
  id: string;
  snapshotId: string;
  player: { uid: string; nickname: string };
  fetchedAt: string;
  calculatedAt: string;
  cached: boolean;
  localCached?: boolean;
  localStale?: boolean;
  policyVersion?: string;
  excluded?: (Item & { reason: string; source?: string | null })[];
  manual?: (Item & {
    reason: string;
    source?: string | null;
    prices: Record<ScenarioKey, number | null>;
  })[];
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
    referenceCnyCents: number | null;
    quoteBasis: string | null;
    lowestAskGjnCents: number | null;
    referenceLimitGjnCents: number | null;
    fx: { publicationDate?: string; publishedAt?: string; cnyPerUsd?: string };
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
    marketPurchasePercent?: Record<string, number>;
    ge: { cents: number; units: number };
    rpUnit: number;
    scenarios: Record<string, { rpCents: Record<string, number>; purchasePercent: number }>;
  };
  notice: string;
};
export function valuationMoney(cents: number | null, symbol = "") {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return `${symbol}${value < 0n ? "-" : ""}${(absolute / 100n).toLocaleString(getLocale())}.${String(absolute % 100n).padStart(2, "0")}`;
}
function valuationTotal(cents: number | null) {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const value = BigInt(cents);
  const rounded = value < 0n ? -((-value + 50n) / 100n) : (value + 50n) / 100n;
  return `${rounded.toLocaleString(getLocale())}`;
}
function valuationUnitPrice(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) return "待核价";
  const value = BigInt(cents);
  const fraction = String(value % 100n)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${(value / 100n).toLocaleString(getLocale())}${fraction ? "." + fraction : ""}`;
}
function marketQuoteBasis(method: string | null) {
  if (method?.startsWith("official-order-book:lowest-ask;")) return "当前最低挂售价";
  if (method?.startsWith("user-reference:market-cap;")) return "用户设定参考上限";
  return null;
}
function ValuationVehicle({
  item,
  showCountry = true,
  showRank = true,
}: {
  item: Item;
  showCountry?: boolean;
  showRank?: boolean;
}) {
  return (
    <VehicleTile
      unit={item}
      href={"https://wiki.warthunder.com/unit/" + encodeURIComponent(item.id)}
      owned={item.owned ?? false}
      showRank={showRank}
      countryLabel={showCountry ? statsCountryLabel(item.country) : undefined}
    />
  );
}
function ProductCard({
  title,
  source,
  items,
  kind,
  price,
  children,
  vehicleKind,
  owned = false,
}: {
  vehicleKind?: string;
  owned?: boolean;
  title: string;
  source: string;
  items: Item[];
  kind: string;
  price: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className={`wt-valuation-product${vehicleKind === "pack" && items.length > 1 ? " wt-valuation-product-pack" : ""}`}
    >
      <div className="wt-valuation-product-media">
        {localize(
          items.map((item) => (
            <VehicleTile
              key={item.id}
              href={"https://wiki.warthunder.com/unit/" + encodeURIComponent(item.id)}
              unit={{
                ...item,
                kind: vehicleKind || item.kind,
                price: vehicleKind === "gold" ? item.ge : item.price,
              }}
              owned={owned}
              showRank
              countryLabel={statsCountryLabel(item.country)}
            />
          )),
        )}
      </div>
      <div className="wt-valuation-product-body">
        <small className="wt-valuation-product-kind">
          {localize(
            vehicleKind === "pack" ? (
              <a href={source} target="_blank" rel="noreferrer">
                {localize(kind)} ↗
              </a>
            ) : (
              kind
            ),
          )}
        </small>
        {localize(
          vehicleKind === "pack" && items.length > 1 && (
            <h4>
              <a href={source} target="_blank" rel="noreferrer">
                {localize(vehicleDisplayName(title))} <span aria-hidden="true">↗</span>
              </a>
            </h4>
          ),
        )}
        <strong className="wt-valuation-product-price">{localize(price)}</strong>
        <div className="wt-valuation-product-notes">{localize(children)}</div>
      </div>
    </article>
  );
}
const productBreakpoints = [
  "(max-width: 380px)",
  "(max-width: 1000px), (max-width: 1100px) and (pointer: coarse)",
];
function productColumns() {
  return window.matchMedia(productBreakpoints[0]).matches
    ? 1
    : window.matchMedia(productBreakpoints[1]).matches
      ? 1
      : 2;
}
function subscribeProductColumns(listener: () => void) {
  const queries = productBreakpoints.map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", listener));
  return () => queries.forEach((query) => query.removeEventListener("change", listener));
}
function ProductShelf({ children }: { children: ReactNode[] }) {
  const [expanded, setExpanded] = useState(false);
  const columns = useSyncExternalStore(subscribeProductColumns, productColumns, () => 2);
  const id = useId(),
    visible = expanded ? children : children.slice(0, columns * 3);
  return (
    <>
      <div className="wt-valuation-products" id={id}>
        {localize(visible)}
      </div>
      {localize(
        children.length > columns * 3 && (
          <div className="wt-valuation-shelf-actions">
            <small>
              {t("显示")}
              {localize(visible.length)} / {localize(children.length)}
              {t("个")}
            </small>
            <button
              type="button"
              className="quiet-button"
              aria-expanded={expanded}
              aria-controls={id}
              onClick={() => setExpanded((value) => !value)}
            >
              {localize(expanded ? "收起" : "展开全部")}
            </button>
          </div>
        ),
      )}
    </>
  );
}
function VehicleDetailPagination({
  page,
  pages,
  onChange,
  label,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <nav className="wt-valuation-pagination" aria-label={localize(`${label}分页`)}>
      <button
        type="button"
        className="quiet-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {t("上一页")}
      </button>
      <GameSelect
        aria-label={localize(`${label}页码`)}
        value={page}
        onValueChange={(value) => onChange(Number(value))}
      >
        {localize(
          Array.from({ length: pages }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {t("第")}
              {localize(i + 1)} / {localize(pages)}
              {t("页")}
            </option>
          )),
        )}
      </GameSelect>
      <button
        type="button"
        className="quiet-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        {t("下一页")}
      </button>
    </nav>
  );
}
type VehicleFilters = { country: string; category: string; rank: string };
function matchesVehicleFilters(item: Partial<Item>, filters: VehicleFilters) {
  return (
    statsCountryMatches(item.country, filters.country) &&
    (filters.category === "all" || (item.category || "unknown") === filters.category) &&
    (filters.rank === "all" || (item.rank || "unknown") === filters.rank)
  );
}
function VehicleDetailFilters({
  items,
  filters,
  onChange,
  count,
  total,
  page,
  pages,
  onPageChange,
  label,
  unit,
  orderLabel = "研发点降序",
}: {
  items: Partial<Item>[];
  filters: VehicleFilters;
  onChange: (field: keyof VehicleFilters, value: string) => void;
  count: number;
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  label: string;
  unit: string;
  orderLabel?: string;
}) {
  return (
    <div className="wt-valuation-filters">
      <label>
        {t("国别")}
        <GameSelect value={filters.country} onValueChange={(value) => onChange("country", value)}>
          <option value="all">{t("全部国别")}</option>
          {localize(
            [...new Set(items.map((v) => statsCountryId(v.country)))].sort().map((id) => (
              <option key={id} value={id}>
                {localize(id === "unknown" ? "国别待核验" : statsCountryLabel(id))}
              </option>
            )),
          )}
        </GameSelect>
      </label>
      <label>
        {t("军种")}
        <GameSelect value={filters.category} onValueChange={(value) => onChange("category", value)}>
          <option value="all">{t("全部军种")}</option>
          {localize(
            [...new Set(items.map((v) => v.category || "unknown"))].sort().map((id) => (
              <option key={id} value={id}>
                {localize(id === "unknown" ? "军种待核验" : statsCategoryNames[id] || id)}
              </option>
            )),
          )}
        </GameSelect>
      </label>
      <label>
        {t("等级")}
        <GameSelect value={filters.rank} onValueChange={(value) => onChange("rank", value)}>
          <option value="all">{t("全部等级")}</option>
          {localize(
            valuationRules.researchRanks.map((rank) => (
              <option key={rank} value={rank}>
                Rank {localize(rank)}
              </option>
            )),
          )}
          {localize(
            items.some((v) => !v.rank) && <option value="unknown">{t("等级待核验")}</option>,
          )}
        </GameSelect>
      </label>
      <output>
        {t("筛选")}
        {localize(count)} / {localize(total)} {localize(unit)}
        {t("· 每页 10")}
        {localize(unit)} · {localize(orderLabel)}
      </output>
      <VehicleDetailPagination
        page={page}
        pages={pages}
        onChange={onPageChange}
        label={localize(label)}
      />
    </div>
  );
}
function ValueComposition({ scenario, label }: { scenario: Scenario; label: string }) {
  const parts = [
    { name: "研发点", cents: scenario.rpCents, color: "#d9b868" },
    { name: "金鹰载具", cents: scenario.geCents, color: "#78aba8" },
    { name: "礼包", cents: scenario.packCents, color: "#a28cba" },
    { name: "交易所参考", cents: scenario.marketCents, color: "#9975af" },
    ...((scenario.manualCents || 0) > 0
      ? [{ name: "自定义", cents: scenario.manualCents!, color: "#c58c62" }]
      : []),
  ];
  const total = parts.reduce((sum, p) => sum + BigInt(p.cents), 0n);
  let offset = 0;
  return (
    <aside className="wt-valuation-composition" aria-label={localize(`${label}占比`)}>
      <h3>
        {localize(label)}
        {t("占比")}
      </h3>
      <div className="wt-valuation-chart-body">
        <svg
          viewBox="0 0 100 100"
          aria-label={localize(total > 0n ? "当前估值各项已核价占比，详见图例" : "暂无已核价金额")}
        >
          <circle cx="50" cy="50" r="40" fill="none" stroke="#394247" strokeWidth="16" />
          {localize(
            parts.map((p) => {
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
                    {localize(p.name)}：{localize(valuationMoney(p.cents))}
                  </title>
                </circle>
              );
            }),
          )}
          <text x="50" y="48" textAnchor="middle">
            {t("已核价")}
          </text>
        </svg>
        <dl>
          {localize(
            parts.map((p) => (
              <div key={p.name}>
                <dt>
                  <i style={{ background: p.color }} />
                  {localize(p.name)}
                </dt>
                <dd>
                  {localize(
                    total > 0n
                      ? `${(Number((BigInt(p.cents) * 10000n) / total) / 100).toFixed(2)}%`
                      : "—",
                  )}
                  <small>{localize(valuationMoney(p.cents))}</small>
                </dd>
              </div>
            )),
          )}
        </dl>
      </div>
      <small>{t("已核价交易所参考值计入合计，原始 GJN 数量在明细中保留。")}</small>
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
  useLocale();
  const cacheScope = valuationCacheScope(session);
  const [storedValue, setValue] = useState<Valuation | null>(() =>
    cachedValuation(cacheScope, profile),
  );
  const value = useMemo(() => visibleValuation(storedValue), [storedValue]);
  const [cacheNotice, setCacheNotice] = useState(
    storedValue?.localStale ? "正在展示此前保存的估值，点击刷新估值。" : "",
  );
  const [researchPage, setResearchPage] = useState(1);
  const [purchaseFilters, setPurchaseFilters] = useState<VehicleFilters>({
    country: "all",
    category: "all",
    rank: "all",
  });
  const [goldPage, setGoldPage] = useState(1);
  const [packPage, setPackPage] = useState(1);
  const [marketPage, setMarketPage] = useState(1);
  function changePurchaseFilter(field: keyof VehicleFilters, selected: string) {
    setPurchaseFilters((old) => ({ ...old, [field]: selected }));
    setGoldPage(1);
    setPackPage(1);
    setMarketPage(1);
  }

  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [researchCountry, setResearchCountry] = useState("all");
  const [researchCategory, setResearchCategory] = useState("all");
  const [researchRank, setResearchRank] = useState("all");
  const [unpricedFilters, setUnpricedFilters] = useState<VehicleFilters>({
    country: "all",
    category: "all",
    rank: "all",
  });
  const [unpricedPage, setUnpricedPage] = useState(1);
  const [showResearch, setShowResearch] = useState(false);
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [valuationTab, setValuationTab] = useState<"overview" | "details">("overview");
  const tabId = useId();
  const [detailKind, setDetailKind] = useState("all");
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("normal");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const available = session ? statsAvailableRequests(session, "valuation") : 0;
  const remaining = !session
    ? "—"
    : available === null
      ? "不限次"
      : available === 0
        ? "今日额度已达上限"
        : `${available} 次`;
  async function openCached() {
    if (!value || checking) return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setOpen(true);
    setCacheNotice("正在校验最新估值规则，本次校验不扣次。");
    setError("");
    try {
      const current = await statsRequest<Valuation>(
        "players/" +
          encodeURIComponent(profile.snapshotId) +
          "/valuation?valuation_basis=market-cny-v2",
        undefined,
        c.signal,
      );
      if (!c.signal.aborted) {
        if (current.calculationVersion !== "market-cny-v2")
          throw Error("估值计价规则已更新，请刷新估值。旧结果不会当作新版金额展示。");
        if (current.player.uid !== profile.uid) throw Error("估值玩家身份不一致，请重新查询。");
        setValue(current);
        cacheValuation(cacheScope, { uid: profile.uid, snapshotId: current.snapshotId }, current);
        setCacheNotice(
          current.snapshotId === profile.snapshotId
            ? ""
            : "正在展示此前资料的估值，可点击重新估值更新。",
        );
      }
    } catch (failure) {
      if (!c.signal.aborted) {
        if (failure instanceof StatsError && failure.code === "CACHE_STALE") {
          setCacheNotice("估值资料或价格已更新，当前保留此前估值；点击重新估值更新。");
          return;
        }
        if (
          !(failure instanceof StatsError) ||
          !["QUERY_REQUIRED", "INVALID_TICKET", "LOGIN_EXPIRED", "VALUATION_NOT_FOUND"].includes(
            failure.code,
          )
        ) {
          setCacheNotice("暂时无法校验最新规则，当前展示已保存估值；联网后重新打开会再校验。");
          return;
        }
        forgetCachedValuation(cacheScope, { uid: profile.uid, snapshotId: value.snapshotId });
        setValue(null);
        setOpen(false);
        setCacheNotice("");
        setError(
          failure instanceof Error
            ? failure.message
            : "估值缓存暂不可用，请显式重新计算。本次校验不扣次。",
        );
      }
    } finally {
      if (!c.signal.aborted) setChecking(false);
    }
  }
  async function calculate(showDetails = true) {
    if (busy) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError("");
    try {
      const result = await statsRequest<Valuation>(
        "valuations?valuation_basis=market-cny-v2",
        { snapshotId: profile.snapshotId, requestId: "value_" + crypto.randomUUID() },
        c.signal,
      );
      if (!c.signal.aborted) {
        if (result.calculationVersion !== "market-cny-v2")
          throw Error("服务端尚未提供新版市场估值，请稍后重试。");
        setValue(result);
        if (!cacheValuation(cacheScope, profile, result))
          setCacheNotice("估值已计算，本地缓存未能保存。");
        else setCacheNotice("");
        if (showDetails) setOpen(true);
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
  const visibleExcluded =
    value?.excluded?.filter((item) => !hiddenInitialVehicles.has(item.id)) || [];
  const filteredResearch =
    value?.research
      .filter((v) =>
        matchesVehicleFilters(v, {
          country: researchCountry,
          category: researchCategory,
          rank: researchRank,
        }),
      )
      .sort((a, b) => (b.rp ?? -1) - (a.rp ?? -1) || a.name.localeCompare(b.name, "zh-CN")) || [];
  const researchPages = Math.max(1, Math.ceil(filteredResearch.length / 10));
  const currentResearchPage = Math.min(researchPage, researchPages);
  const visibleResearch = filteredResearch.slice(
    (currentResearchPage - 1) * 10,
    currentResearchPage * 10,
  );
  const purchaseVehicles: Partial<Item>[] = value
    ? [
        ...value.gold,
        ...value.market,
        ...value.packs.flatMap((p) => (p.vehicles.length ? p.vehicles : [{}])),
      ]
    : [];
  const filteredGold = sortValuationPrices(value?.gold || []).filter((v) =>
    matchesVehicleFilters(v, purchaseFilters),
  );
  const filteredPacks = sortValuationPrices(value?.packs || [])
    .sort((a, b) => Number(a.vehicles.length > 1) - Number(b.vehicles.length > 1))
    .filter((p) =>
      p.vehicles.length
        ? p.vehicles.some((v) => matchesVehicleFilters(v, purchaseFilters))
        : matchesVehicleFilters({}, purchaseFilters),
    );
  const filteredMarket = (value?.market || []).filter((v) =>
    matchesVehicleFilters(v, purchaseFilters),
  );
  const goldPages = Math.max(1, Math.ceil(filteredGold.length / 10)),
    currentGoldPage = Math.min(goldPage, goldPages);
  const packPages = Math.max(1, Math.ceil(filteredPacks.length / 10)),
    currentPackPage = Math.min(packPage, packPages);
  const marketPages = Math.max(1, Math.ceil(filteredMarket.length / 10)),
    currentMarketPage = Math.min(marketPage, marketPages);
  const visibleGold = filteredGold.slice((currentGoldPage - 1) * 10, currentGoldPage * 10);
  const visiblePacks = filteredPacks.slice((currentPackPage - 1) * 10, currentPackPage * 10);
  const visibleMarket = filteredMarket.slice((currentMarketPage - 1) * 10, currentMarketPage * 10);
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
  const unpricedVehicles = unpricedItems.flatMap<Partial<Item>>((v) =>
    v.vehicles?.length ? v.vehicles : [v],
  );
  const filteredUnpriced = unpricedItems.filter((v) =>
    (v.vehicles?.length ? v.vehicles : [v]).some((item) =>
      matchesVehicleFilters(item, unpricedFilters),
    ),
  );
  const unpricedPages = Math.max(1, Math.ceil(filteredUnpriced.length / 10));
  const currentUnpricedPage = Math.min(unpricedPage, unpricedPages);
  useVehicleCatalog(
    open && value
      ? [
          ...value.gold,
          ...value.market,
          ...value.packs.flatMap((p) => p.vehicles),
          ...visibleResearch,
          ...unpricedVehicles,
        ].map((v) => v.country || "")
      : [],
  );
  const visibleUnpriced = filteredUnpriced.slice(
    (currentUnpricedPage - 1) * 10,
    currentUnpricedPage * 10,
  );
  return (
    <div className="wt-account-valuation">
      <button
        className="wt-valuation-trigger"
        disabled={!session || busy || checking}
        aria-label={localize(
          value ? `查看已估值 ${valuationTotal(value.scenarios.normal.knownCents)}` : undefined,
        )}
        aria-busy={busy || checking}
        onClick={() => (value ? void openCached() : void calculate())}
      >
        {localize(
          value ? (
            <>
              <b>{localize(valuationTotal(value.scenarios.normal.knownCents))}</b>
              <span aria-hidden="true">›</span>
            </>
          ) : busy || checking ? (
            checking ? (
              "正在校验估值缓存…"
            ) : (
              "正在计算估值…"
            )
          ) : (
            "账号估值"
          ),
        )}
      </button>
      {localize(
        !value && (
          <small>
            {t("可用次数 ·")}
            {localize(session ? remaining : "—")}
          </small>
        ),
      )}
      {localize(
        value && (
          <small className="wt-valuation-updated">
            <span>
              {t("估值于")}
              <RelativeTime value={value.calculatedAt} />
            </span>
            <RefreshTextAction
              busy={busy}
              disabled={!session || busy || checking || !!profile.localOnly}
              refresh={() => void calculate(false)}
              highlighted={
                !!storedValue?.localStale ||
                value.snapshotId !== profile.snapshotId ||
                !!cacheNotice
              }
              title={localize(cacheNotice || "刷新估值")}
              label={t("刷新估值")}
              busyLabel={t("正在更新估值…")}
              iconOnly
            />
          </small>
        ),
      )}
      {localize(
        error && !open && (
          <small className="wt-record-error" role="alert">
            {localize(error)}
          </small>
        ),
      )}
      {localize(
        open && value && (
          <Modal
            title={localize(`${profile.nickname} · 账号估值`)}
            close={() => {
              setOpen(false);
              if (checking) {
                request.current?.abort();
                setChecking(false);
                setCacheNotice("");
              }
              setShowResearch(false);
              setResearchPage(1);
              setShowUnpriced(false);
            }}
            className="wt-valuation-dialog"
          >
            <div className="wt-valuation-coverage">
              <span className="wt-valuation-verified">
                {localize(value.ownership?.verified ? "公开车库已核验" : "按出战记录推算")}
              </span>
              <span>
                <b>{localize(value.ownership?.ownedCount ?? value.observedCount)}</b>
                {t("辆")}
                {localize(value.ownership?.verified ? "用于估值" : "出战载具")}
              </span>
              {localize(
                value.ownership?.verified && (
                  <span>
                    <b>{localize(value.ownership.unplayedCount)}</b>
                    {t("辆未出战")}
                  </span>
                ),
              )}
              <span>
                <b>{localize(value.unpriced.length)}</b>
                {t("项待核价")}
              </span>
              {localize(
                !!visibleExcluded.length && (
                  <span>
                    <b>{localize(visibleExcluded.length)}</b>
                    {t("辆不参与估值")}
                  </span>
                ),
              )}
            </div>
            <div className="wt-valuation-tabs" role="tablist" aria-label={t("账号估值视图")}>
              {localize(
                (
                  [
                    ["overview", "估值总览"],
                    ["details", "载具明细"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`${tabId}-${id}-tab`}
                    aria-selected={valuationTab === id}
                    aria-controls={`${tabId}-${id}-panel`}
                    tabIndex={valuationTab === id ? 0 : -1}
                    onClick={() => setValuationTab(id)}
                    onKeyDown={(event) => {
                      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "overview"
                          : event.key === "End"
                            ? "details"
                            : id === "overview"
                              ? "details"
                              : "overview";
                      setValuationTab(next);
                      document.getElementById(`${tabId}-${next}-tab`)?.focus();
                    }}
                  >
                    {localize(label)}
                  </button>
                )),
              )}
            </div>
            {localize(
              valuationTab === "overview" && (
                <div
                  role="tabpanel"
                  id={`${tabId}-overview-panel`}
                  aria-labelledby={`${tabId}-overview-tab`}
                >
                  <section className="wt-valuation-dashboard" aria-label={t("价值概览")}>
                    <fieldset className="wt-valuation-scenarios" aria-label={t("选择价值类型")}>
                      {localize(
                        scenarioKeys.map((key) => (
                          <button
                            type="button"
                            key={key}
                            aria-pressed={scenarioKey === key}
                            onClick={() => setScenarioKey(key)}
                          >
                            <span>{localize(valuationRules.scenarios[key].label)}</span>
                            <strong>
                              {localize(valuationTotal(value.scenarios[key].knownCents))}
                            </strong>
                          </button>
                        )),
                      )}
                    </fieldset>
                    {localize(
                      selectedScenario && selectedRule && (
                        <div className="wt-valuation-summary">
                          <div
                            className="wt-valuation-current"
                            aria-live="polite"
                            aria-atomic="true"
                          >
                            <span className="wt-valuation-eyebrow">
                              {localize(valuationRules.scenarios[scenarioKey].label)}
                            </span>
                            <strong className="wt-valuation-amount">
                              {localize(valuationTotal(selectedScenario.knownCents))}
                            </strong>
                            <output className="wt-valuation-price-status">
                              {localize(
                                selectedScenario.totalCents == null
                                  ? "已核价金额，未计价项目另列"
                                  : "已核价合计",
                              )}
                            </output>
                            <dl className="wt-valuation-rate-note">
                              <div>
                                <dt>{t("陆战 / 直升机")}</dt>
                                <dd>
                                  {localize(valuationUnitPrice(selectedRule.rpCents.ground))}
                                  {t("/ 万 RP")}
                                </dd>
                              </div>
                              <div>
                                <dt>{t("飞机")}</dt>
                                <dd>
                                  {localize(valuationUnitPrice(selectedRule.rpCents.aviation))}
                                  {t("/ 万 RP")}
                                </dd>
                              </div>
                              <div>
                                <dt>{t("金鹰 / 礼包")}</dt>
                                <dd>
                                  {localize(
                                    selectedRule.purchasePercent === 100
                                      ? "按原价"
                                      : `按原价 ${selectedRule.purchasePercent / 10} 折`,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>{t("交易所")}</dt>
                                <dd>
                                  {localize(
                                    (value.rules.marketPurchasePercent?.[scenarioKey] ??
                                      selectedRule.purchasePercent) === 100
                                      ? "按参考价"
                                      : `按参考价 ${(value.rules.marketPurchasePercent?.[scenarioKey] ?? selectedRule.purchasePercent) / 10} 折`,
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>
                          <ValueComposition
                            scenario={selectedScenario}
                            label={localize(valuationRules.scenarios[scenarioKey].label)}
                          />
                        </div>
                      ),
                    )}
                  </section>
                  <details className="wt-valuation-basis">
                    <summary>
                      {t("估值依据与计算规则")}
                      {localize(" ")}
                      <span>
                        {localize(
                          value.ownership?.fetchedAt ? (
                            <>
                              {t("车库核验")}
                              <RelativeTime value={value.ownership.fetchedAt} />
                            </>
                          ) : (
                            "出战记录与当前前置推算"
                          ),
                        )}
                      </span>
                    </summary>
                    <p>
                      {localize(
                        value.ownership?.verified
                          ? "依据官方公开车库中的已拥有载具计算，包含未出战载具。研发点按已拥有载具去重汇总，不额外推算未持有的前置。"
                          : "根据出战记录与当前研发前置推算，尚未核验完整已拥有清单。",
                      )}
                      {localize(" ")}
                      {t("同一载具、同一礼包只计算一次。")}
                      {localize(value.ownership?.notice)}
                    </p>
                    <p>
                      {t(
                        "各价值口径的研发点单价与购入价比例见总览，按当前已保存规则计算。正常价值、折扣价值与参考价值分别展示，不代表实际成交价。",
                      )}
                    </p>
                  </details>
                  <div className="wt-valuation-overview-counts">
                    <div>
                      <span>{t("估值载具")}</span>
                      <strong>
                        {localize(statsNumber(value.ownership?.ownedCount ?? value.observedCount))}
                      </strong>
                    </div>
                    <div>
                      <span>{t("金鹰与礼包")}</span>
                      <strong>{localize(value.gold.length + value.packs.length)}</strong>
                    </div>
                    <div>
                      <span>{t("特殊市场载具")}</span>
                      <strong>{localize(value.market.length)}</strong>
                    </div>
                    <div>
                      <span>{t("待核价项目")}</span>
                      <strong>{localize(value.unpriced.length + value.marketUnpricedCount)}</strong>
                    </div>
                  </div>
                  <p className="wt-valuation-overview-note">
                    {t(
                      "交易所的已核价参考值已参与合计，GJN 数量另列。已核实的低门槛赠送载具参考价值为 0；未核验价格保留为待核价。",
                    )}
                  </p>
                  <button
                    className="wt-valuation-view-details"
                    onClick={() => setValuationTab("details")}
                  >
                    {t("查看载具明细")}
                  </button>
                </div>
              ),
            )}
            {localize(
              valuationTab === "details" && (
                <div
                  role="tabpanel"
                  id={`${tabId}-details-panel`}
                  aria-labelledby={`${tabId}-details-tab`}
                >
                  <div className="wt-valuation-detail-toolbar">
                    <label>
                      <span className="wt-valuation-detail-label">{t("明细类别")}</span>
                      <GameSelect value={detailKind} onValueChange={setDetailKind}>
                        <option value="all">{t("全部类别")}</option>
                        <option value="gold">{t("金鹰载具")}</option>
                        <option value="pack">{t("礼包载具")}</option>
                        <option value="market">{t("市场载具")}</option>
                        <option value="manual">{t("特殊与赠送载具")}</option>
                        <option value="excluded">{t("不计入估值")}</option>
                        <option value="research">{t("研发点明细")}</option>
                        <option value="unpriced">{t("待核价")}</option>
                      </GameSelect>
                    </label>
                  </div>
                  {localize(
                    (detailKind === "all" || detailKind === "gold") && (
                      <section className="wt-valuation-section">
                        <h3>
                          {t("金鹰载具 ·")}
                          {localize(value.gold.length)}
                        </h3>
                        <VehicleDetailFilters
                          items={purchaseVehicles}
                          filters={purchaseFilters}
                          onChange={changePurchaseFilter}
                          count={filteredGold.length}
                          total={value.gold.length}
                          page={currentGoldPage}
                          pages={goldPages}
                          onPageChange={setGoldPage}
                          label={t("金鹰明细")}
                          unit={t("辆")}
                          orderLabel={t("价格降序")}
                        />
                        {localize(
                          filteredGold.length ? (
                            <ProductShelf>
                              {localize(
                                visibleGold.map((v) => (
                                  <ProductCard
                                    key={v.id}
                                    owned={!!value.ownership?.verified}
                                    vehicleKind="gold"
                                    title={localize(v.name)}
                                    source={v.source}
                                    items={[v]}
                                    kind={localize(
                                      `${statsCategoryNames[v.category] || v.category} · 金鹰载具`,
                                    )}
                                    price={localize(valuationMoney(v.amountCents))}
                                  >
                                    {localize(
                                      v.checkedAt && (
                                        <small>
                                          {t("核验")}
                                          <RelativeTime value={v.checkedAt} />
                                        </small>
                                      ),
                                    )}
                                  </ProductCard>
                                )),
                              )}
                            </ProductShelf>
                          ) : (
                            <p>{t("没有符合筛选条件的金鹰载具。")}</p>
                          ),
                        )}
                      </section>
                    ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "pack") && (
                      <section className="wt-valuation-section">
                        <h3>
                          {t("礼包载具 ·")}
                          {localize(value.packs.length)}
                          {t("个礼包")}
                        </h3>
                        <VehicleDetailFilters
                          items={purchaseVehicles}
                          filters={purchaseFilters}
                          onChange={changePurchaseFilter}
                          count={filteredPacks.length}
                          total={value.packs.length}
                          page={currentPackPage}
                          pages={packPages}
                          onPageChange={setPackPage}
                          label={t("礼包明细")}
                          unit={t("个礼包")}
                          orderLabel={t("单车礼包优先 · 价格降序")}
                        />
                        {localize(
                          filteredPacks.length ? (
                            <ProductShelf>
                              {localize(
                                visiblePacks.map((p) => (
                                  <ProductCard
                                    key={p.productId}
                                    owned={!!value.ownership?.verified}
                                    vehicleKind="pack"
                                    title={localize(p.title)}
                                    source={p.source}
                                    items={p.vehicles}
                                    kind={localize(
                                      `${p.source.startsWith("https://warthunder.com/") ? "历史礼包参考" : "整包原价"} · 已识别 ${p.vehicles.length} 辆`,
                                    )}
                                    price={localize(valuationMoney(p.amountCents))}
                                  >
                                    <small>
                                      {localize(
                                        p.checkedAt ? (
                                          <>
                                            {t("核验")}
                                            <RelativeTime value={p.checkedAt} />
                                          </>
                                        ) : (
                                          "尚无有效报价"
                                        ),
                                      )}
                                    </small>
                                  </ProductCard>
                                )),
                              )}
                            </ProductShelf>
                          ) : (
                            <p>{t("没有符合筛选条件的礼包；筛选不拆分整包金额或内容。")}</p>
                          ),
                        )}
                      </section>
                    ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "market") && (
                      <section className="wt-valuation-section">
                        <div className="wt-valuation-section-heading">
                          <h3>
                            {t("市场特殊载具 ·")}
                            {localize(value.market.length)}
                          </h3>
                          <span>{t("参考值已计入合计 · GJN 数量保留")}</span>
                        </div>
                        <p>
                          {t(
                            "按本次计算保存的市场参考值参与估值。历史成交均价不作为当前挂售价；点击详情可查看最新市场订单。",
                          )}
                        </p>
                        <VehicleDetailFilters
                          items={purchaseVehicles}
                          filters={purchaseFilters}
                          onChange={changePurchaseFilter}
                          count={filteredMarket.length}
                          total={value.market.length}
                          page={currentMarketPage}
                          pages={marketPages}
                          onPageChange={setMarketPage}
                          label={t("市场明细")}
                          unit={t("辆")}
                          orderLabel={t("原顺序")}
                        />
                        {localize(
                          filteredMarket.length ? (
                            <ProductShelf>
                              {localize(
                                visibleMarket.map((v) => (
                                  <ProductCard
                                    key={v.id}
                                    owned={!!value.ownership?.verified}
                                    vehicleKind="market"
                                    title={localize(v.name)}
                                    source={v.source}
                                    items={[v]}
                                    kind={localize(
                                      marketQuoteBasis(v.method) || "官方市场 · 出售报价待核验",
                                    )}
                                    price={localize(
                                      marketQuoteBasis(v.method) && v.averageGjnCents != null
                                        ? `${valuationMoney(v.averageGjnCents, "")} GJN`
                                        : "暂无已核实挂售价",
                                    )}
                                  >
                                    {localize(
                                      marketQuoteBasis(v.method) && v.checkedAt && (
                                        <small>
                                          {t("报价核验")}
                                          <RelativeTime value={v.checkedAt} />
                                        </small>
                                      ),
                                    )}
                                    <a
                                      className="wt-valuation-market-link"
                                      href={v.source}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {t("查看市场详情 ↗")}
                                    </a>
                                    <small>
                                      {t(
                                        "报价对应可交易载具券，已激活载具不等同于可出售的载具券。",
                                      )}
                                    </small>
                                  </ProductCard>
                                )),
                              )}
                            </ProductShelf>
                          ) : (
                            <p>{t("没有符合筛选条件的市场载具。")}</p>
                          ),
                        )}
                      </section>
                    ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "manual") && !!value.manual?.length && (
                      <section className="wt-valuation-section">
                        <h3>
                          {t("特殊与赠送载具 ·")}
                          {localize(value.manual.length)}
                          {t("辆")}
                        </h3>
                        <p>
                          {t(
                            "按已核验的获取门槛与定价规则展示；明确低门槛赠送载具的参考价值为 0，不附加稀有溢价。",
                          )}
                        </p>
                        <ProductShelf>
                          {localize(
                            value.manual.map((item) => (
                              <ProductCard
                                key={item.id}
                                owned={!!value.ownership?.verified}
                                title={localize(item.name)}
                                source={
                                  item.source ||
                                  "https://wiki.warthunder.com/unit/" + encodeURIComponent(item.id)
                                }
                                items={[item]}
                                kind={localize(
                                  `${valuationRules.scenarios[scenarioKey].label} · 自定义`,
                                )}
                                price={localize(valuationMoney(item.prices[scenarioKey]))}
                              >
                                <span>
                                  {localize(
                                    Object.values(item.prices).every((price) => price === 0)
                                      ? "低门槛赠送载具，参考价值为 0。"
                                      : item.reason,
                                  )}
                                </span>
                              </ProductCard>
                            )),
                          )}
                        </ProductShelf>
                      </section>
                    ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "excluded") &&
                      !!visibleExcluded.length && (
                        <details className="wt-valuation-section">
                          <summary>
                            {t("不参与估值的隐藏／特殊载具 ·")}
                            {localize(visibleExcluded.length)}
                          </summary>
                          <p>
                            {t("以下载具按已保存规则排除，不计入研发点、金鹰、礼包或其他价值。")}
                          </p>
                          <div className="wt-valuation-research">
                            {localize(
                              visibleExcluded.map((item) => (
                                <article key={item.id}>
                                  <ValuationVehicle item={item} />
                                  <div>
                                    <span className="wt-valuation-unpriced-reason">
                                      {localize(item.reason)}
                                    </span>
                                  </div>
                                </article>
                              )),
                            )}
                          </div>
                        </details>
                      ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "research") && (
                      <details
                        className="wt-valuation-section"
                        onToggle={(event) => setShowResearch(event.currentTarget.open)}
                      >
                        <summary>
                          {t("研发点明细 ·")}
                          {localize(value.researchCount)}
                          {t("辆（")}
                          {localize(value.ownership?.verified ? "已拥有" : "含推算前置")}）
                        </summary>
                        <p>
                          {localize(
                            Object.entries(value.rpByCategory)
                              .map(
                                ([cat, rp]) =>
                                  `${statsCategoryNames[cat] || cat} ${statsNumber(rp)} RP`,
                              )
                              .join(" · ") || "暂无已核实研发点",
                          )}
                        </p>
                        {localize(
                          showResearch && (
                            <VehicleDetailFilters
                              items={value.research}
                              filters={{
                                country: researchCountry,
                                category: researchCategory,
                                rank: researchRank,
                              }}
                              onChange={(field, selected) => {
                                ({
                                  country: setResearchCountry,
                                  category: setResearchCategory,
                                  rank: setResearchRank,
                                })[field](selected);
                                setResearchPage(1);
                              }}
                              count={filteredResearch.length}
                              total={value.researchCount}
                              page={currentResearchPage}
                              pages={researchPages}
                              onPageChange={setResearchPage}
                              label={t("研发点明细")}
                              unit={t("辆")}
                            />
                          ),
                        )}
                        {localize(
                          showResearch && !filteredResearch.length && (
                            <output>{t("没有符合筛选条件的载具。")}</output>
                          ),
                        )}
                        {localize(
                          showResearch && (
                            <div className="wt-valuation-research">
                              {localize(
                                visibleResearch.map((v) => (
                                  <article key={v.id}>
                                    <ValuationVehicle
                                      item={v}
                                      showCountry={researchCountry === "all"}
                                      showRank={researchRank === "all"}
                                    />
                                    <div>
                                      <small>
                                        {localize(
                                          v.owned
                                            ? v.observed
                                              ? "已拥有 · 有出战记录"
                                              : "已拥有 · 未出战"
                                            : v.observed
                                              ? "有出战记录"
                                              : "根据当前前置推算",
                                        )}
                                      </small>
                                      <strong>{localize(statsNumber(v.rp))} RP</strong>
                                      <small>
                                        {localize(
                                          v.rpCheckedAt ? (
                                            <>
                                              {t("核验")}
                                              <RelativeTime value={v.rpCheckedAt} />
                                            </>
                                          ) : (
                                            "研发点待核验"
                                          ),
                                        )}
                                      </small>
                                    </div>
                                  </article>
                                )),
                              )}
                            </div>
                          ),
                        )}
                      </details>
                    ),
                  )}
                  {localize(
                    (detailKind === "all" || detailKind === "unpriced") &&
                      !!value.unpriced.length && (
                        <details
                          className="wt-valuation-section"
                          onToggle={(event) => setShowUnpriced(event.currentTarget.open)}
                        >
                          <summary>
                            {t("未计价项目 ·")}
                            {localize(value.unpriced.length)}
                          </summary>
                          <p>{t("以下项目资料或价格尚未核实，未按零计入估值。")}</p>
                          {localize(
                            showUnpriced && (
                              <VehicleDetailFilters
                                items={unpricedVehicles}
                                filters={unpricedFilters}
                                onChange={(field, selected) => {
                                  setUnpricedFilters((previous) => ({
                                    ...previous,
                                    [field]: selected,
                                  }));
                                  setUnpricedPage(1);
                                }}
                                count={filteredUnpriced.length}
                                total={value.unpriced.length}
                                page={currentUnpricedPage}
                                pages={unpricedPages}
                                onPageChange={setUnpricedPage}
                                label={t("未计价项目")}
                                unit={t("项")}
                              />
                            ),
                          )}
                          {localize(
                            showUnpriced && !filteredUnpriced.length && (
                              <output>{t("没有符合筛选条件的项目。")}</output>
                            ),
                          )}
                          {localize(
                            showUnpriced && (
                              <div className="wt-valuation-research wt-valuation-unpriced">
                                {localize(
                                  visibleUnpriced.map((v, i) => {
                                    const vehicles = v.vehicles?.length ? v.vehicles : [v];
                                    return (
                                      <article
                                        key={v.id + i}
                                        className={
                                          vehicles.length > 1
                                            ? "wt-valuation-research-group"
                                            : undefined
                                        }
                                      >
                                        <div className="wt-valuation-unpriced-art">
                                          {localize(
                                            vehicles.map((item) => (
                                              <ValuationVehicle
                                                showCountry={unpricedFilters.country === "all"}
                                                showRank={unpricedFilters.rank === "all"}
                                                key={item.id}
                                                item={{
                                                  id: item.id,
                                                  name: item.name,
                                                  country: item.country || "",
                                                  category: item.category || "",
                                                }}
                                              />
                                            )),
                                          )}
                                        </div>
                                        <div>
                                          {localize(
                                            vehicles.length > 1 && (
                                              <h4>
                                                {localize(
                                                  v.rpSource ? (
                                                    <a
                                                      href={v.rpSource}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      {localize(v.name)}
                                                    </a>
                                                  ) : (
                                                    v.name
                                                  ),
                                                )}
                                              </h4>
                                            ),
                                          )}
                                          {localize(
                                            v.owned && (
                                              <small>
                                                {localize(
                                                  v.observed
                                                    ? "已拥有 · 有出战记录"
                                                    : "已拥有 · 未出战",
                                                )}
                                              </small>
                                            ),
                                          )}
                                          {localize(
                                            v.rp != null && (
                                              <strong>{localize(statsNumber(v.rp))} RP</strong>
                                            ),
                                          )}
                                          <span className="wt-valuation-unpriced-reason">
                                            {localize(v.reason)}
                                          </span>
                                          {localize(
                                            v.rpCheckedAt && (
                                              <small>
                                                {t("研发点核验")}
                                                <RelativeTime value={v.rpCheckedAt} />
                                              </small>
                                            ),
                                          )}
                                        </div>
                                      </article>
                                    );
                                  }),
                                )}
                              </div>
                            ),
                          )}
                        </details>
                      ),
                  )}
                </div>
              ),
            )}
            <footer className="wt-valuation-section">
              {localize(
                error && (
                  <p className="wt-record-error" role="alert">
                    {localize(error)}
                  </p>
                ),
              )}
              <button
                type="button"
                className="wt-record-link"
                disabled={!session || busy || checking || profile.localOnly}
                title={localize(cacheNotice || "重新估值使用估值额度，失败时保留此前估值")}
                onClick={() => void calculate()}
              >
                {localize(busy ? "正在重新估值…" : "重新估值")}
              </button>
              <p>{t("结果仅供参考，不代表实际投入或成交价格。未知价格不按零处理。")}</p>
              <small>
                {t("资料采集")}
                <RelativeTime value={value.fetchedAt} />
                {t("· 估值计算")}
                {localize(" ")}
                <RelativeTime value={value.calculatedAt} />
                {localize(
                  value.localCached
                    ? " · 浏览器估值缓存，本次不扣次"
                    : value.cached && " · 已命中估值缓存，本次不扣次",
                )}
              </small>
            </footer>
          </Modal>
        ),
      )}
    </div>
  );
}
