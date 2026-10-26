import assert from "node:assert/strict";

const stages = ["stock", "spaded", "expert", "ace"];
const statuses = [
  "available",
  "none",
  "not_provided",
  "parse_failed",
  "not_collected",
  "not_applicable",
];
const text = (value) => assert(typeof value === "string" && value.length > 0);
const finiteOrNull = (value) => assert(value === null || Number.isFinite(value));
const nonnegativeOrNull = (value) => {
  finiteOrNull(value);
  assert(value === null || value >= 0);
};
function unique(items, key) {
  assert.equal(new Set(items.map((item) => item[key])).size, items.length, `Duplicate ${key}`);
}
function source(value, id) {
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.vehicleId, id);
  assert.equal(value.source, `https://wiki.warthunder.com/unit/${id}`);
  assert.match(value.htmlSha256, /^[a-f0-9]{64}$/);
  assert(Number.isFinite(Date.parse(value.checkedAt)));
  text(value.parserVersion);
  assert(statuses.includes(value.status));
}
function weapon(value) {
  text(value.name);
  nonnegativeOrNull(value.count);
  if (value.source)
    assert.match(
      value.source,
      /^https:\/\/wiki\.warthunder\.com\/collections\/weapon\/[a-zA-Z0-9_/-]+$/,
    );
  if (value.imageUrl)
    assert.match(
      value.imageUrl,
      /^https:\/\/static\.encyclopedia\.warthunder\.com\/gui_skin\/[a-zA-Z0-9_.-]+$/,
    );
  for (const parameter of value.parameters || []) {
    text(parameter.id);
    text(parameter.label);
    text(parameter.value);
  }
}
/** Block malformed/new Wiki structures before they enter hashed country modules. */
export function checkVehicleReference(vehicles) {
  let performance = 0,
    loadouts = 0;
  for (const [id, details] of Object.entries(vehicles)) {
    if (details.performance) {
      const data = details.performance;
      source(data, id);
      unique(data.metrics, "id");
      if (data.status === "available") assert(data.metrics.length > 0);
      for (const metric of data.metrics) {
        text(metric.id);
        text(metric.label);
        text(metric.unit);
        nonnegativeOrNull(metric.altitudeM);
        assert.equal(typeof metric.crewDependent, "boolean");
        assert([undefined, null, "higher", "lower"].includes(metric.direction));
        assert(Object.keys(metric.modes).length > 0);
        for (const [mode, values] of Object.entries(metric.modes)) {
          assert(["ab", "rb"].includes(mode));
          assert.deepEqual(Object.keys(values).sort(), [...stages].sort());
          for (const stage of stages) {
            finiteOrNull(values[stage]);
            if (values[stage] !== null) text(metric.sourceBasis[stage]);
          }
          if (!metric.crewDependent) {
            assert.equal(values.expert, values.spaded);
            assert.equal(values.ace, values.spaded);
          }
        }
      }
      performance++;
    }
    if (details.loadouts) {
      const data = details.loadouts;
      source(data, id);
      unique(data.hardpoints, "id");
      unique(data.compatibility, "optionId");
      unique(data.presets, "id");
      const points = new Set(data.hardpoints.map((point) => point.id));
      for (const point of data.hardpoints) {
        text(point.id);
        text(point.label);
        assert([undefined, null, "left", "right", "center"].includes(point.side));
      }
      for (const limit of data.limits) {
        text(limit.id);
        text(limit.label);
        text(limit.unit);
        nonnegativeOrNull(limit.value);
      }
      for (const option of data.compatibility) {
        weapon(option);
        nonnegativeOrNull(option.weightKg);
        unique(option.stations, "hardpointId");
        for (const station of option.stations) {
          assert(points.has(station.hardpointId));
          nonnegativeOrNull(station.count);
        }
      }
      for (const preset of data.presets) {
        text(preset.id);
        text(preset.label);
        for (const item of preset.items) weapon(item);
      }
      if (data.status === "available") assert(data.hardpoints.length || data.presets.length);
      loadouts++;
    }
  }
  console.log(
    `Vehicle reference validated: ${performance} performance / ${loadouts} loadout records`,
  );
}
