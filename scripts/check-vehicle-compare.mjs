/** Comparison-pool and sourced-value invariants; no network or browser. */
import assert from "node:assert/strict";
import display from "../data/ground-combat-display.json" with { type: "json" };
import { equipmentLabel, equipmentValue, equipmentParameter } from "../src/vehicle-equipment.ts";
import {
  addComparedVehicle,
  comparedVehicleKey,
  removeComparedVehicles,
  VEHICLE_COMPARE_LIMIT,
  spadedValue,
  comparisonMetricRows,
  shellPenetration,
  setComparedVehicleBaseline,
} from "../src/vehicle-compare.ts";
import {
  supportedLoadoutWeapons,
  supportedWeaponGroups,
} from "../src/supported-loadout-weapons.ts";

const entry = (id, category = "ground", country = "usa") => ({
  country,
  category,
  unit: { id, name: id },
});
let pool = [];
for (let index = 0; index < 5; index++) pool = addComparedVehicle(pool, entry(`unit-${index}`));
assert.equal(pool.length, VEHICLE_COMPARE_LIMIT);
assert.strictEqual(addComparedVehicle(pool, entry("overflow")), pool);
assert.strictEqual(addComparedVehicle(pool, pool[0]), pool);
assert.strictEqual(addComparedVehicle(pool, entry("plane", "aviation")), pool);
const directRemoval = removeComparedVehicles(pool, new Set([comparedVehicleKey(pool[0])]));
assert.equal(directRemoval.length, 4);
assert.equal(directRemoval[0].unit.id, "unit-1", "Removing a card promotes the next baseline");
assert.deepEqual(display.distancesM, [500, 1000, 2000]);
const baseline = setComparedVehicleBaseline(pool, comparedVehicleKey(pool[3]));
assert.deepEqual(
  baseline.map((item) => item.unit.id),
  ["unit-3", "unit-0", "unit-1", "unit-2", "unit-4"],
);
assert.strictEqual(setComparedVehicleBaseline(baseline, comparedVehicleKey(baseline[0])), baseline);
assert.strictEqual(setComparedVehicleBaseline(baseline, "missing"), baseline);
assert.strictEqual(baseline[0], pool[3], "Changing baseline preserves the selected unit snapshots");
let smaller = removeComparedVehicles(
  pool,
  new Set([comparedVehicleKey(pool[0]), comparedVehicleKey(pool[3])]),
);
assert.deepEqual(
  smaller.map((value) => value.unit.id),
  ["unit-1", "unit-2", "unit-4"],
);
assert.equal(smaller[0].category, "ground");
assert.strictEqual(addComparedVehicle(smaller, entry("boat", "boats")), smaller);
assert.strictEqual(addComparedVehicle(smaller, smaller[0]), smaller);
smaller = addComparedVehicle(smaller, entry("other-country", "ground", "germany"));
assert.equal(smaller.length, 4);
let empty = removeComparedVehicles(smaller, new Set(smaller.map(comparedVehicleKey)));
assert.equal(empty.length, 0);
assert.equal(addComparedVehicle(empty, entry("first-plane", "aviation"))[0].category, "aviation");
for (const category of ["ground", "aviation", "helicopters", "ships", "boats"]) {
  const first = [entry("baseline", category)];
  for (const other of ["ground", "aviation", "helicopters", "ships", "boats"].filter(
    (value) => value !== category,
  ))
    assert.strictEqual(addComparedVehicle(first, entry("incompatible", other)), first);
}

