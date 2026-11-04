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
      if (data.groundCombat) {
        const combat = data.groundCombat;
        source(combat, id);
        assert.equal(combat.parserVersion, "wiki-ground-combat-v1");
        assert(statuses.includes(combat.armorStatus));
        assert(statuses.includes(combat.weaponsStatus));
        for (const type of combat.armorTypes || []) text(type);
        if (combat.equivalentArmorStatus) assert(statuses.includes(combat.equivalentArmorStatus));
        unique(combat.armor, "id");
        unique(combat.weapons, "id");
        for (const row of combat.armor) {
          assert(["hull", "turret"].includes(row.id));
          for (const field of ["label", "front", "side", "rear"]) text(row[field]);
        }
        for (const weapon of combat.weapons) {
          text(weapon.id);
          text(weapon.name);
          nonnegativeOrNull(weapon.ammunition);
          unique(weapon.shells, "id");
          for (const shell of weapon.shells) {
            text(shell.id);
            text(shell.name);
            text(shell.type);
            for (const field of ["caliberMm", "velocityMps", "massKg", "tntKg"])
              nonnegativeOrNull(shell[field]);
            if (shell.imageUrl)
              assert.match(
                shell.imageUrl,
                /^https:\/\/static\.encyclopedia\.warthunder\.com\/gui_skin\/[a-zA-Z0-9_.-]+$/,
              );
            unique(shell.parameters, "id");
            for (const parameter of shell.parameters) {
              text(parameter.id);
              text(parameter.label);
              text(parameter.value);
            }
            for (const point of [...shell.penetration, ...shell.penetrationAngles]) {
              assert(Number.isFinite(point.distanceM) && point.distanceM >= 0);
              nonnegativeOrNull(point.mm);
              if ("angleDeg" in point)
                assert(
                  Number.isFinite(point.angleDeg) && point.angleDeg >= 0 && point.angleDeg <= 90,
                );
            }
          }
        }
        if (combat.armorStatus === "available") assert(combat.armor.length > 0);
        if (combat.weaponsStatus === "available")
          assert(combat.weapons.some((weapon) => weapon.shells.length > 0));
      }
      if (data.equipment) {
        const equipment = data.equipment;
        source(equipment,id);
        assert.equal(equipment.parserVersion,"wiki-vehicle-equipment-v1");
        unique(equipment.features,"id");
        unique(equipment.properties,"id");
        unique(equipment.optics,"id");
        for (const feature of equipment.features) {
          text(feature.id); text(feature.kind); text(feature.name);
          if (feature.source) assert.match(feature.source,/^https:\/\/wiki\.warthunder\.com\/collections\/feature\/[A-Za-z0-9_-]+$/);
          if (feature.weaponName) text(feature.weaponName);
          unique(feature.parameters,"id");
        }
        for (const parameter of [...equipment.properties,...equipment.optics,...equipment.features.flatMap((feature) => feature.parameters)]) {
          text(parameter.id); text(parameter.label); text(parameter.value);
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
      assert([undefined, 1].includes(data.rulesSchemaVersion));
      for (const note of data.constraintNotes || [])
        assert(typeof note === "string" && note.length <= 3000);
      unique(data.rules || [], "id");
      for (const rule of data.rules || []) {
        assert.match(rule.id, /^[a-zA-Z0-9_-]{1,100}$/);
        assert.equal(rule.kind, "exclusive");
        assert(
          Array.isArray(rule.weapons) && rule.weapons.length >= 2 && rule.weapons.length <= 12,
        );
        for (const name of rule.weapons) text(name);
        text(rule.message);
        assert.match(rule.source, /^https:\/\/wiki\.warthunder\.com\//);
        assert(Number.isFinite(Date.parse(rule.checkedAt)));
      }
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
