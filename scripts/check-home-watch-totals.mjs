/** Offline pricing checks; no network, generated data or user documents. */
import assert from "node:assert/strict";
import { homeWatchTotals } from "../src/home-watch-totals-model.ts";
const now = Date.parse("2026-11-09T12:00:00Z");
const vehicle = (id, channel = "pack", sku = id) => ({
  id,
  name: id,
  country: "usa",
  category: "aviation",
  channel,
  store: channel === "pack" ? `https://store.gaijin.net/story.php?id=${sku}` : null,
  originalPrice: { currency: channel === "ge" ? "GE" : "CNY", amount: 999999 },
});
const point = (amount, changes = {}) => ({
  amountMinor: amount,
  regularAmountMinor: amount,
  observedAt: "2026-11-09T11:00:00Z",
  checkedAt: "2026-11-09T11:00:00Z",
  sourceUrl: "https://store.gaijin.net/",
  evidenceKind: "direct_quote",
  ...changes,
});
const summary = (id, amount, changes = {}, offerChanges = {}) => ({
  vehicleId: id,
  offers: [
    {
      id,
      productId: id,
      currency: "CNY",
      platform: "gaijin_pc",
      conditions: "普通单件购买",
      region: "CN",
      contentVersion: "current",
      latest: point(amount, changes),
      minimum: null,
      firstObservedAt: null,
      sampleCount: 1,
      available: true,
      points: [],
      ...offerChanges,
    },
  ],
});
const calculate = (watches, summaries = [], extra = {}) =>
  homeWatchTotals(watches, {
    now,
    summaries: new Map(summaries.map((s) => [s.vehicleId, s])),
    ...extra,
  });
