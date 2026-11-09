import { currentActivityPrice, latestAvailablePrice, primaryOffer } from "./sale-price-model.ts";
import type { PriceSummary } from "./sale-price-model.ts";
import type { SaleEvent, SaleVehicle } from "./sale-calendar-model.ts";
import type { VehicleTileUnit } from "./VehicleTile.tsx";
import { matchesSale } from "./sale-event-matching.ts";

type Currency = "CNY" | "GE";
type Reason = "missing" | "unavailable" | "conflict";
export type HomeWatchTotalQuote = {
  vehicleId: string;
  currency: Currency;
  amountMinor: number | null;
  checkedAt: string | null;
  sourceUrl: string | null;
  basis: "summary" | "canonical" | "unknown";
  reason?: Reason;
  productKeys: string[];
};
export type HomeWatchTotalsOptions = {
  summaries: ReadonlyMap<string, PriceSummary>;
  now: number;
  events?: SaleEvent[];
  fallback?: (watch: SaleVehicle) => { known: boolean; unit: VehicleTileUnit };
};
const positive = (amount: number | null | undefined): amount is number =>
  Number.isSafeInteger(amount) && (amount ?? 0) > 0;
const date = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value)) ? value : null;
function purchaseKey(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:") return null;
    if (url.hostname === "store.gaijin.net" && url.searchParams.get("id"))
      return `sku:gaijin_pc:${url.searchParams.get("id")}`;
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|ref$|referer$|affiliate$)/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    url.searchParams.sort();
    if (url.pathname === "/" && !url.search) return null;
    return `url:${url.href}`;
  } catch {
    return null;
  }
}
function quote(watch: SaleVehicle, options: HomeWatchTotalsOptions): HomeWatchTotalQuote {
  const summary = options.summaries.get(watch.id);
  // The saved purchase channel fixes the unit; an alternate cash offer cannot replace GE.
  const currency: Currency = watch.channel === "ge" ? "GE" : "CNY";
  const unit = options.fallback?.(watch);
  const storeKey = purchaseKey(watch.store) || purchaseKey(unit?.known ? unit.unit.store : null);
  const expectedProductId =
    currency === "CNY"
      ? (unit?.known ? unit.unit.packPrice?.productId : null) ||
        (storeKey?.startsWith("sku:gaijin_pc:") ? storeKey.slice("sku:gaijin_pc:".length) : null)
      : null;
  const offer =
    summary?.vehicleId === watch.id
      ? primaryOffer({
          ...summary,
          offers: summary.offers.filter(
            (candidate) =>
              candidate.currency === currency &&
              candidate.conditions === "普通单件购买" &&
              (!expectedProductId ||
                !candidate.productId ||
                candidate.productId === expectedProductId),
          ),
        })
      : undefined;
  const productKeys =
    currency === "GE"
      ? [`ge:${watch.id}`]
      : [
          ...(offer?.productId ? [`sku:${offer.platform}:${offer.productId}`] : []),
          ...(storeKey ? [storeKey] : []),
          ...(unit?.known && unit.unit.packPrice?.productId
            ? [`sku:gaijin_pc:${unit.unit.packPrice.productId}`]
            : []),
        ];
  const result: HomeWatchTotalQuote = {
    vehicleId: watch.id,
    currency,
    amountMinor: null,
    checkedAt: null,
    sourceUrl: null,
    basis: "unknown",
    reason: "missing",
    productKeys,
  };
  if (offer) {
    if (
      !offer.available ||
      (offer.latest?.available === false && Date.parse(offer.latest.observedAt) <= options.now)
    )
      return {
        ...result,
        basis: "summary",
        reason: "unavailable",
        checkedAt: date(offer.latest?.checkedAt),
        sourceUrl: offer.latest?.sourceUrl || null,
      };
    if (offer.conditions !== "普通单件购买") return result;
    const latest = latestAvailablePrice(offer, options.now);
    // A measured promotion quote needs its own confirmed, active and matched event.
    const promotional =
      latest &&
      (!!latest.eventId ||
        (latest.discountPercent ?? 0) > 0 ||
        (latest.regularAmountMinor != null && latest.amountMinor < latest.regularAmountMinor));
    const active = (options.events || []).filter((event) =>
      matchesSale(
        watch,
        event,
        summary?.discountEvidence
          ?.filter((e) => e.sourceUrl && event.sources.some((s) => s.url === e.sourceUrl))
          .map(() => event.id) || [],
      ),
    );
    const current = promotional
      ? active
          .map((event) => currentActivityPrice(offer, event, options.now))
          .find(
            (point) =>
              point?.evidenceKind === "direct_quote" &&
              point.observedAt === latest?.observedAt &&
              point.amountMinor === latest.amountMinor,
          )
      : latest;
    if (current && positive(current.amountMinor))
      return {
        ...result,
        amountMinor: current.amountMinor,
        checkedAt: date(current.checkedAt),
        sourceUrl: current.sourceUrl,
        basis: "summary",
        reason: undefined,
      };
    // Explicitly observed invalid amounts must not turn into a stale fallback price.
    if (current)
      return { ...result, checkedAt: date(current.checkedAt), sourceUrl: current.sourceUrl };
  }
  // Saved watch.originalPrice is a historic user snapshot, never a current-price fallback.
  if (!unit?.known) return result;
  const card = unit.unit;
  if (currency === "GE" && card.kind === "gold" && positive(card.price ?? card.ge))
    return {
      ...result,
      amountMinor: (card.price ?? card.ge)!,
      sourceUrl: card.gePrice?.source || null,
      checkedAt: date(card.gePrice?.checkedAt),
      basis: "canonical",
      reason: undefined,
    };
  if (currency === "CNY" && card.kind === "pack") {
    const price = card.packPrice;
    if (price?.reason === "not_listed")
      return {
        ...result,
        basis: "canonical",
        reason: "unavailable",
        checkedAt: date(price.checkedAt),
        sourceUrl: price.source,
      };
    if (price?.status === "priced" && positive(price.amountCents))
      return {
        ...result,
        amountMinor: price.amountCents,
        checkedAt: date(price.checkedAt),
        sourceUrl: price.source,
        basis: "canonical",
        reason: undefined,
      };
  }
  return result;
}

