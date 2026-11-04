/** Comparison-pool and sourced-value invariants; no network or browser. */
import assert from "node:assert/strict";
import {
  addComparedVehicle,
  comparedVehicleKey,
  removeComparedVehicles,
  VEHICLE_COMPARE_LIMIT,
  spadedValue,
  comparisonMetrics,
  shellPenetration,
} from "../src/vehicle-compare.ts";

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
  comparisonMetrics([
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
console.log(
  "Vehicle comparison verified: same-branch lock, five-vehicle cap, country-independent selection, duplicate rejection, ordered bulk deletion, baseline promotion, spaded-only values, unknown/zero and sourced penetration angles.",
);
