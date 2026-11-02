/** Deterministic rule, assignment and share checks; no network or browser. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkLoadout,
  solveLoadout,
  optionKey,
  presetKey,
  weaponKey,
  encodeLoadout,
  decodeLoadout,
  validLoadoutPlan,
} from "../src/loadouts.ts";

const catalog = JSON.parse(
  await readFile(new URL("../data/vehicle-details.json", import.meta.url)),
);
const source = catalog.vehicles.su_24m.loadouts;
const base = {
  ...source,
  rules: [],
  presets: [],
  limits: [],
  hardpoints: [
    { id: "t1-s1", label: "1", side: "left" },
    { id: "t1-s2", label: "2", side: "right" },
  ],
};
const option = (name, points, weight = 10, count = 1) => ({
  optionId: name,
  weaponId: null,
  name,
  count,
  weightKg: weight,
  parameters: [],
  stations: points.map((hardpointId) => ({ hardpointId, count })),
});
const a = option("Weapon A", ["t1-s1"]),
  b = option("Weapon B", ["t1-s1"]);
const contested = { ...base, compatibility: [a, b] };
assert.equal(
  solveLoadout(contested, [
    { weapon: weaponKey(a.name), count: 1 },
    { weapon: weaponKey(b.name), count: 1 },
  ]).state,
  "unmatched",
  "independent availability cannot share a pylon",
);
const balanced = {
  ...base,
  limits: [{ id: "wing-max-difference", label: "差值", value: 0, unit: "kg" }],
  compatibility: [a, option("Weapon B", ["t1-s2"])],
};
const solution = solveLoadout(balanced, [
  { weapon: weaponKey(a.name), count: 1 },
  { weapon: weaponKey(b.name), count: 1 },
]);
assert.equal(
  solution.state,
  "found",
  "an intermediate imbalance can be repaired by later stations",
);
assert.equal(checkLoadout(balanced, solution.mounts).issues.length, 0);
const balancedExtra = solveLoadout(balanced, [{ weapon: weaponKey(a.name), count: 1 }]);
assert.equal(balancedExtra.state, "found", "an unrequested load may be required for wing balance");
assert.equal(balancedExtra.mounts.length, 2);
const tiny = {
  ...balanced,
  limits: [{ id: "max-weight", label: "上限", value: 19.999, unit: "kg" }],
};
assert.equal(
  solveLoadout(tiny, [
    { weapon: weaponKey(a.name), count: 1 },
    { weapon: weaponKey(b.name), count: 1 },
  ]).state,
  "unmatched",
);
const pod = option("4 × Missile C", ["t1-s1"], 40.4, 4);
const loaded = checkLoadout({ ...base, compatibility: [pod] }, [
  { station: "t1-s1", option: optionKey(pod) },
]);
assert.equal(loaded.weightKg, 40.4, "rack mass is already the whole option mass");
assert.equal(loaded.weapons[0].count, 4);
assert.equal(
  solveLoadout({ ...base, compatibility: [{ ...pod, weightKg: null }] }, [
    { weapon: weaponKey(pod.name), count: 4 },
  ]).state,
  "incomplete",
);
const kh = source.compatibility.find((o) => o.name === "Kh-29TE missiles");
const kab = source.compatibility.find((o) => o.name.includes("KAB-500Kr-M"));
assert(
  checkLoadout(source, [
    { station: "t1-s4", option: optionKey(kh) },
    { station: "t1-s1", option: optionKey(kab) },
  ]).issues.some((i) => i.code === "su24m-kh29te-kab500krm"),
);
const presetData = {
  ...base,
  hardpoints: [],
  compatibility: [],
  presets: [
    { id: "1", label: "1", items: [{ name: a.name, count: 1, weaponId: null }] },
    { id: "2", label: "2", items: [{ name: b.name, count: 1, weaponId: null }] },
  ],
};
assert.equal(
  solveLoadout(presetData, [
    { weapon: weaponKey(a.name), count: 1 },
    { weapon: weaponKey(b.name), count: 1 },
  ]).state,
  "unmatched",
  "presets cannot be combined",
);
assert.equal(presetKey(presetData.presets[0]), JSON.stringify([["Weapon A", 1, ""]]));
const duplicateRacks = catalog.vehicles["f-100d"].loadouts.compatibility.filter(
  (o) => o.name === "19 × FFAR Mighty Mouse rockets",
);
assert.notEqual(
  optionKey(duplicateRacks[0]),
  optionKey(duplicateRacks[1]),
  "different rack masses must retain distinct identities",
);
assert.equal(optionKey({ ...a, optionId: "reordered-row" }), optionKey(a));
const old = { station: "t1-s1", option: "o1:" + "0".repeat(64) };
assert(checkLoadout(contested, [old]).issues.some((i) => i.code === "missing-option"));
const plan = {
  schemaVersion: 1,
  id: "sample",
  name: "测试方案",
  country: "ussr",
  vehicleId: "su_24m",
  sourceHash: source.htmlSha256,
  sourceDate: source.checkedAt,
  mounts: [{ station: "t1-s4", option: optionKey(kh) }],
  preset: null,
  updatedAt: new Date().toISOString(),
};
assert(validLoadoutPlan(plan));
assert(!validLoadoutPlan({ ...plan, mounts: [...plan.mounts, ...plan.mounts] }));
assert(!validLoadoutPlan({ ...plan, preset: "anything" }));
const encoded = await encodeLoadout(plan);
assert.deepEqual(await decodeLoadout(encoded), plan);
await assert.rejects(() => decodeLoadout(encoded.slice(0, -4) + "AAAA"));
await assert.rejects(() => decodeLoadout("WTL1." + "x".repeat(90000)));
// Check all matrix choices, so source duplicates or naming variants cannot
// silently turn individual valid options into unusable configurations.
let inspected = 0;
for (const details of Object.values(catalog.vehicles)) {
  const data = details.loadouts;
  if (!data?.hardpoints.length) continue;
  for (const o of data.compatibility)
    for (const station of o.stations) {
      const check = checkLoadout(data, [{ station: station.hardpointId, option: optionKey(o) }]);
      assert(
        !check.issues.some((i) => i.code === "missing-option"),
        `${data.vehicleId}/${o.optionId}`,
      );
      inspected++;
    }
}
console.log(
  `Loadout checks passed: shared-station conflicts, imbalance recovery, rack counts/mass, source exclusions, whole presets, stable identities, bounded share imports; ${inspected} source station-options resolved.`,
);
