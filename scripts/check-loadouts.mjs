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
  hasConfigurableLoadout,
  stationLoadoutOptions,
} from "../src/loadouts.ts";
import {
  loadoutWeaponName,
  loadoutParameterValue,
  matchesLoadoutText,
} from "../src/loadout-presentation.ts";
import {
  missileBrief,
  comparedMissile,
  selectComparedMissile,
  missileComparisonRows,
  isComparableMissile,
} from "../src/loadout-weapon-details.ts";

import { matchesWeaponFilters, availableWeaponFamilies } from "../src/loadout-weapon-filters.ts";

assert(matchesWeaponFilters("PL-12 air-to-air missiles", "missile", "pl"));
assert(matchesWeaponFilters("PL-8 air-to-air missiles", "missile", "pl"));
assert(matchesWeaponFilters("PL-8B air-to-air missiles", "missile", "pl"));
assert(matchesLoadoutText("PL-8B air-to-air missiles", "PL8"));
assert(matchesLoadoutText("AIM-54C Phoenix air-to-air missiles", "AIM 54"));

assert(matchesWeaponFilters("R-27ER1 air-to-air missiles", "missile", "r"));
assert(matchesWeaponFilters("RVV-AE air-to-air missiles", "missile", "r"));
assert(!matchesWeaponFilters("RBS 70 missiles", "missile", "r"));
assert(matchesWeaponFilters("AIM-54C Phoenix air-to-air missiles", "missile", "phoenix"));
assert(matchesWeaponFilters("AIM-54C", "missile", "phoenix"));
assert(matchesWeaponFilters("GBU-8", "bomb", "gbu"));
assert(!matchesWeaponFilters("Mk.108 cannons", "", "mk"));
const mixed = "AIM-9M Sidewinder air-to-air missiles2 × GBU-12 Paveway II bombs";
assert(matchesWeaponFilters(mixed, "missile", "sidewinder"));
assert(matchesWeaponFilters(mixed, "bomb", "gbu"));
assert.deepEqual(
  availableWeaponFamilies([mixed], "bomb").map((family) => family.id),
  ["gbu", "paveway"],
);
assert(!matchesWeaponFilters("PL-12 air-to-air missiles", "missile", "unknown-family"));
assert.deepEqual(missileBrief([]), [], "missing summary values are omitted");
const locks = [
  { id: "lock-range", label: "锁定距离", value: "16 km" },
  { id: "lock-range-in-all-aspect", label: "全向锁定距离", value: "5 km" },
];
assert.deepEqual(missileBrief(locks), [{ id: "lock-range", label: "锁定距离", value: "16 km" }]);
assert.equal(
  missileBrief([...locks, { id: "lock-range-in-rear-aspect", label: "尾锁距离", value: "11 km" }])
    .length,
  1,
);
assert.equal(
  missileBrief([
    ...locks,
    { id: "lock-range-in-rear-aspect", label: "尾锁距离", value: "11 km" },
  ])[0].id,
  "lock-range-in-rear-aspect",
);
assert.equal(missileBrief([locks[1]])[0].label, "全向锁定距离");

import { loadoutLibrary, loadoutConfigurationKey } from "../src/loadout-library.ts";
const libraryPlan = {
  id: "private",
  name: "私人标题",
  country: "china",
  vehicleId: "su_30mkk",
  sourceHash: "source-v1",
  preset: null,
  mounts: [
    { station: "t1-s1", option: "a" },
    { station: "t1-s2", option: "b" },
  ],
};
const libraryShare = {
  id: "public",
  listed: true,
  plan: {
    ...libraryPlan,
    id: "public",
    name: "公开标题",
    mounts: [...libraryPlan.mounts].reverse(),
  },
  tags: [],
};
assert.equal(loadoutConfigurationKey(libraryPlan), loadoutConfigurationKey(libraryShare.plan));
let libraryRows = loadoutLibrary([libraryPlan], [libraryShare]);
assert.equal(libraryRows.length, 1, "saved plan and its recommendation render once");
assert.equal(libraryRows[0].plan.name, "私人标题");
assert.equal(libraryRows[0].recommendations.length, 1);
assert.equal(
  loadoutLibrary([libraryPlan], [{ ...libraryShare, listed: false }])[0].recommendations.length,
  0,
);
assert.equal(
  loadoutLibrary([], [libraryShare]).length,
  1,
  "recommended equipment remains accessible after private deletion",
);
assert.equal(
  loadoutLibrary([{ ...libraryPlan, mounts: [] }], [libraryShare]).length,
  2,
  "editing equipment must not label an old recommendation as the new configuration",
);
assert.equal(
  loadoutLibrary([{ ...libraryPlan, sourceHash: "source-v2" }], [libraryShare]).length,
  2,
  "source revisions must not be conflated",
);

