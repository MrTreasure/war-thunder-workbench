import assert from "node:assert/strict";
import { build } from "vite";
import { resolve } from "node:path";
const bundled = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: false,
    lib: { entry: resolve("src/home-dashboard-model.ts"), formats: ["es"] },
  },
});
const code = (Array.isArray(bundled) ? bundled[0] : bundled).output.find(
  (item) => item.type === "chunk",
).code;
const { homeDashboardSummary, HOME_SUMMARY_LIMIT, homeWatchPresentation, homeResearchStatus } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
assert.equal(HOME_SUMMARY_LIMIT, 4);
assert.deepEqual(homeDashboardSummary({}), { plans: [], lineups: [], loadouts: [], watches: [] });
const plan = { target: "test_target", progress: 0, owned: [], pins: [], banned: [] };
const documents = {
  "wt-planner-v1:ground:usa": plan,
  "wt-planner-v1:ground:unknown": plan,
  "wt-planner-v1:ground:usa:other-user": plan,
  "wt-lineups-v1:usa": [
    {
      id: "lineup",
      name: "My lineup",
      slots: ["test_target", ...Array(10).fill(null)],
      battleType: "ground",
      activeAircraft: null,
    },
  ],
  "wt-workbench-cart-v1": [
    {
      lines: [
        { country: "usa", category: "ground", unitId: "test_target", name: "Saved target" },
        { country: "germany", category: "ground", unitId: "test_target", name: "Wrong country" },
      ],
    },
  ],
};
const before = JSON.stringify(documents);
const result = homeDashboardSummary(documents);
assert.equal(result.plans.length, 1);
assert.equal(result.plans[0].targetName, "Saved target");
assert.equal(Object.hasOwn(result.plans[0], "progress"), false);
assert.equal(result.lineups.length, 1);
assert.equal(result.lineups[0].vehicles, 1);
assert.equal(
  JSON.stringify(documents),
  before,
  "reading the dashboard cannot modify saved documents",
);
assert.equal(
  homeDashboardSummary({ "wt-planner-v1:ground:usa": plan }).plans[0].targetName,
  null,
  "missing names remain unknown",
);
assert.equal(
  homeDashboardSummary({ "wt-planner-v1:ground:usa": { ...plan, progress: -1 } }).plans.length,
  0,
);
assert.equal(
  homeDashboardSummary({
    "wt-planner-v1:ground:usa": {
      ...plan,
      target: "us_m1a2_sep2_abrams_trophy",
      targetName: "us_m1a2_sep2_abrams_trophy",
    },
  }).plans[0].targetName,
  "M1A2/战利品-HV",
  "verified Chinese names override legacy internal IDs",
);
assert.equal(
  homeDashboardSummary({ "wt-planner-v1:ground:china": { ...plan, target: "cn_ztz_99a" } }).plans[0]
    .targetName,
  "ZTZ99A",
  "retain the game's verified Chinese model designation",
);
const watched = {
  id: "ussr_t_80ue1",
  country: "ussr",
  category: "ground",
  channel: "pack",
  name: "stale name",
  rank: "VII",
  originalPrice: { currency: "CNY", amount: 123 },
};
const watchBefore = JSON.stringify(watched),
  card = homeWatchPresentation(watched);
assert.equal(card.known, true);
assert.equal(card.unit.kind, "pack");
assert.equal(card.unit.premium, true);
assert(Number.isFinite(card.unit.br.rb));
assert.equal(card.flag.id, "russia");
assert.equal(
  JSON.stringify(watched),
  watchBefore,
  "display facts never overwrite a saved watch quote",
);
assert.equal(homeWatchPresentation({ ...watched, id: "not_a_real_vehicle" }).known, false);
console.log(
  "Home summary checks passed: valid scopes, empty state, exact saved names, unknown names, counts, and read-only behavior.",
);

assert.deepEqual(homeResearchStatus("cn_ztz_99a", null), {
  state: "garage-required",
  remaining: null,
});
assert.deepEqual(homeResearchStatus("unknown", []), { state: "unknown", remaining: null });
assert.deepEqual(homeResearchStatus("cn_ztz_99a", ["cn_ztz_99a"]), {
  state: "owned",
  remaining: 0,
});
const { readFileSync } = await import("node:fs");
const entries = JSON.parse(readFileSync("data/home-vehicle-names.json", "utf8")).vehicles;
const chain = [];
let parent = entries.cn_ztz_99a.parentId;
while (parent && entries[parent]?.research) {
  chain.push(parent);
  parent = entries[parent].parentId;
}
assert(chain.length > 0);
assert.deepEqual(homeResearchStatus("cn_ztz_99a", []), {
  state: "prerequisites",
  remaining: chain.length,
});
assert.deepEqual(homeResearchStatus("cn_ztz_99a", chain), { state: "researching", remaining: 0 });
assert.deepEqual(homeResearchStatus("cn_ztz_99a", chain.slice(1)), {
  state: "prerequisites",
  remaining: 1,
});
console.log(
  "Garage prerequisite checks passed: unknown, owned, remaining ancestors and ready for research.",
);
const { homeQueryQuota, homeRecentQueries } = await import("../src/home-activity-model.ts");
const quota = homeQueryQuota({
  limits: { queryLimit: 5 },
  query: { used: 2, reserved: 1 },
  credits: { enabled: true, total: 30, remaining: 23, costs: { query: 1 } },
});
assert.equal(quota.dailyRemaining, 2);
assert.equal(quota.creditRemaining, 23);
assert.equal(homeQueryQuota(null), null);
assert.equal(
  homeQueryQuota({ limits: { queryLimit: null }, query: { used: 2, reserved: 1 } }).dailyRemaining,
  null,
);
const recent = homeRecentQueries(
  Array.from({ length: 6 }, (_, i) => ({
    uid: String(i + 1),
    nickname: "test",
    snapshotId: "snap_abcdefghijk",
    fetchedAt: "2026-11-09T00:00:00Z",
  })),
);
assert.equal(recent.length, 4);
assert.deepEqual(recent[0].restore, { snapshot: "snap_abcdefghijk", uid: "1" });
assert(!Object.hasOwn(recent[0].restore, "player"));
console.log(
  "Home query checks passed: reserved quota, separate credit balance and restore-only history links.",
);
