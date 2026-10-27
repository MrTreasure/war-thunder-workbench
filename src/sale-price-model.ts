import type { SaleVehicle } from "./sale-calendar-model";

export type PricePoint = {
  observedAt: string;
  contentVersion?: string;
  amountMinor: number;
  regularAmountMinor: number | null;
  sourceUrl: string;
  checkedAt: string;
  evidenceKind: "direct_quote" | "official_announcement_derived" | "catalog_quote";
};
export type PriceOffer = {
  id: string;
  title: string;
  productId?: string | null;
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
export type DiscountEvidence = {
  title: string;
  sourceUrl: string;
  startAt?: string | null;
  endAt?: string | null;
  discountPercent: number;
  purchaseCondition: string;
  amountMinor: number | null;
  currency: "CNY" | "GE";
  productId?: string | null;
  estimateOnly?: boolean;
};
/** Same SKU is one selectable product. Content versions remain attached to points. */
export function groupedOffers(summary?: PriceSummary): PriceOffer[] {
  const groups = new Map<string, PriceOffer[]>();
  for (const offer of summary?.offers || []) {
    const key = JSON.stringify([
      offer.platform,
      offer.productId || (offer.currency === "GE" ? summary?.vehicleId : offer.id),
      offer.currency,
      offer.region,
      offer.conditions,
    ]);
    groups.set(key, [...(groups.get(key) || []), offer]);
  }
  return [...groups.entries()].map(([id, offers]) => {
    const points = (field: "points" | "previewPoints") =>
      offers
        .flatMap((o) => (o[field] || []).map((p) => ({ ...p, contentVersion: o.contentVersion })))
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const values = (field: "latest" | "lastRecorded" | "minimum") =>
      offers.map((o) => o[field]).filter((p): p is PricePoint => !!p);
    const newest = (field: "latest" | "lastRecorded") =>
      values(field).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] || null;
    return {
      ...offers[0],
      id,
      points: points("points"),
      previewPoints: points("previewPoints"),
      sampleCount: offers.reduce((sum, o) => sum + o.sampleCount, 0),
      firstObservedAt:
        offers
          .map((o) => o.firstObservedAt)
          .filter((v): v is string => !!v)
          .sort()[0] || null,
      latest: newest("latest"),
      lastRecorded: newest("lastRecorded"),
      minimum: values("minimum").sort((a, b) => a.amountMinor - b.amountMinor)[0] || null,
      available: offers.some((o) => o.available),
      truncated: offers.some((o) => o.truncated),
    };
  });
}
/** A regular-price snapshot is not evidence of a historical discounted minimum. */
export function discountedMinimum(offer?: PriceOffer) {
  const p = offer?.minimum;
  const regular =
    offer?.currency === "CNY"
      ? p?.regularAmountMinor || 0
      : Math.max(
          p?.regularAmountMinor || 0,
          offer?.latest?.regularAmountMinor || 0,
          ...(offer?.previewPoints || []).map((point) => point.regularAmountMinor || 0),
        );
  return p && regular > p.amountMinor ? p : null;
}
export type PriceSummary = {
  vehicleId: string;
  offers: PriceOffer[];
  discountEvidence?: DiscountEvidence[];
};
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
  const offers = groupedOffers(summary);
  return (
    offers.find((o) => o.id === offerId) ||
    offers.find((o) => o.currency === "CNY" && o.conditions === "普通单件购买") ||
    offers[0]
  );
}
/** Purchase planning always uses the canonical regular price; history is read-only. */
export function cartTotals(
  vehicles: SaleVehicle[],
  preferences: PricePreferences,
  ownedIds: ReadonlySet<string> = new Set(),
) {
  const offers = new Map<string, { amount: number; currency: "CNY" | "GE" }>();
  let missing = 0,
    selected = 0,
    duplicates = 0,
    owned = 0;
  const conflicts = new Set<string>();
  for (const vehicle of vehicles) {
    if (preferences[vehicle.id]?.selected === false) continue;
    if (ownedIds.has(vehicle.id)) {
      owned++;
      continue;
    }
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
    owned,
    missing,
    selected,
    products: offers.size,
    duplicates,
    conflicts: conflicts.size,
  };
}

/** Announcement estimates are a separate display projection, never observed quotes. */
export function historicalDisplayPoints(
  vehicle: SaleVehicle,
  offer: PriceOffer | undefined,
  evidence: DiscountEvidence[] = [],
): PricePoint[] {
  const quote = vehicle.originalPrice;
  const actual = (offer?.points.length ? offer.points : offer?.previewPoints || []).filter(
    (p) => p.evidenceKind !== "official_announcement_derived",
  );
  const estimates: PricePoint[] = [];
  if (quote?.amount && Number.isSafeInteger(quote.amount)) {
    for (const e of evidence) {
      if (
        (offer &&
          (offer.currency !== e.currency ||
            offer.conditions !== e.purchaseCondition ||
            (e.productId && offer.productId && e.productId !== offer.productId))) ||
        e.currency !== quote.currency ||
        e.purchaseCondition !== "普通单件购买" ||
        !e.startAt ||
        Date.parse(e.startAt) > Date.now() ||
        e.discountPercent <= 0 ||
        e.discountPercent >= 100
      )
        continue;
      const amount = Number((BigInt(quote.amount) * BigInt(100 - e.discountPercent) + 50n) / 100n);
      estimates.push({
        observedAt: e.startAt,
        amountMinor: e.amountMinor ?? amount,
        regularAmountMinor: quote.amount,
        sourceUrl: e.sourceUrl,
        checkedAt: e.startAt,
        evidenceKind: "official_announcement_derived",
      });
    }
  }
  return [...actual, ...estimates].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  );
}
export function historicalDisplayMinimum(
  vehicle: SaleVehicle,
  offer: PriceOffer | undefined,
  evidence: DiscountEvidence[] = [],
) {
  const points = historicalDisplayPoints(vehicle, offer, evidence);
  const observed = discountedMinimum(offer);
  if (observed) points.push(observed);
  return (
    points
      .filter((p) => p.regularAmountMinor != null && p.amountMinor < p.regularAmountMinor)
      .sort(
        (a, b) =>
          a.amountMinor - b.amountMinor ||
          Number(a.evidenceKind === "official_announcement_derived") -
            Number(b.evidenceKind === "official_announcement_derived"),
      )[0] || null
  );
}