import {
  massGrams,
  bombTntGrams,
  blastDamage,
  loadoutBombs,
  allocateBases,
  bombingRules,
  estimateBombingTiers,
} from "../src/loadout-bombing.ts";
assert.equal(massGrams("1,500 kg"), 1_500_000);
assert.equal(massGrams("675 g"), 675);
assert.equal(massGrams("unknown"), null);
assert.equal(
  bombTntGrams([
    { id: "explosive-type", value: "Comp. H6" },
    { id: "explosive-mass", value: "100 kg" },
  ]),
  null,
  "filler mass is not TNT equivalence",
);
assert.equal(
  bombTntGrams([
    { id: "explosive-type", value: "TNT" },
    { id: "explosive-mass", value: "38 kg" },
  ]),
  38_000,
);
assert.equal(bombTntGrams([{ id: "tnt-equivalent", value: "117.6 kg" }]), 117_600);
assert.equal(
  bombTntGrams([
    { id: "tnt-equivalent", value: "2 kg" },
    { id: "tnt-equivalent", value: "5 kg" },
  ]),
  null,
  "mixed parameter sets must not be attributed to one bomb",
);
assert.equal(blastDamage(500_000), 10_000);
assert.equal(blastDamage(600_000), 11_250);
assert.equal(blastDamage(100_000_000), null, "do not extrapolate beyond verified curve");
assert.equal(
  bombingRules.verifiedFullGameDamage,
  false,
  "configuration reference must not claim full game damage",
);
assert.equal(bombingRules.tiers.length, 6);
assert(bombingRules.tiers.every((tier) => tier.hitPoints > 0));
for (let i = 1; i < bombingRules.tntToBlastDamage.length; i++)
  assert(bombingRules.tntToBlastDamage[i][0] > bombingRules.tntToBlastDamage[i - 1][0]);
const bombGroup = (damage, count) => ({
  key: String(damage),
  name: "fixture bomb",
  grams: 1000,
  damage,
  count,
});
assert.equal(
  allocateBases([bombGroup(600, 2)], 1000).count,
  1,
  "whole bomb overkill cannot spill to another base",
);
assert.equal(
  allocateBases([bombGroup(600, 2), bombGroup(400, 2)], 1000).count,
  2,
  "mixed bombs may complete separate bases",
);
assert.equal(
  allocateBases([bombGroup(1500, 2)], 1000).count,
  2,
  "two large bombs cannot make three separate base hits",
);
assert.equal(
  allocateBases([bombGroup(null, 10)], 1000).count,
  0,
  "unknown damage cannot create confirmed capacity",
);

const emptyBombing = { items: [], unknown: [], grams: 0 };
assert(
  estimateBombingTiers(emptyBombing, "8.0").every(
    (row) => row.status === "empty" && row.count === null,
  ),
);
assert.deepEqual(
  estimateBombingTiers(emptyBombing, "3.3")
    .filter((row) => row.relevant)
    .map((row) => row.rankMin),
  [4, 8],
);
assert(estimateBombingTiers(emptyBombing, undefined).every((row) => !row.relevant));
const fabDamage = blastDamage(675_000);
assert.equal(fabDamage, 12_187.5);
const fabEstimate = estimateBombingTiers(
  { items: [{ ...bombGroup(fabDamage, 2), grams: 675_000 }], unknown: [], grams: 1_350_000 },
  "10.3",
);
assert.equal(fabEstimate.filter((row) => row.relevant).length, 1);
assert.equal(fabEstimate.at(-1).status, "unconfirmed");
assert.equal(
  fabEstimate.at(-1).count,
  null,
  "an unverified zero must not become a real-game inability claim",
);
const partialEstimate = estimateBombingTiers(
  { items: [bombGroup(30_000, 2)], unknown: ["missing bomb"], grams: 2000 },
  "10.3",
).at(-1);
assert.equal(partialEstimate.count, 2);
assert.equal(partialEstimate.status, "partial");
assert.equal(
  estimateBombingTiers({ ...emptyBombing, unknown: ["missing bomb"] }, "10.3").at(-1).status,
  "unknown",
);

