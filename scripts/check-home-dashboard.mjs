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
const { homeDashboardSummary, HOME_SUMMARY_LIMIT } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
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
assert.equal(result.plans[0].progress, 0);
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
console.log(
  "Home summary checks passed: valid scopes, empty state, exact saved names, unknown names, counts, and read-only behavior.",
);
