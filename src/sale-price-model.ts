import type { SaleVehicle } from "./sale-calendar-model";

export type PricePoint = {
  observedAt: string;
  amountMinor: number;
  regularAmountMinor: number | null;
  sourceUrl: string;
  checkedAt: string;
  evidenceKind: "direct_quote" | "official_announcement_derived" | "catalog_quote";
};
export type PriceOffer = {
  id: string;
  title: string;
  currency: "CNY" | "GE";
  platform: string;
  conditions: string;
  region: string;
  contentVersion: string;
  latest: PricePoint | null;
  minimum: PricePoint | null;
  firstObservedAt: string | null;
  sampleCount: number;
  available: boolean;
  points: PricePoint[];
  previewPoints?: PricePoint[];
  lastRecorded?: PricePoint | null;
  truncated?: boolean;
};
export type PriceSummary = { vehicleId: string; offers: PriceOffer[] };
export type PricePreferences = Record<string, { selected: boolean }>;
export function priceText(value: number | bigint | null, currency: "CNY" | "GE") {
  if (value === null) return "待核价";
  const amount = BigInt(value);
  return currency === "GE"
    ? `${amount.toLocaleString("zh-CN")} GE`
    : `¥${(amount / 100n).toLocaleString("zh-CN")}.${String(amount % 100n).padStart(2, "0")}`;
}
export const priceDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "尚无记录";
export function primaryOffer(summary?: PriceSummary, offerId?: string) {
  const selected = summary?.offers.find((o) => o.id === offerId);
  return (
    selected ||
    summary?.offers.find((o) => o.currency === "CNY" && o.conditions === "普通单件购买") ||
    summary?.offers[0]
  );
}
/** Purchase planning always uses the canonical regular price; history is read-only. */
export function cartTotals(vehicles: SaleVehicle[], preferences: PricePreferences) {
  const offers = new Map<string, { amount: number; currency: "CNY" | "GE" }>();
  let missing = 0,
    selected = 0,
    duplicates = 0;
  const conflicts = new Set<string>();
  for (const vehicle of vehicles) {
    if (preferences[vehicle.id]?.selected === false) continue;
    selected++;
    const quote = vehicle.originalPrice;
    let productId: string | null = null;
    if (quote?.currency === "CNY" && vehicle.store) {
      try {
        const url = new URL(vehicle.store);
        if (url.hostname === "store.gaijin.net") productId = url.searchParams.get("id");
      } catch {
        /* Unknown products cannot be deduplicated safely. */
      }
    }
    if (
      !quote ||
      !Number.isSafeInteger(quote.amount) ||
      (quote.amount ?? 0) <= 0 ||
      (quote.currency === "CNY" && !productId)
    ) {
      missing++;
      continue;
    }
    const id = quote.currency === "CNY" ? `gaijin-pack:${productId}` : `ge:${vehicle.id}`;
    const old = offers.get(id);
    if (old) {
      duplicates++;
      if (old.amount !== quote.amount || old.currency !== quote.currency) conflicts.add(id);
    } else offers.set(id, { amount: quote.amount!, currency: quote.currency });
  }
  let cny = 0n,
    ge = 0n;
  for (const [id, quote] of offers) {
    if (conflicts.has(id)) continue;
    if (quote.currency === "CNY") cny += BigInt(quote.amount);
    else ge += BigInt(quote.amount);
  }
  return {
    cny,
    ge,
    missing,
    selected,
    products: offers.size,
    duplicates,
    conflicts: conflicts.size,
  };
}