const catalog = JSON.parse(
  await readFile(new URL("../data/vehicle-details.json", import.meta.url)),
);
const source = catalog.vehicles.su_24m.loadouts;
const su30 = catalog.vehicles.su_30mkk.loadouts;
const bombRack = su30.compatibility.find((item) => item.weaponId === "100kg_ofab100");
const bombPayload = loadoutBombs(
  su30,
  [{ station: bombRack.stations[0].hardpointId, option: optionKey(bombRack) }],
  null,
);
assert.equal(bombPayload.grams, 228_000, "six-bomb rack count must apply once, not twice");
assert.equal(bombPayload.items[0].count, 6);

assert(stationLoadoutOptions(su30, "t1-s1").some((option) => /PL-8/.test(option.name)));
assert(
  !stationLoadoutOptions(su30, "t1-s8").some((option) => /PL-8/.test(option.name)),
  "family filtering must not invent station compatibility",
);

const r73 = catalog.vehicles.j_11.loadouts.compatibility.find((option) =>
  option.name.includes("R-73E"),
);
const brief = missileBrief(r73.parameters);
assert.equal(brief.find((field) => field.id === "lock-range-in-rear-aspect").value, "11 km");
assert.equal(
  brief.find((field) => field.id === "launch-range").value,
  "30 km",
  "launch range must not be confused with maximum overload",
);
assert(isComparableMissile(r73));
assert(!isComparableMissile({ name: "GBU-12 guided bomb" }));
const compared = comparedMissile(r73, source);
let comparison = [];
for (let index = 0; index < 7; index++)
  comparison = selectComparedMissile(
    comparison,
    { ...compared, key: "fixture-" + index, name: "Fixture " + index + " missiles" },
    true,
  );
assert.equal(comparison.length, 6, "comparison has a hard six-model cap");
comparison = selectComparedMissile(comparison, comparison[0], true);
assert.equal(comparison.length, 6, "selecting the same model is idempotent");
comparison = selectComparedMissile(comparison, comparison[0], false);
assert.equal(comparison.length, 5);
assert.equal(
  comparedMissile({ ...r73, name: "2 × " + r73.name }, source).key,
  compared.key,
  "rack counts do not identify distinct missiles",
);
const missing = missileComparisonRows([{ ...compared, parameters: [] }]);
assert(
  missing.every((row) => row.values[0] === null),
  "unknown parameters remain unknown",
);
assert.deepEqual(compared.parameters, r73.parameters);
assert.notEqual(compared.parameters, r73.parameters, "comparison keeps its own source snapshot");
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
assert(hasConfigurableLoadout(contested));
assert(!hasConfigurableLoadout({ ...contested, status: "not_provided" }));
assert(!hasConfigurableLoadout({ ...contested, compatibility: [] }));
assert.equal(stationLoadoutOptions(contested, "t1-s2").length, 0);
assert.equal(loadoutWeaponName("2000 lb LDGP Mk 84 bomb"), "2000 磅 LDGP Mk 84 炸弹");
assert.equal(loadoutWeaponName("R-73E air-to-air missiles"), "R-73E 空对空导弹");
assert.equal(loadoutWeaponName("PL-8B air-to-air missiles"), "PL-8B 空对空导弹");
assert.equal(loadoutParameterValue("16 km"), "16 千米");
const demoTerms = (source) => ({ 空对空导弹: "AAM", 千米: "km" })[source] || source;
assert.equal(loadoutWeaponName("R-73E air-to-air missiles", demoTerms), "R-73E AAM");
assert.equal(loadoutParameterValue("16 km", demoTerms), "16 km");
assert(matchesLoadoutText("PL-8B air-to-air missiles", "AAM", demoTerms));
assert.equal(loadoutParameterValue("IR+IOG+GNSS"), "红外 + 惯性制导 + 卫星导航");
assert(matchesLoadoutText("GBU-12 Paveway II guided bomb", "制导炸弹"));
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