/** All watched products, independent of UI pagination; money and game currency never mix.
 * cartTotals intentionally remains unchanged: it calculates regular purchase-plan prices. */
export function homeWatchTotals(watches: SaleVehicle[], options: HomeWatchTotalsOptions) {
  const rows = watches.map((watch) => quote(watch, options));
  const groups: HomeWatchTotalQuote[][] = [];
  for (const row of rows) {
    const keys = row.productKeys.length
      ? row.productKeys
      : [`unknown:${row.currency}:${row.vehicleId}`];
    row.productKeys = keys;
    const matching = groups.filter((group) =>
      group.some(
        (other) =>
          other.currency === row.currency && other.productKeys.some((key) => keys.includes(key)),
      ),
    );
    const group = [row, ...matching.flat()];
    for (const old of matching) groups.splice(groups.indexOf(old), 1);
    groups.push(group);
  }
  let knownCny = 0n,
    knownGe = 0n,
    missing = 0,
    unavailable = 0,
    conflicts = 0;
  let unknownCny = 0,
    unknownGe = 0;
  const dates: Record<Currency, string[]> = { CNY: [], GE: [] };
  const unknownDates = { cny: 0, ge: 0 };
  for (const group of groups) {
    const currency = group[0].currency;
    const candidates = group.filter((row) => row.amountMinor !== null);
    const measured = candidates.filter((row) => row.basis === "summary");
    const preferred = measured.length ? measured : candidates;
    const amounts = new Set(preferred.map((row) => row.amountMinor));
    const summaryRows = group.filter((row) => row.basis === "summary");
    const gone = (summaryRows.length ? summaryRows : group).some(
      (row) => row.reason === "unavailable",
    );
    const conflict = amounts.size > 1 || (gone && candidates.length > 0);
    const identityMissing =
      currency === "CNY" &&
      group.every((row) => row.productKeys.every((key) => key.startsWith("unknown:")));
    if (conflict || gone || !preferred.length || identityMissing) {
      if (conflict) conflicts++;
      else if (gone) unavailable++;
      else missing++;
      if (currency === "CNY") unknownCny++;
      else unknownGe++;
      continue;
    }
    if (currency === "CNY") knownCny += BigInt(preferred[0].amountMinor!);
    else knownGe += BigInt(preferred[0].amountMinor!);
    if (preferred.some((row) => !row.checkedAt)) unknownDates[currency === "CNY" ? "cny" : "ge"]++;
    dates[currency].push(...preferred.flatMap((row) => (row.checkedAt ? [row.checkedAt] : [])));
  }
  const oldest = (values: string[]) =>
    values.sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;
  return {
    cny: unknownCny ? null : knownCny,
    ge: unknownGe ? null : knownGe,
    knownCny,
    knownGe,
    unknownCny,
    unknownGe,
    missing,
    unavailable,
    conflicts,
    selected: watches.length,
    products: groups.length,
    duplicates: watches.length - groups.length,
    checkedAt: { cny: oldest(dates.CNY), ge: oldest(dates.GE) },
    unknownDates,
    rows,
  };
}
