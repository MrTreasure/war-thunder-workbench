import { visibleValuation } from "./valuation-visibility";
import { statsAvailableRequests } from "./player-stats-api";
import { t, getLocale, localize, vehicleName, decimalSeparator } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useVehicleCatalog } from "./vehicle-catalog";
import { VehicleTile } from "./VehicleTile";
import type { VehicleTileUnit } from "./VehicleTile";
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
import {
  StatsError,
  statsRequest,
  statsDate,
  statsNumber,
  statsCategoryNames,
} from "./player-stats-api";
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
const scenarioLabel = (key: ScenarioKey) =>
  key === "secondHand" ? t("参考价值") : t(valuationRules.scenarios[key].label);
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
  knownCents: number;
  totalCents: number | null;
};
export type Valuation = {
  id: string;
  snapshotId: string;
  player: { uid: string; nickname: string };
  fetchedAt: string;
  calculatedAt: string;
  cached: boolean;
  localCached?: boolean;
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
  useLocale();
  if (cents == null || !Number.isSafeInteger(cents)) return t("待核价");
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return `${symbol}${value < 0n ? "-" : ""}${(absolute / 100n).toLocaleString(getLocale())}${decimalSeparator()}${String(absolute % 100n).padStart(2, "0")}`;
}
function valuationTotal(cents: number | null) {
  if (cents == null || !Number.isSafeInteger(cents)) return t("待核价");
  const value = BigInt(cents);
  const rounded = value < 0n ? -((-value + 50n) / 100n) : (value + 50n) / 100n;
  return `¥${rounded.toLocaleString(getLocale())}`;
}
function valuationUnitPrice(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) return t("待核价");
  const value = BigInt(cents);
  const fraction = String(value % 100n)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `¥${(value / 100n).toLocaleString(getLocale())}${fraction ? decimalSeparator() + fraction : ""}`;
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
      countryLabel={showCountry ? localize(statsCountryLabel(item.country)) : undefined}
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
              countryLabel={localize(statsCountryLabel(item.country))}
            />
          )),
        )}
      </div>
      <div className="wt-valuation-product-body">
        <small className="wt-valuation-product-kind">
          {vehicleKind === "pack" ? (
            <a href={source} target="_blank" rel="noreferrer">
              {localize(kind)} ↗
            </a>
          ) : (
            localize(kind)
          )}
        </small>
        {vehicleKind === "pack" && items.length > 1 && (
          <h4>
            <a href={source} target="_blank" rel="noreferrer">
              {t(title)} <span aria-hidden="true">↗</span>
            </a>
          </h4>
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
              {localize(expanded ? t("收起") : t("展开全部"))}
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
    <nav className="wt-valuation-pagination" aria-label={t("{0}分页", [localize(label)])}>
      <button
        type="button"
        className="quiet-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {t("上一页")}
      </button>
      <GameSelect
        aria-label={t("{0}页码", [localize(label)])}
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
                {localize(id === "unknown" ? t("国别待核验") : statsCountryLabel(id))}
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
                {localize(id === "unknown" ? t("军种待核验") : statsCategoryNames[id] || id)}
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
        {localize(unit)}
        {t("· 研发点降序")}
      </output>
      <VehicleDetailPagination page={page} pages={pages} onChange={onPageChange} label={label} />
    </div>
  );
}
function ValueComposition({ scenario, label }: { scenario: Scenario; label: string }) {
  const parts = [
    { name: t("研发点"), cents: scenario.rpCents, color: "#d9b868" },
    { name: t("金鹰载具"), cents: scenario.geCents, color: "#78aba8" },
    { name: t("礼包"), cents: scenario.packCents, color: "#a28cba" },
    ...((scenario.manualCents || 0) > 0
      ? [{ name: t("自定义"), cents: scenario.manualCents!, color: "#c58c62" }]
      : []),
  ];
  const total = parts.reduce((sum, p) => sum + BigInt(p.cents), 0n);
  let offset = 0;
  return (
    <aside className="wt-valuation-composition" aria-label={t("{0}占比", [localize(label)])}>
      <h3>
        {localize(label)}
        {t("占比")}
      </h3>
      <div className="wt-valuation-chart-body">
        <svg
          viewBox="0 0 100 100"
          aria-label={total > 0n ? t("当前估值各项已核价占比，详见图例") : t("暂无已核价金额")}
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
          <text x="50" y="62" textAnchor="middle">
            CNY
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
      <small>{t("仅统计已核价人民币金额；特殊载具 GJN 单列。")}</small>
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
  const [cacheNotice, setCacheNotice] = useState("");
  const [researchPage, setResearchPage] = useState(1);
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
      ? t("不限次")
      : available === 0
        ? t("今日额度已达上限")
        : t("{0} 次", [available]);
  async function openCached() {
    if (!value || checking) return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setOpen(true);
    setCacheNotice(t("正在校验最新估值规则，本次校验不扣次。"));
    setError("");
    try {
      const current = await statsRequest<Valuation>(
        "valuations/" + encodeURIComponent(value.id),
        undefined,
        c.signal,
      );
      if (!c.signal.aborted) {
        setValue(current);
        cacheValuation(cacheScope, profile, current);
        setCacheNotice("");
      }
    } catch (failure) {
      if (!c.signal.aborted) {
        if (
          !(failure instanceof StatsError) ||
          ![
            "CACHE_STALE",
            "QUERY_REQUIRED",
            "INVALID_TICKET",
            "LOGIN_EXPIRED",
            "VALUATION_NOT_FOUND",
          ].includes(failure.code)
        ) {
          setCacheNotice(t("暂时无法校验最新规则，当前展示已保存估值；联网后重新打开会再校验。"));
          return;
        }
        forgetCachedValuation(cacheScope, profile);
        setValue(null);
        setOpen(false);
        setCacheNotice("");
        setError(
          failure instanceof Error
            ? failure.message
            : t("估值缓存暂不可用，请显式重新计算。本次校验不扣次。"),
        );
      }
    } finally {
      if (!c.signal.aborted) setChecking(false);
    }
  }
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
        if (!cacheValuation(cacheScope, profile, result))
          setCacheNotice(t("估值已计算，本地缓存未能保存。"));
        else setCacheNotice("");
        setOpen(true);
      }
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : t("估值计算失败，请重试。"));
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
      .sort((a, b) => (b.rp ?? -1) - (a.rp ?? -1) || a.name.localeCompare(b.name, getLocale())) ||
    [];
  const researchPages = Math.max(1, Math.ceil(filteredResearch.length / 10));
  const currentResearchPage = Math.min(researchPage, researchPages);
  const visibleResearch = filteredResearch.slice(
    (currentResearchPage - 1) * 10,
    currentResearchPage * 10,
  );
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
        onClick={() => (value ? void openCached() : void calculate())}
      >
        {localize(
          busy || checking ? (
            checking ? (
              t("正在校验估值缓存…")
            ) : (
              t("正在计算估值…")
            )
          ) : value ? (
            <>
              {t("账号估值")}
              <b>{localize(valuationTotal(value.scenarios.normal.knownCents))}</b>
              <span aria-hidden="true">›</span>
            </>
          ) : (
            t("账号估值")
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
      {localize(cacheNotice && <small>{localize(cacheNotice)}</small>)}
      {localize(
        error && (
          <small className="wt-record-error" role="alert">
            {localize(error)}
          </small>
        ),
      )}
      {localize(
        open && value && (
          <Modal
            title={t("{0} · 账号估值", [localize(profile.nickname)])}
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
                {localize(value.ownership?.verified ? t("公开车库已核验") : t("按出战记录推算"))}
              </span>
              <span>
                <b>{localize(value.ownership?.ownedCount ?? value.observedCount)}</b>
                {t("辆")}
                {localize(value.ownership?.verified ? t("用于估值") : t("出战载具"))}
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
              {(
                [
                  ["overview", t("估值总览")],
                  ["details", t("载具明细")],
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
                  {label}
                </button>
              ))}
            </div>
            {valuationTab === "overview" && (
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
                          <span>{localize(scenarioLabel(key))}</span>
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
                        <div className="wt-valuation-current" aria-live="polite" aria-atomic="true">
                          <span className="wt-valuation-eyebrow">
                            {localize(scenarioLabel(scenarioKey))} · CNY
                          </span>
                          <strong className="wt-valuation-amount">
                            {localize(valuationTotal(selectedScenario.knownCents))}
                          </strong>
                          <output className="wt-valuation-price-status">
                            {localize(
                              selectedScenario.totalCents == null
                                ? t("已核价金额，未计价项目另列")
                                : t("已核价合计"),
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
                                    ? t("按原价")
                                    : t("按原价 {0} 折", [
                                        localize(selectedRule.purchasePercent / 10),
                                      ]),
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <ValueComposition
                          scenario={selectedScenario}
                          label={scenarioLabel(scenarioKey)}
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
                        value.ownership?.fetchedAt
                          ? t("车库核验 {0}", [localize(statsDate(value.ownership.fetchedAt))])
                          : t("出战记录与当前前置推算"),
                      )}
                    </span>
                  </summary>
                  <p>
                    {localize(
                      value.ownership?.verified
                        ? t(
                            "依据官方公开车库中的已拥有载具计算，包含未出战载具。研发点按已拥有载具去重汇总，不额外推算未持有的前置。",
                          )
                        : t("根据出战记录与当前研发前置推算，尚未核验完整已拥有清单。"),
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
                  <p>
                    {t("金鹰按 ¥189／5000 GE 换算，共")}
                    {localize(statsNumber(value.geTotal))}
                    {localize(" ")}
                    {t(
                      "GE。礼包采用已核验人民币整包原价，保留查价日期；特殊载具优先单列，不重复计入金鹰或礼包。金额按各分项汇总后四舍五入到分。",
                    )}
                  </p>
                </details>
                <div className="wt-valuation-overview-counts">
                  <div>
                    <span>{t("估值载具")}</span>
                    <strong>
                      {statsNumber(value.ownership?.ownedCount ?? value.observedCount)}
                    </strong>
                  </div>
                  <div>
                    <span>{t("金鹰与礼包")}</span>
                    <strong>{value.gold.length + value.packs.length}</strong>
                  </div>
                  <div>
                    <span>{t("特殊市场载具")}</span>
                    <strong>{value.market.length}</strong>
                  </div>
                  <div>
                    <span>{t("待核价项目")}</span>
                    <strong>{value.unpriced.length}</strong>
                  </div>
                </div>
                <p className="wt-valuation-overview-note">
                  {t(
                    "人民币参考金额与 GJN 市场报价分别展示。已核实的低门槛赠送载具参考价值为 0；未核验的市场价格不参与合计。",
                  )}{" "}
                </p>
                <button
                  className="wt-valuation-view-details"
                  onClick={() => setValuationTab("details")}
                >
                  {t("查看载具明细")}
                </button>
              </div>
            )}
            {valuationTab === "details" && (
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
                {(detailKind === "all" || detailKind === "gold") && (
                  <section className="wt-valuation-section">
                    <h3>
                      {t("金鹰载具 ·")}
                      {localize(value.gold.length)}
                    </h3>
                    {localize(
                      value.gold.length ? (
                        <ProductShelf>
                          {localize(
                            sortValuationPrices(value.gold).map((v) => (
                              <ProductCard
                                key={v.id}
                                owned={!!value.ownership?.verified}
                                vehicleKind="gold"
                                title={vehicleName(v)}
                                source={v.source}
                                items={[v]}
                                kind={t("{0} · 金鹰载具", [
                                  localize(statsCategoryNames[v.category] || v.category),
                                ])}
                                price={valuationMoney(v.amountCents)}
                              >
                                {localize(
                                  v.checkedAt && (
                                    <small>
                                      {t("核验")}
                                      {localize(statsDate(v.checkedAt))}
                                    </small>
                                  ),
                                )}
                              </ProductCard>
                            )),
                          )}
                        </ProductShelf>
                      ) : (
                        <p>{t("出战记录中未识别到金鹰载具。")}</p>
                      ),
                    )}
                  </section>
                )}
                {(detailKind === "all" || detailKind === "pack") && (
                  <section className="wt-valuation-section">
                    <h3>
                      {t("礼包载具 ·")}
                      {localize(value.packs.length)}
                      {t("个礼包")}
                    </h3>
                    {localize(
                      value.packs.length ? (
                        <ProductShelf>
                          {localize(
                            sortValuationPrices(value.packs)
                              .sort(
                                (a, b) =>
                                  Number(a.vehicles.length > 1) - Number(b.vehicles.length > 1),
                              )
                              .map((p) => (
                                <ProductCard
                                  key={p.productId}
                                  owned={!!value.ownership?.verified}
                                  vehicleKind="pack"
                                  title={p.title}
                                  source={p.source}
                                  items={p.vehicles}
                                  kind={t("整包原价 · 已识别 {0} 辆", [
                                    localize(p.vehicles.length),
                                  ])}
                                  price={valuationMoney(p.amountCents)}
                                >
                                  <small>
                                    {localize(
                                      p.checkedAt
                                        ? t("核验 {0}", [localize(statsDate(p.checkedAt))])
                                        : t("尚无有效报价"),
                                    )}
                                  </small>
                                </ProductCard>
                              )),
                          )}
                        </ProductShelf>
                      ) : (
                        <p>{t("出战记录中未识别到礼包载具。")}</p>
                      ),
                    )}
                  </section>
                )}
                {(detailKind === "all" || detailKind === "market") && (
                  <section className="wt-valuation-section">
                    <div className="wt-valuation-section-heading">
                      <h3>
                        {t("市场特殊载具")} · {value.market.length}
                      </h3>
                      <span>{t("GJN 报价单列")}</span>
                    </div>
                    <p>
                      {t(
                        "点击详情到官方市场查看当前买卖报价，沿用浏览器已有的市场登录状态。本站不自动查询或轮询，市场报价不计入人民币参考金额。",
                      )}
                    </p>
                    {value.market.length ? (
                      <ProductShelf>
                        {value.market.map((v) => (
                          <ProductCard
                            key={v.id}
                            owned={!!value.ownership?.verified}
                            vehicleKind="market"
                            title={vehicleName(v)}
                            source={v.source}
                            items={[v]}
                            kind={t("Gaijin 官方市场")}
                            price={t("查看官方市场报价")}
                          >
                            <a
                              className="wt-valuation-market-link"
                              href={v.source}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t("查看市场详情 ↗")}
                            </a>
                            <small>
                              {t("报价对应可交易载具券，已激活载具不等同于可出售的载具券。")}
                            </small>
                          </ProductCard>
                        ))}
                      </ProductShelf>
                    ) : (
                      <p>{t("未识别到市场特殊载具。")}</p>
                    )}
                  </section>
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
                              title={vehicleName(item)}
                              source={
                                item.source ||
                                "https://wiki.warthunder.com/unit/" + encodeURIComponent(item.id)
                              }
                              items={[item]}
                              kind={t("{0} · 自定义", [localize(scenarioLabel(scenarioKey))])}
                              price={valuationMoney(item.prices[scenarioKey])}
                            >
                              <span>
                                {Object.values(item.prices).every((price) => price === 0)
                                  ? t("低门槛赠送载具，参考价值为 0。")
                                  : localize(item.reason)}
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
                        <p>{t("以下载具按已保存规则排除，不计入研发点、金鹰、礼包或其他价值。")}</p>
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
                {(detailKind === "all" || detailKind === "research") && (
                  <details
                    className="wt-valuation-section"
                    onToggle={(event) => setShowResearch(event.currentTarget.open)}
                  >
                    <summary>
                      {t("研发点明细 ·")}
                      {localize(value.researchCount)}
                      {t("辆（")}
                      {localize(value.ownership?.verified ? t("已拥有") : t("含推算前置"))}）
                    </summary>
                    <p>
                      {localize(
                        Object.entries(value.rpByCategory)
                          .map(
                            ([cat, rp]) =>
                              `${statsCategoryNames[cat] || cat} ${statsNumber(rp)} RP`,
                          )
                          .join(" · ") || t("暂无已核实研发点"),
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
                                          ? t("已拥有 · 有出战记录")
                                          : t("已拥有 · 未出战")
                                        : v.observed
                                          ? t("有出战记录")
                                          : t("根据当前前置推算"),
                                    )}
                                  </small>
                                  <strong>{localize(statsNumber(v.rp))} RP</strong>
                                  <small>
                                    {localize(
                                      v.rpCheckedAt
                                        ? t("核验 {0}", [localize(statsDate(v.rpCheckedAt))])
                                        : t("研发点待核验"),
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
                        <p>{t("以下项目资料或价格尚未核实，未按零元计入估值。")}</p>
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
                                        {vehicles.length > 1 && (
                                          <h4>
                                            {localize(
                                              v.rpSource ? (
                                                <a
                                                  href={v.rpSource}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                >
                                                  {vehicleName(v)}
                                                </a>
                                              ) : (
                                                v.name
                                              ),
                                            )}
                                          </h4>
                                        )}
                                        {localize(
                                          v.owned && (
                                            <small>
                                              {localize(
                                                v.observed
                                                  ? t("已拥有 · 有出战记录")
                                                  : t("已拥有 · 未出战"),
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
                                              {localize(statsDate(v.rpCheckedAt))}
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
            )}
            <footer className="wt-valuation-section">
              {localize(cacheNotice && <output>{localize(cacheNotice)}</output>)}
              <p>{localize(valuationRules.notice)}</p>
              <small>
                {t("资料采集")}
                {localize(statsDate(value.fetchedAt))}
                {t("· 估值计算")}
                {localize(statsDate(value.calculatedAt))}
                {localize(
                  value.localCached
                    ? t(" · 浏览器估值缓存，本次不扣次")
                    : value.cached && t(" · 已命中估值缓存，本次不扣次"),
                )}
              </small>
            </footer>
          </Modal>
        ),
      )}
    </div>
  );
}