const metric = {
  id: "speed",
  label: "最大速度",
  unit: "km/h",
  modes: { rb: { stock: 100, spaded: 0, expert: 500, ace: 900 } },
};
assert.equal(spadedValue(metric, "rb"), 0, "Zero is a known value");
assert.equal(spadedValue(metric, "ab"), null, "Do not substitute another mode");
assert.equal(
  spadedValue(
    { ...metric, modes: { rb: { stock: 100, spaded: null, expert: 500, ace: 900 } } },
    "rb",
  ),
  null,
  "Do not substitute stock or crew-qualified endpoints",
);
assert.equal(spadedValue(undefined, "rb"), null);
assert.equal(
  comparisonMetricRows([
    {
      ...entry("a"),
      unit: { id: "a", wikiDetails: { performance: { status: "available", metrics: [metric] } } },
    },
    {
      ...entry("b"),
      unit: {
        id: "b",
        wikiDetails: {
          performance: { status: "available", metrics: [metric, { ...metric, unit: "m/s" }] },
        },
      },
    },
  ]).length,
  2,
  "Different units must not be aligned into the same row",
);
const weaponMetric = (id, weaponName, slot, value, label = "装填时间") => ({
  id,
  weaponName,
  label: `${label} · 武器${slot}`,
  unit: "s",
  direction: "lower",
  modes: {
    ab: { stock: value, spaded: value, expert: null, ace: null },
    rb: { stock: value, spaded: value, expert: null, ace: null },
  },
});
const cannonA = weaponMetric("reload", "120 mm Example A cannon", 1, 7);
const mgA = weaponMetric("reload-2", "12.7 mm Example A machine gun", 2, 10);
const cannonB = weaponMetric("reload", "125 mm Example B cannon", 1, 6);
// Legacy parsing omitted the fixed main-gun reload, so the first reload belongs to an MG.
const mgB = weaponMetric("reload", "12.7 mm Example B machine gun", 2, 9);
const armedEntry = (id, metrics, weapons = []) => ({
  ...entry(id),
  unit: {
    id,
    wikiDetails: {
      performance: {
        status: "available",
        metrics,
        groundCombat: { weaponsStatus: "available", weapons },
      },
    },
  },
});
const armedRows = comparisonMetricRows([
  armedEntry("first", [cannonA, mgA]),
  armedEntry(
    "second",
    [mgB],
    [
      { name: cannonB.weaponName, reload: cannonB },
      { name: mgB.weaponName, reload: mgB },
    ],
  ),
]);
assert.deepEqual(
  armedRows
    .find((row) => row.key.endsWith(":primary:cannon"))
    .metrics.map((item) => spadedValue(item, "rb")),
  [7, 6],
);
assert.deepEqual(
  armedRows
    .find((row) => row.key.endsWith(":machine-gun:12.7"))
    .metrics.map((item) => spadedValue(item, "rb")),
  [10, 9],
);
const missingMain = comparisonMetricRows([
  armedEntry("first", [cannonA]),
  armedEntry("second", [mgB]),
]);
assert.equal(
  missingMain.find((row) => row.key.endsWith(":primary:cannon")).metrics[1],
  undefined,
  "An MG must never fill a missing main-gun value",
);
const mainMg = weaponMetric("reload", "12.7 mm Primary machine gun", 1, 5);
assert.equal(
  comparisonMetricRows([armedEntry("first", [cannonA]), armedEntry("second", [mainMg])]).length,
  2,
  "Primary cannons and primary MGs have different roles",
);
const nativeMissing = {
  ...cannonB,
  modes: {
    ab: { stock: null, spaded: null, expert: null, ace: null },
    rb: { stock: null, spaded: null, expert: null, ace: null },
  },
};
const preserveNative = comparisonMetricRows([
  armedEntry("native", [nativeMissing], [{ name: cannonB.weaponName, reload: cannonB }]),
]);
assert.equal(
  spadedValue(preserveNative[0].metrics[0], "rb"),
  null,
  "Do not replace explicit current unknowns with an older extension",
);
const coaxA = weaponMetric("reload-3", "7.62 mm A machine gun (coaxial)", 3, 12);
const coaxB = weaponMetric("reload-2", "7.62 mm B machine gun (coaxial)", 2, 11);
assert.equal(
  comparisonMetricRows([armedEntry("a", [coaxA]), armedEntry("b", [coaxB])]).length,
  1,
  "Coaxial role survives different source slot numbers",
);
for (const kind of ["fire-rate", "turret-rotation-horizontal", "turret-rotation-vertical"]) {
  const sameType = comparisonMetricRows([
    armedEntry("a", [{ ...cannonA, id: kind }]),
    armedEntry("b", [{ ...cannonB, id: kind + "-2" }]),
  ]);
  assert.equal(sameType.length, 1, `${kind} aligns by role, not occurrence number`);
}
const shell = {
  penetration: [{ distanceM: 10, mm: 0 }],
  penetrationAngles: [{ distanceM: 10, angleDeg: 60, mm: 12 }],
};
assert.equal(shellPenetration(shell, 10, "source"), 0);
assert.equal(shellPenetration(shell, 10, "60"), 12);
assert.equal(
  shellPenetration(shell, 10, "30"),
  null,
  "Do not invent an angle from the default column",
);
assert.equal(shellPenetration(shell, 500, "source"), null);
assert.equal(shellPenetration(undefined, 10, "source"), null);
assert.equal(equipmentLabel("Radar · Band"), "雷达 · 频段");
assert.equal(equipmentValue("No"), "否", "Explicit absence must not appear as a capability");
assert.equal(equipmentValue("Yes · Separate antennas"), "是 · 独立天线");
const equipmentUnit = {
  wikiDetails: {
    performance: {
      equipment: {
        status: "available",
        features: [{ kind: "radar", parameters: [{ id: "tws", value: "No" }] }],
      },
    },
  },
};
assert.equal(equipmentParameter(equipmentUnit, "radar", "tws"), "No");
assert.equal(equipmentParameter(equipmentUnit, "radar", "model"), null);
assert.equal(equipmentParameter(equipmentUnit, "radar_warning", "model"), null);
const loadout = {
  status: "available",
  hardpoints: [{ id: "p1" }, { id: "p2" }],
  compatibility: [
    {
      name: "2 × Example air-to-air missiles",
      weaponId: "shared",
      count: 2,
      stations: [{ hardpointId: "p1", count: 2 }],
      parameters: [],
    },
    {
      name: "Example air-to-air missiles",
      weaponId: "shared",
      count: 1,
      stations: [{ hardpointId: "p2", count: 1 }],
      parameters: [],
    },
    {
      name: "Example-B air-to-air missiles",
      weaponId: "shared",
      count: 1,
      stations: [{ hardpointId: "p1", count: 1 }],
      parameters: [],
    },
    {
      name: "Unavailable bomb",
      weaponId: "bad",
      count: 1,
      stations: [{ hardpointId: "unknown", count: 1 }],
      parameters: [],
    },
    {
      name: "Zero bomb",
      weaponId: "zero",
      count: 0,
      stations: [{ hardpointId: "p1", count: 0 }],
      parameters: [],
    },
  ],
  presets: [
    {
      label: "Preset 1",
      items: [
        { name: "2 × Example air-to-air missiles", weaponId: "shared", count: 2 },
        { name: "Example air-to-air missiles", weaponId: null, count: 1 },
        { name: "Preset-only bomb", weaponId: "preset", count: 1 },
      ],
    },
  ],
};
const supported = supportedLoadoutWeapons(loadout);
assert.equal(
  supported.length,
  3,
  "Deduplicate rack quantities without losing same-ID variants or preset-only weapons",
);
assert.deepEqual(supported[0].hardpoints, ["p1", "p2"]);
assert.deepEqual(supported[0].presets, ["Preset 1"]);
assert.equal(supportedWeaponGroups(supported).flatMap((group) => group.items).length, 3);
assert.equal(supportedLoadoutWeapons({ ...loadout, status: "parse_failed" }).length, 0);
assert.equal(supportedLoadoutWeapons(undefined).length, 0);
console.log(
  "Vehicle comparison verified: branch/cap/identity, direct deletion, baseline switching, spaded values, penetration angles, equipment, supported weapons and weapon-role metric alignment.",
);
