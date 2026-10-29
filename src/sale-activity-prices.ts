import type { SaleEvent, SaleVehicle } from "./sale-calendar-model";
import type { DiscountEvidence, PriceOffer, PricePoint } from "./sale-price-model";

export type ActivityPricePoint = PricePoint & {
  activityId: string;
  activityTitle: string;
  activityDate: string;
  activityEnd: string;
};

function sourceKey(value: string) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()])
      if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.origin + url.pathname.replace(/\/$/, "") + url.search;
  } catch {
    return value;
  }
}
function sourceTitle(value: string) {
  try {
    const slug = new URL(value).pathname.split("/").filter(Boolean).at(-1) || "";
    const title = decodeURIComponent(slug)
      .replace(/^\d+-/, "")
      .replace(/-en$/, "")
      .replaceAll("-", " ");
    return title && !/^\d+$/.test(title) && !/\.(php|html?)$/.test(title) ? title : "官方促销活动";
  } catch {
    return "官方促销活动";
  }
}

/** One lowest evidenced price per activity. Collection timestamps remain provenance only. */
export function activityPricePoints(
  vehicle: SaleVehicle,
  offer: PriceOffer | undefined,
  evidence: DiscountEvidence[] | null = [],
  events: SaleEvent[] = [],
  now = Date.now(),
): ActivityPricePoint[] {
  if (!offer) return [];
  const recorded = [
    offer.latest,
    offer.lastRecorded,
    offer.minimum,
    ...offer.points,
    ...(offer.previewPoints || []),
  ].filter(
    (p): p is PricePoint =>
      !!p &&
      Number.isSafeInteger(p.amountMinor) &&
      p.amountMinor > 0 &&
      Date.parse(p.observedAt) <= now &&
      p.evidenceKind !== "official_announcement_derived",
  );
  const confirmed = events.filter((e) => e.status === "confirmed" && Date.parse(e.startAt) <= now);
  const grouped = new Map<string, ActivityPricePoint>();
  function add(
    point: PricePoint,
    activity: { id: string; title: string; startAt: string; endAt: string },
  ) {
    const old = grouped.get(activity.id);
    const measured = point.evidenceKind !== "official_announcement_derived";
    const oldMeasured = old?.evidenceKind !== "official_announcement_derived";
    if (
      old &&
      ((oldMeasured && !measured) ||
        (oldMeasured === measured &&
          (old.amountMinor < point.amountMinor ||
            (old.amountMinor === point.amountMinor &&
              (Date.parse(old.checkedAt) || 0) >= (Date.parse(point.checkedAt) || 0)))))
    )
      return;
    grouped.set(activity.id, {
      ...point,
      activityId: activity.id,
      activityTitle: activity.title,
      activityDate: activity.startAt,
      activityEnd: activity.endAt,
    });
  }
  const base =
    vehicle.originalPrice?.currency === offer.currency ? vehicle.originalPrice.amount : null;
  const discounted = (p: PricePoint) =>
    (p.regularAmountMinor ?? base ?? 0) > p.amountMinor || (p.discountPercent ?? 0) > 0;
  for (const e of evidence || []) {
    if (
      e.currency !== offer.currency ||
      e.purchaseCondition !== offer.conditions ||
      (e.productId && offer.productId && e.productId !== offer.productId) ||
      !e.startAt ||
      !e.endAt ||
      !Number.isFinite(Date.parse(e.startAt)) ||
      !(Date.parse(e.startAt) < Date.parse(e.endAt)) ||
      Date.parse(e.startAt) > now
    )
      continue;
    const linkedBySource = confirmed
      .filter(
        (event) =>
          event.sources.some((s) => sourceKey(s.url) === sourceKey(e.sourceUrl)) &&
          (event.channels.includes(vehicle.channel as "pack" | "ge") ||
            event.channels.includes("bundle")) &&
          Date.parse(event.startAt) < Date.parse(e.endAt!) &&
          Date.parse(event.endAt) > Date.parse(e.startAt!),
      )
      .sort(
        (a, b) =>
          Math.abs(Date.parse(a.startAt) - Date.parse(e.startAt!)) -
          Math.abs(Date.parse(b.startAt) - Date.parse(e.startAt!)),
      )[0];
    // A catalog page and its announcement can describe the same activity. Use the
    // quote's explicit event identity if the calendar lists only one of those sources.
    const linked =
      linkedBySource ||
      confirmed.find((event) =>
        recorded.some(
          (p) =>
            p.eventId === event.id &&
            sourceKey(p.sourceUrl) === sourceKey(e.sourceUrl) &&
            Date.parse(event.startAt) === Date.parse(e.startAt!) &&
            Date.parse(event.endAt) === Date.parse(e.endAt!),
        ),
      );
    const namedEvidence = (evidence || []).find(
      (other) =>
        Date.parse(other.startAt || "") === Date.parse(e.startAt!) &&
        Date.parse(other.endAt || "") === Date.parse(e.endAt!) &&
        other.currency === e.currency &&
        other.purchaseCondition === e.purchaseCondition &&
        other.productId === e.productId &&
        sourceTitle(other.sourceUrl) !== "官方促销活动",
    );
    const activity = linked || {
      id: `window:${Date.parse(e.startAt)}:${Date.parse(e.endAt)}`,
      title: sourceTitle(namedEvidence?.sourceUrl || e.sourceUrl),
      startAt: e.startAt,
      endAt: e.endAt,
    };
    const matches = recorded.filter(
      (p) =>
        (!p.eventId || p.eventId === activity.id) &&
        discounted(p) &&
        Date.parse(p.observedAt) >= Date.parse(activity.startAt) &&
        Date.parse(p.observedAt) < Date.parse(activity.endAt),
    );
    for (const p of matches) add(p, activity);
    if (Number.isSafeInteger(e.amountMinor) && e.amountMinor! > 0 && !e.estimateOnly) {
      add(
        {
          observedAt: e.startAt,
          checkedAt: e.checkedAt || "",
          amountMinor: e.amountMinor!,
          regularAmountMinor: base,
          sourceUrl: e.sourceUrl,
          evidenceKind: "catalog_quote",
        },
        activity,
      );
    } else if (
      !matches.length &&
      offer.conditions === "普通单件购买" &&
      base &&
      Number.isSafeInteger(base) &&
      Number.isInteger(e.discountPercent) &&
      e.discountPercent > 0 &&
      e.discountPercent < 100
    ) {
      add(
        {
          observedAt: e.startAt,
          checkedAt: e.checkedAt || "",
          amountMinor: Number((BigInt(base) * BigInt(100 - e.discountPercent) + 50n) / 100n),
          regularAmountMinor: base,
          sourceUrl: e.sourceUrl,
          evidenceKind: "official_announcement_derived",
        },
        activity,
      );
    }
  }
  for (const p of recorded) {
    const event = confirmed.find((e) => e.id === p.eventId);
    if (
      event &&
      discounted(p) &&
      Date.parse(p.observedAt) >= Date.parse(event.startAt) &&
      Date.parse(p.observedAt) < Date.parse(event.endAt)
    )
      add(p, event);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      Date.parse(a.activityDate) - Date.parse(b.activityDate) ||
      a.activityId.localeCompare(b.activityId),
  );
}

export function activityChartGeometry(points: ActivityPricePoint[], compact = false) {
  const width = compact ? 160 : 840,
    height = compact ? 44 : 260;
  const left = compact ? 8 : 76,
    right = compact ? 8 : 24,
    top = compact ? 6 : 22,
    bottom = compact ? 4 : 40;
  const first = Date.parse(points[0]?.activityDate || ""),
    last = Date.parse(points.at(-1)?.activityDate || "");
  const max = Math.max(1, ...points.map((p) => p.amountMinor)) * 1.12;
  const baseline = height - bottom;
  const dots = points.map((point) => ({
    point,
    x:
      left +
      (first === last ? 0.5 : (Date.parse(point.activityDate) - first) / (last - first)) *
        (width - left - right),
    y: top + (1 - point.amountMinor / max) * (baseline - top),
  }));
  const line = dots.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = dots.length
    ? `${line} L${dots.at(-1)!.x},${baseline} L${dots[0].x},${baseline} Z`
    : "";
  return { width, height, left, right, top, baseline, max, dots, line, area };
}