assert.equal(calculate([vehicle("a")], [summary("a", 12345)]).cny, 12345n);
const many = Array.from({ length: 9 }, (_, i) => vehicle(String(i)));
assert.equal(
  calculate(
    many,
    many.map((v) => summary(v.id, 101)),
  ).cny,
  909n,
  "all watched vehicles, not first UI page",
);
const ge = summary("gold", 500, {}, { currency: "GE" });
const mixed = calculate([vehicle("a"), vehicle("gold", "ge")], [summary("a", 12345), ge]);
assert.equal(mixed.cny, 12345n);
assert.equal(mixed.ge, 500n);
const huge = calculate(
  [vehicle("large-a"), vehicle("large-b")],
  [summary("large-a", Number.MAX_SAFE_INTEGER), summary("large-b", Number.MAX_SAFE_INTEGER)],
);
assert.equal(huge.cny, BigInt(Number.MAX_SAFE_INTEGER) * 2n);
const same = summary("b", 12345, {}, { productId: "a" });
const dedup = calculate([vehicle("a"), vehicle("b", "pack", "a")], [summary("a", 12345), same]);
assert.equal(dedup.cny, 12345n);
assert.equal(dedup.duplicates, 1);
const conflict = calculate(
  [vehicle("a"), vehicle("b", "pack", "a")],
  [summary("a", 12345), summary("b", 9999, {}, { productId: "a" })],
);
assert.equal(conflict.cny, null);
assert.equal(conflict.conflicts, 1);
assert.equal(
  calculate([vehicle("missing")]).cny,
  null,
  "saved originalPrice is not current fallback",
);
assert.equal(
  calculate([vehicle("gone")], [summary("gone", 100, {}, { available: false })]).unavailable,
  1,
);
const fallback = (watch) => ({
  known: true,
  unit: {
    id: "fixture",
    name: "fixture",
    kind: "pack",
    packPrice: {
      status: "priced",
      amountCents: 54321,
      productId: watch.id,
      checkedAt: "2026-11-01",
      source: "https://store.gaijin.net/",
    },
  },
});
assert.equal(calculate([vehicle("fallback")], [], { fallback }).cny, 54321n);
assert.equal(
  calculate([vehicle("fallback")], [summary("fallback", 12345)], { fallback }).cny,
  12345n,
  "summary supersedes canonical",
);
assert.equal(
  calculate([vehicle("fallback")], [summary("fallback", 12345, {}, { available: false })], {
    fallback,
  }).cny,
  null,
  "unavailable never falls back",
);
const event = {
  id: "sale",
  status: "confirmed",
  startAt: "2026-11-09T10:00:00Z",
  endAt: "2026-11-09T14:00:00Z",
  countries: [],
  categories: [],
  channels: ["pack"],
  coverage: "explicit",
  vehicleIds: ["a"],
  excludedVehicleIds: [],
  sources: [],
};
const discounted = summary("a", 5000, {
  regularAmountMinor: 10000,
  eventId: "sale",
  discountPercent: 50,
});
assert.equal(calculate([vehicle("a")], [discounted], { events: [event] }).cny, 5000n);
assert.equal(
  calculate([vehicle("a")], [discounted]).cny,
  null,
  "old or unconfirmed promotion isn't current",
);
assert.equal(
  calculate([vehicle("a")], [discounted], { events: [{ ...event, endAt: "2026-11-09T11:30:00Z" }] })
    .cny,
  null,
);
assert.equal(
  calculate(
    [vehicle("a")],
    [
      summary("a", 5000, {
        regularAmountMinor: 10000,
        eventId: "sale",
        evidenceKind: "official_announcement_derived",
      }),
    ],
    { events: [event] },
  ).cny,
  null,
  "no announcement estimate",
);
assert.equal(calculate([vehicle("bad")], [summary("bad", Number.MAX_SAFE_INTEGER + 1)]).cny, null);
assert.equal(calculate([vehicle("a")], [summary("a", 100)]).checkedAt.cny, "2026-11-09T11:00:00Z");
console.log(
  "Home watch totals: all items, separated currencies, BigInt, SKU deduplication, conflicts, unavailable, current measured promotion and canonical fallback checks passed.",
);
const linkOnly = calculate(
  [vehicle("link-a", "pack", "shared"), vehicle("link-b", "pack", "shared")],
  [
    summary("link-a", 101, {}, { productId: null }),
    summary("link-b", 101, {}, { productId: null }),
  ],
);
assert.equal(linkOnly.cny, 101n);
assert.equal(linkOnly.duplicates, 1, "purchase URL deduplicates without offer SKU");
const partial = calculate(
  [vehicle("known"), vehicle("unknown"), vehicle("gold", "ge")],
  [summary("known", 101), ge],
);
assert.equal(partial.cny, null);
assert.equal(partial.knownCny, 101n);
assert.equal(partial.ge, 500n);
assert.equal(
  calculate([vehicle("gone")], [summary("gone", 100, { available: false })], { fallback })
    .unavailable,
  1,
  "latest unavailable observation cannot revive an old price",
);
const alternate = {
  vehicleId: "dual",
  offers: [
    summary("dual", 10000).offers[0],
    summary("dual", 800, {}, { currency: "GE" }).offers[0],
  ],
};
const geChannel = calculate([vehicle("dual", "ge")], [alternate]);
assert.equal(geChannel.ge, 800n);
assert.equal(geChannel.cny, 0n, "GE watch cannot become a cash pack");
const cashChannel = calculate([vehicle("dual")], [alternate]);
assert.equal(cashChannel.cny, 10000n);
assert.equal(cashChannel.ge, 0n, "cash watch cannot become GE");
assert.equal(
  calculate([vehicle("wrong-ge", "ge")], [summary("wrong-ge", 123)]).ge,
  null,
  "cash-only summary leaves GE unknown",
);
assert.equal(
  calculate([vehicle("wrong-cash")], [summary("wrong-cash", 123, {}, { currency: "GE" })]).cny,
  null,
  "GE-only summary leaves cash unknown",
);
assert.equal(
  calculate(
    [vehicle("wrong-sku")],
    [summary("wrong-sku", 123, {}, { productId: "another-product" })],
  ).cny,
  null,
  "different SKU is not this purchase",
);
const goldFallback = () => ({
  known: true,
  unit: {
    id: "gold",
    name: "gold",
    kind: "gold",
    price: 900,
    gePrice: { source: "https://warthunder.com/", checkedAt: "2026-11-08T10:00:00Z" },
  },
});
const goldCanonical = calculate([vehicle("gold", "ge")], [], { fallback: goldFallback });
assert.equal(goldCanonical.ge, 900n);
assert.equal(goldCanonical.checkedAt.ge, "2026-11-08T10:00:00Z");
