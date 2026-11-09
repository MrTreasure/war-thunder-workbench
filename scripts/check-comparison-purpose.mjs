/** Purpose summaries and plan comparisons must not fabricate missing values or mutate plans. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compareLoadoutPlans, planComparisonProblem } from "../src/loadout-plan-comparison.ts";
import { loadoutRevision, optionKey } from "../src/loadouts.ts";
import { vehiclePurposeSummary, purposeMetric } from "../src/comparison-purpose.ts";
const records = JSON.parse(
  await readFile(new URL("../data/vehicle-details.json", import.meta.url), "utf8"),
).vehicles;
const data = Object.values(records)
  .map((item) => item.loadouts)
  .find(
    (item) =>
      item?.status === "available" &&
      item.hardpoints.length &&
      item.compatibility.some(
        (option) =>
          option.weightKg !== null && option.stations.some((station) => station.count > 0),
      ),
  );
assert(data, "canonical data contains a comparable aircraft");
const option = data.compatibility.find(
  (item) => item.weightKg !== null && item.stations.some((station) => station.count > 0),
);
const station = option.stations.find((item) => item.count > 0);
const base = {
  schemaVersion: 1,
  id: "empty",
  name: "empty",
  country: "usa",
  vehicleId: data.vehicleId,
  sourceHash: loadoutRevision(data),
  sourceDate: data.checkedAt,
  updatedAt: data.checkedAt,
  mounts: [],
  preset: null,
};
const loaded = {
  ...base,
  id: "loaded",
  name: "loaded",
  mounts: [{ station: station.hardpointId, option: optionKey(option) }],
};
const plans = [base, loaded];
const snapshot = JSON.stringify(plans);
const result = compareLoadoutPlans(plans, data, "10.0");
assert.equal(result.problem, "");
assert.equal(result.entries.length, 2);
assert.equal(result.entries[0].check.weightKg, 0, "known empty assignment is zero");
assert.equal(
  result.entries[1].weapons[0].count,
  station.count,
  "source station quantity is retained",
);
assert.equal(
  result.entries[1].check.weightKg,
  Math.round(((option.weightKg * station.count) / (option.count ?? 1)) * 1000) / 1000,
  "uses existing combined rack weight calculation",
);
assert.equal(JSON.stringify(plans), snapshot, "comparison never edits saved plans");
for (const invalid of [
  [base],
  [base, { ...loaded, vehicleId: "other" }],
  [base, { ...loaded, country: "other" }],
  [base, { ...loaded, sourceHash: "b".repeat(64) }],
  Array(5).fill(base),
]) {
  assert(planComparisonProblem(invalid));
  assert.equal(compareLoadoutPlans(invalid, data).entries.length, 0);
}
assert.equal(
  compareLoadoutPlans(plans, { ...data, checkedAt: "2026-11-09T00:00:00Z" }).entries.length,
  0,
  "source revision changes block reinterpretation",
);
const unknownData = structuredClone(data);
const unknownOption = unknownData.compatibility.find(
  (item) => optionKey(item) === optionKey(option),
);
unknownOption.stations.find((item) => item.hardpointId === station.hardpointId).count = null;
unknownOption.weightKg = null;
const unknownPlans = plans.map((plan) => ({
  ...plan,
  sourceHash: loadoutRevision(unknownData),
  mounts: plan.mounts.map((mount) => ({ ...mount, option: optionKey(unknownOption) })),
}));
const unknown = compareLoadoutPlans(unknownPlans, unknownData);
assert.equal(unknown.entries[1].weapons[0].count, null);
assert.equal(unknown.entries[1].check.weightKg, null);
const metric = (value, altitudeM = null) => ({
  id: "max-speed",
  altitudeM,
  modes: { rb: { spaded: value } },
});
const row = { key: "speed", label: "极速", unit: "km/h", metrics: [metric(100), metric(110)] };
assert(purposeMetric(row, ["max-speed"]));
assert.match(vehiclePurposeSummary([row], 1, "rb"), /增加 10/);
assert.match(
  vehiclePurposeSummary([{ ...row, metrics: [metric(100, 1000), metric(110, 2000)] }], 1, "rb"),
  /测定高度不同/,
);
assert.doesNotMatch(
  vehiclePurposeSummary([{ ...row, metrics: [metric(100), metric(null)] }], 1, "rb"),
  /减少 100/,
);
assert.match(
  vehiclePurposeSummary([{ ...row, metrics: [metric(100), metric(0)] }], 1, "rb"),
  /减少 100/,
);
console.log(
  "Purpose comparisons: version isolation, unknown values, source quantities, rack weight, immutability and altitude checks passed.",
);
