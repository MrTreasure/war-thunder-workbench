import test from "node:test";
import assert from "node:assert/strict";
import { valuationVehicleOwned } from "../src/valuation-ownership.ts";

test("verified garage entries retain ownership when price groups omit individual flags", () => {
  // Gold, packs, market and manually priced groups can carry only the garage-level flag.
  for (const group of ["gold", "packs", "market", "manual"]) {
    assert.equal(valuationVehicleOwned({}, { verified: true }), true, group);
  }
  assert.equal(valuationVehicleOwned({ owned: null }, { verified: true }), true);
});

test("unverified history, observed vehicles and inferred prerequisites never imply ownership", () => {
  assert.equal(valuationVehicleOwned({}, { verified: false }), false);
  assert.equal(valuationVehicleOwned({}), false);
  assert.equal(valuationVehicleOwned({ owned: null }), false);
});

test("explicit per-vehicle flags take precedence over a list-level flag", () => {
  assert.equal(valuationVehicleOwned({ owned: false }, { verified: true }), false);
  assert.equal(valuationVehicleOwned({ owned: true }, { verified: false }), true);
});
