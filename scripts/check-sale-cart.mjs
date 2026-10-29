/** Offline regression cases for activity prices and authenticated garage synchronization. */
import assert from "node:assert/strict";
import { activityChartGeometry, activityPricePoints } from "../src/sale-activity-prices.ts";
import { cartTotals, currentActivityDiscount } from "../src/sale-price-model.ts";
import { mergeOwnedGarage, preferOwnedBinding } from "../src/owned-garage.ts";

const now = Date.parse("2026-10-29T12:00:00Z");
const vehicle = {
  id: "test-vehicle",
  name: "测试礼包",
  country: "ussr",
  channel: "pack",
  originalPrice: { currency: "CNY", amount: 49900, checkedAt: "2026-10-01", source: "official" },
  store: "https://store.gaijin.net/story.php?id=1",
};
const event = {
  id: "anniversary-2026",
  title: "周年庆 · 商城礼包",
  status: "confirmed",
  startAt: "2026-10-28T11:00:00Z",
  endAt: "2026-11-02T11:00:00Z",
  channels: ["pack"],
  sources: [{ url: "https://warthunder.com/en/news/123-anniversary-en" }],
};
const evidence = {
  title: "商品名称",
  sourceUrl: event.sources[0].url,
  startAt: event.startAt,
  endAt: event.endAt,
  currency: "CNY",
  discountPercent: 50,
  purchaseCondition: "普通单件购买",
  amountMinor: null,
};
const point = {
  observedAt: "2026-10-29T01:00:00Z",
  checkedAt: "2026-10-29T01:00:00Z",
  amountMinor: 25000,
  regularAmountMinor: 49900,
  sourceUrl: vehicle.store,
  evidenceKind: "direct_quote",
  eventId: event.id,
  effectiveUntil: event.endAt,
  discountPercent: 50,
};
const normal = { ...point, amountMinor: 49900, discountPercent: 0, eventId: undefined };
const offer = {
  id: "sku-1",
  currency: "CNY",
  conditions: "普通单件购买",
  available: true,
  latest: point,
  minimum: point,
  points: [point, point, normal],
  previewPoints: [point],
};
const prices = (o = offer, e = [evidence], events = [event]) =>
  activityPricePoints(vehicle, o, e, events, now);
