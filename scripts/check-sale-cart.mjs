/** Offline regression cases for activity prices and authenticated garage synchronization. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { activityChartGeometry, activityPricePoints } from "../src/sale-activity-prices.ts";
import { cartTotals, currentActivityDiscount } from "../src/sale-price-model.ts";
import { mergeOwnedGarage, preferOwnedBinding } from "../src/owned-garage.ts";
import { SalePreferenceDraft } from "../src/sale-preference-draft.ts";
import { matchesSale, nextSale } from "../src/sale-event-matching.ts";
import participation from "../data/sale-event-participation.json" with { type: "json" };

const codebook = JSON.parse(
  await readFile(new URL("../data/lineup-codebook.json", import.meta.url)),
);
const knownVehicleIds = new Set(
  Object.values(codebook.countries).flatMap((country) => Object.values(country)),
);
assert.equal(participation.schemaVersion, 1);
for (const record of participation.events) {
  assert(/^https:\/\/warthunder\.com\/en\/news\/\d+/.test(record.sourceUrl));
  assert(/^[a-f0-9]{64}$/.test(record.sourceSha256));
  assert(Number.isFinite(Date.parse(record.checkedAt)));
  assert(
    record.vehicleIds.every((id) => knownVehicleIds.has(id)),
    "historical lists must use stable vehicle IDs",
  );
}

// A nearby themed promotion cannot stand in for a vehicle's discount history.
const forecastVehicle = {
  id: "ordinary-pack",
  country: "britain",
  category: "ground",
  channel: "pack",
};
const pastBlackFriday = {
  id: "black-friday-store-2025",
  family: "black-friday",
  phase: "store",
  year: 2025,
  status: "confirmed",
  startAt: "2025-11-28T11:00:00Z",
  endAt: "2025-12-05T11:00:00Z",
  coverage: "selected",
  channels: ["pack", "bundle"],
  countries: [],
  categories: [],
  vehicleIds: [],
  excludedVehicleIds: [],
  sources: [],
};
const nextBlackFriday = {
  ...pastBlackFriday,
  id: "black-friday-store-2026",
  year: 2026,
  status: "predicted",
  startAt: "2026-11-27T11:00:00Z",
  endAt: "2026-12-04T11:00:00Z",
};
const pastWinter = {
  ...pastBlackFriday,
  id: "winter-store-2025",
  family: "winter",
  channels: ["pack"],
  startAt: "2025-12-24T11:00:00Z",
  endAt: "2026-01-02T11:00:00Z",
};
const nextWinter = {
  ...pastWinter,
  id: "winter-store-2026",
  year: 2026,
  status: "predicted",
  startAt: "2026-12-24T11:00:00Z",
  endAt: "2027-01-02T11:00:00Z",
};
const forecastNow = Date.parse("2026-11-03T12:00:00Z");
const forecastEvents = [pastBlackFriday, nextBlackFriday, pastWinter, nextWinter];
assert.equal(
  matchesSale(forecastVehicle, pastBlackFriday),
  false,
  "an empty selected list is not every pack",
);
assert.equal(
  nextSale(forecastVehicle, forecastEvents, forecastNow),
  null,
  "unknown participation must remain unknown",
);
assert.equal(
  nextSale(forecastVehicle, forecastEvents, forecastNow, [pastWinter.id])?.id,
  nextWinter.id,
  "winter evidence must skip the nearer Black Friday event",
);
assert.equal(
  nextSale(forecastVehicle, forecastEvents, forecastNow, [pastBlackFriday.id])?.id,
  nextBlackFriday.id,
  "a vehicle with Black Friday evidence may match Black Friday",
);
assert.equal(
  nextSale(
    forecastVehicle,
    [nextBlackFriday, { ...pastBlackFriday, vehicleIds: [forecastVehicle.id] }],
    forecastNow,
  )?.id,
  nextBlackFriday.id,
  "a verified historical vehicle list also supports the forecast",
);
assert.equal(
  nextSale(forecastVehicle, [nextBlackFriday], forecastNow, [nextBlackFriday.id]),
  null,
  "a forecast cannot be its own participation evidence",
);
assert.equal(
  nextSale(
    forecastVehicle,
    [nextBlackFriday, { ...pastBlackFriday, phase: "ingame" }],
    forecastNow,
    [pastBlackFriday.id],
  ),
  null,
  "different purchase phases cannot supply forecast evidence",
);
assert.equal(
  nextSale(
    forecastVehicle,
    [nextBlackFriday, { ...pastBlackFriday, excludedVehicleIds: [forecastVehicle.id] }],
    forecastNow,
    [pastBlackFriday.id],
  ),
  null,
  "explicit vehicle exclusions win over price evidence",
);
assert.equal(
  matchesSale(forecastVehicle, { ...pastBlackFriday, coverage: "explicit" }, [pastBlackFriday.id]),
  false,
  "a complete official list must not be expanded by mismatched evidence",
);
assert.equal(
  matchesSale(forecastVehicle, { ...pastBlackFriday, coverage: "unexpected" }),
  false,
  "unknown coverage cannot widen eligibility",
);
const geVehicle = { ...forecastVehicle, channel: "ge" };
const geHistory = {
  ...pastWinter,
  phase: "ingame",
  coverage: "all-except-exclusions",
  channels: ["ge"],
};
const geForecast = {
  ...nextWinter,
  phase: "ingame",
  coverage: "all-except-exclusions",
  channels: ["ge"],
};
assert.equal(
  nextSale(geVehicle, [geHistory, geForecast, pastBlackFriday, nextBlackFriday], forecastNow)?.id,
  geForecast.id,
  "a broad GE promotion remains eligible without treating themed bundles as all GE vehicles",
);
assert.equal(
  matchesSale(geVehicle, { ...geHistory, channels: ["bundle"] }),
  false,
  "bundle coverage is not a blanket single-vehicle discount",
);
const officialBlackFriday = {
  ...pastBlackFriday,
  sources: [{ url: participation.events[0].sourceUrl }],
};
for (const id of participation.events[0].vehicleIds) {
  const namedVehicle = { ...forecastVehicle, id };
  assert.equal(
    nextSale(namedVehicle, [officialBlackFriday, nextBlackFriday], forecastNow)?.id,
    nextBlackFriday.id,
    "the verified official Black Friday list remains eligible",
  );
  assert.equal(
    matchesSale(namedVehicle, { ...officialBlackFriday, excludedVehicleIds: [id] }),
    false,
    "the historical supplement cannot bypass an explicit exclusion",
  );
}
assert.equal(
  matchesSale(forecastVehicle, officialBlackFriday),
  false,
  "the official Black Friday list cannot expand to ordinary packs",
);
assert.equal(
  matchesSale({ ...forecastVehicle, id: "ka_50" }, pastBlackFriday),
  false,
  "the historical supplement requires the matching official source",
);
console.log(
  "Sale forecast matching passed: per-vehicle history, themed lists, source pins, channels, phases and exclusions.",
);

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

// Only mocked persistence: verify batching at close rather than at every click.
const storedDrafts = new Map();
const draftStorage = {
  getItem: (key) => storedDrafts.get(key) ?? null,
  setItem: (key, value) => storedDrafts.set(key, value),
  removeItem: (key) => storedDrafts.delete(key),
};
let cloudPlan = { revision: 7, items: {} };
const writes = [];
let acknowledge;
const draftRemote = {
  read: async () => structuredClone(cloudPlan),
  write: (value) => {
    writes.push(structuredClone(value));
    return new Promise((resolve, reject) => {
      acknowledge = { resolve, reject };
    });
  },
};
const plan = new SalePreferenceDraft("user:fixture", draftStorage, draftRemote);
await plan.load();
plan.stage({ [vehicle.id]: { selected: false } });
assert.equal(
  plan.getSnapshot().items[vehicle.id].selected,
  false,
  "checkbox must change before any request",
);
assert.equal(
  cartTotals([vehicle], plan.getSnapshot().items).selected,
  0,
  "totals must follow optimistic selection",
);
plan.stage({ [vehicle.id]: { selected: true } });
await plan.flush();
assert.equal(writes.length, 0, "returning to the initial selection needs no write");
plan.stage({ [vehicle.id]: { selected: false } });
plan.stage({ [vehicle.id]: { selected: false }, second: { selected: false } });
assert.equal(writes.length, 0, "staging several clicks must not POST");
const closing = plan.flush();
assert.equal(writes.length, 1, "close sends one final document");
assert.equal(plan.flush(), closing, "close and unmount must share the same request");
assert.deepEqual(writes[0].items, plan.getSnapshot().items);
cloudPlan = { revision: 8, items: writes[0].items };
acknowledge.resolve(cloudPlan);
await closing;
assert.equal(draftStorage.getItem(plan.pendingKey), null, "acknowledged draft is cleared");

plan.stage({ [vehicle.id]: { selected: true } });
const failure = plan.flush();
acknowledge.reject(new Error("fixture network failure"));
await failure;
assert.ok(draftStorage.getItem(plan.pendingKey), "failed writes retain pending selections");
const retryPlan = new SalePreferenceDraft("user:fixture", draftStorage, draftRemote);
await retryPlan.load();
assert.equal(writes.length, 2, "reopening must read but must not auto-POST pending changes");
assert.equal(retryPlan.getSnapshot().items[vehicle.id].selected, true);
assert.ok(retryPlan.getSnapshot().error.includes("上次同步失败"));
const retryClose = retryPlan.flush();
cloudPlan = { revision: 9, items: writes[2].items };
acknowledge.resolve(cloudPlan);
await retryClose;

retryPlan.stage({ [vehicle.id]: { selected: false } });
const earlierClose = retryPlan.flush();
retryPlan.stage({ [vehicle.id]: { selected: false }, latest: { selected: false } });
const laterClose = retryPlan.flush();
cloudPlan = { revision: 10, items: writes[3].items };
acknowledge.resolve(cloudPlan);
await earlierClose;
assert.equal(writes.length, 5, "a later close must submit edits made during the previous save");
assert.equal(writes[4].revision, 10, "later draft uses the acknowledged revision");
assert.equal(
  writes[4].items.latest.selected,
  false,
  "late acknowledgement cannot erase newer edits",
);
cloudPlan = { revision: 11, items: writes[4].items };
acknowledge.resolve(cloudPlan);
await laterClose;

const conflict = new SalePreferenceDraft("user:conflict", draftStorage, draftRemote);
draftStorage.setItem(
  conflict.pendingKey,
  JSON.stringify({ revision: 5, items: { conflicting: { selected: false } } }),
);
await conflict.load();
await conflict.flush();
assert.equal(writes.length, 5, "revision conflict must not overwrite the cloud");
assert.equal(conflict.getSnapshot().ready, false);
assert.ok(JSON.parse(conflict.exportPending()).items.conflicting);
assert.ok(conflict.pendingKey !== retryPlan.pendingKey, "pending storage remains owner scoped");
const guestPlan = new SalePreferenceDraft("", draftStorage);
await guestPlan.load();
guestPlan.stage({ guest: { selected: false } });
await guestPlan.flush();
assert.equal(writes.length, 5, "guest selection stays local");
assert.equal(
  JSON.parse(draftStorage.getItem("wt-sale-cart-preferences-v1:guest")).guest.selected,
  false,
);
let finishInitialRead;
const earlyClose = new SalePreferenceDraft("user:early", draftStorage, {
  ...draftRemote,
  read: () =>
    new Promise((resolve) => {
      finishInitialRead = resolve;
    }),
});
draftStorage.setItem(
  earlyClose.pendingKey,
  JSON.stringify({ revision: 11, items: { early: { selected: false } } }),
);
const initialRead = earlyClose.load();
const closeBeforeRead = earlyClose.flush();
assert.equal(writes.length, 5);
finishInitialRead(cloudPlan);
await initialRead;
assert.equal(
  writes.length,
  6,
  "close during initial reading still flushes the restored draft afterward",
);
acknowledge.resolve({ revision: 12, items: writes[5].items });
await closeBeforeRead;
cloudPlan = { revision: 12, items: {} };
const revertedPlan = new SalePreferenceDraft("user:reverted", draftStorage, draftRemote);
await revertedPlan.load();
revertedPlan.stage({ [vehicle.id]: { selected: false } });
const beforeRevert = revertedPlan.flush();
revertedPlan.stage({ [vehicle.id]: { selected: true } });
const afterRevert = revertedPlan.flush();
cloudPlan = { revision: 13, items: writes[6].items };
acknowledge.resolve(cloudPlan);
await beforeRevert;
assert.equal(
  JSON.parse(draftStorage.getItem(revertedPlan.pendingKey)).items[vehicle.id].selected,
  true,
  "reverting during a save must still retain the newer selection durably",
);
acknowledge.resolve({ revision: 14, items: writes[7].items });
await afterRevert;
let sessionVersion = 0,
  guardedReads = 0;
cloudPlan = { revision: 14, items: {} };
const guarded = new SalePreferenceDraft("user:identity", draftStorage, {
  ...draftRemote,
  read: async () => {
    guardedReads++;
    return structuredClone(cloudPlan);
  },
  captureIdentity: () => {
    const version = sessionVersion;
    return () => sessionVersion === version;
  },
});
await guarded.load();
guarded.stage({ [vehicle.id]: { selected: false } });
const guardedWrite = guarded.flush();
guarded.stage({ [vehicle.id]: { selected: false }, newer: { selected: false } });
const guardedLoad = guarded.load(),
  guardedClose = guarded.flush();
const writesBeforeSwitch = writes.length;
sessionVersion++;
acknowledge.resolve({ revision: 15, items: writes.at(-1).items });
await Promise.all([guardedWrite, guardedLoad, guardedClose]);
assert.equal(guardedReads, 1, "a queued load cannot read a new account's preferences");
assert.equal(writes.length, writesBeforeSwitch, "queued saves must stop when the session changes");
assert.equal(JSON.parse(draftStorage.getItem(guarded.pendingKey)).items.newer.selected, false);
console.log(
  "Sale preference drafts passed: immediate selection/totals, close batching, duplicate/early close, failure retention, deferred retry, late edits, revision/owner isolation and local guests.",
);