let points = prices();
assert.equal(points.length, 1, "repeat captures and announcement must be one activity");
assert.equal(
  points[0].activityDate,
  event.startAt,
  "activity date must replace collection date on x axis",
);
assert.equal(
  points[0].activityTitle,
  event.title,
  "tooltip title must be event name, not product name",
);
assert.equal(points[0].amountMinor, 25000, "actual quote wins over a lower derived amount");
assert.equal(points[0].checkedAt, point.checkedAt, "collection provenance remains intact");
assert.equal(
  prices({ ...offer, latest: normal, minimum: normal, points: [normal], previewPoints: [] }, [])
    .length,
  0,
  "regular observations cannot create activity points",
);
points = prices({ ...offer, latest: normal, minimum: normal, points: [normal], previewPoints: [] });
assert.equal(
  points[0].amountMinor,
  24950,
  "a regular snapshot must not suppress announcement evidence",
);
assert.equal(points[0].evidenceKind, "official_announcement_derived");
assert.equal(
  prices(offer, [{ ...evidence, currency: "GE" }], []).length,
  0,
  "currencies cannot be mixed",
);
assert.equal(
  prices(
    { ...offer, latest: null, minimum: null, points: [], previewPoints: [] },
    [{ ...evidence, startAt: "2027-01-01", endAt: "2027-01-08" }],
    [],
  ).length,
  0,
  "future activity prices stay unknown",
);
assert.equal(
  prices(offer, [], [{ ...event, status: "predicted" }]).length,
  0,
  "predictions do not establish historical prices",
);
const lower = { ...point, amountMinor: 24000, observedAt: "2026-10-28T15:00:00Z" };
assert.equal(
  prices({ ...offer, points: [point, lower] })[0].amountMinor,
  24000,
  "use lowest actual quote within activity",
);
assert.equal(
  prices(offer, [evidence, { ...evidence, sourceUrl: evidence.sourceUrl + "?utm_source=test" }])
    .length,
  1,
);
const catalogEvidence = {
  ...evidence,
  sourceUrl: "https://store.gaijin.net/catalog.php?search=annual-sale",
};
const catalogPoint = { ...point, sourceUrl: catalogEvidence.sourceUrl };
assert.equal(
  prices({ ...offer, latest: catalogPoint, points: [catalogPoint] }, [catalogEvidence, evidence])
    .length,
  1,
  "catalog and announcement sources for the same official activity must share one dot",
);
assert.equal(
  prices(offer, [catalogEvidence, evidence], []).length,
  1,
  "missing calendar metadata must not duplicate the same activity window by source",
);
assert.equal(prices(offer, null, []).length, 0, "null evidence is a valid empty public response");
const newer = { ...point, observedAt: "2026-10-29T02:00:00Z", discountPercent: undefined };
assert.equal(
  currentActivityDiscount({ ...offer, latest: newer }, event, now),
  50,
  "official 50% survives same-price quote without rate; never infer 49.9% from CNY rounding",
);
assert.equal(
  currentActivityDiscount({ ...offer, latest: { ...newer, amountMinor: 26000 } }, event, now),
  null,
  "do not attach old rate to a changed price",
);
assert.equal(currentActivityDiscount(offer, event, Date.parse(event.endAt)), null);
const second = {
  ...event,
  id: "second",
  title: "第二次活动",
  startAt: "2026-10-01",
  endAt: "2026-10-08",
};
const secondPoint = { ...point, eventId: second.id, observedAt: "2026-10-05", amountMinor: 30000 };
points = prices({ ...offer, points: [point, secondPoint] }, [evidence], [event, second]);
assert.equal(points.length, 2);
for (const compact of [false, true]) {
  const geometry = activityChartGeometry(points, compact);
  assert(geometry.area.endsWith(" Z"));
  assert(
    geometry.dots.every(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y < geometry.baseline,
    ),
  );
  const one = activityChartGeometry(points.slice(0, 1), compact);
  assert.equal(one.dots.length, 1, "single activity never creates a fabricated second point");
  assert(Number.isFinite(one.dots[0].x));
}
const binding = {
  uid: "bound-uid",
  nickname: "测试",
  fetchedAt: "2026-10-20",
  linkedAt: "2026-10-01",
  vehicles: [],
  unmatchedCount: 0,
};
const garage = {
  uid: binding.uid,
  fetchedAt: "2026-10-29",
  vehicles: [{ id: vehicle.id, country: "ussr", category: null }],
  unmatchedCount: 0,
};
const updated = mergeOwnedGarage(binding, garage);
assert.equal(updated.vehicles[0].id, vehicle.id);
assert.equal(mergeOwnedGarage(binding, { ...garage, uid: "another-player" }), binding);
assert.equal(mergeOwnedGarage(null, garage), null, "reading a profile cannot create a binding");
assert.equal(
  mergeOwnedGarage(updated, { ...garage, fetchedAt: "2026-10-21" }),
  updated,
  "old garage cannot roll back new ownership",
);
assert.equal(
  mergeOwnedGarage(updated, garage),
  updated,
  "equal garage should not trigger render loops",
);
assert.equal(preferOwnedBinding(binding, updated), updated);
assert.equal(preferOwnedBinding(null, updated), null, "unlink cannot be undone by local ownership");
assert.equal(
  preferOwnedBinding({ ...binding, uid: "new-bound-uid" }, updated).uid,
  "new-bound-uid",
);
const total = cartTotals([vehicle], {}, new Set(updated.vehicles.map((v) => v.id)));
assert.equal(total.cny, 0n, "owned vehicle must leave cart total immediately");
assert.equal(total.owned, 1);
console.log(
  "Sale cart checks passed: activity grouping/dates/amounts, area geometry, official discount, bound garage and totals.",
);
