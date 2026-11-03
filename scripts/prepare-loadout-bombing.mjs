/** Offline derivation from verified public game snapshots already stored in artifacts.
 * Inputs: root-tree, base-template, explosive, armorclasses, warpoints, econweaponutils, weaponrytooltippkg [--write].
 * Never collects, schedules or publishes. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  write = args.includes("--write");
const inputs = args.filter((arg) => arg !== "--write");
if (inputs.length !== 7)
  throw Error(
    "Expected root-tree, base, explosive, armour, warpoints and both native GUI source snapshots.",
  );
const root = resolve(import.meta.dirname, "..");
for (const input of inputs)
  if (!resolve(input).startsWith(resolve(root, "artifacts") + "/"))
    throw Error("Inputs must be ignored local artifacts.");
const bytes = await Promise.all(inputs.map((path) => readFile(path)));
const commit = JSON.parse(bytes[0]).sha;
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Expected full source commit.");
const template = JSON.parse(bytes[1]),
  explosive = JSON.parse(bytes[2]);
const armor = JSON.parse(bytes[3]).bombing_zone;
const reward = JSON.parse(bytes[4]).BombingRewardMultipliers;
const economy = bytes[5].toString(),
  tooltip = bytes[6].toString();
const decoration = Number(tooltip.match(/UI_BASE_REWARD_DECORATION\s*=\s*([\d.]+)/)?.[1]);
if (
  !economy.includes("function getPresetRewardMul(") ||
  !economy.includes('unitClass == "exp_fighter"') ||
  !economy.includes("min(presetRewardMul, 1.0)") ||
  !tooltip.includes(
    "getPresetRewardMul(unit.name, estimatedDamageToBase) * UI_BASE_REWARD_DECORATION",
  ) ||
  !(decoration > 0)
)
  throw Error("Native reward algorithm changed; review its semantics before updating the model.");
const tiers = [
  [0, 3],
  [4, 7],
  [8, 11],
  [12, 16],
  [17, 20],
  [21, 50],
].map(([from, to]) => {
  const rule = template.triggers.bdt_balance_routine[`bomb_areas_${from}_${to}_check`];
  if (rule.actions.varSetReal.var !== "bdt_base_hp" || !(rule.actions.varSetReal.value > 0))
    throw Error("Base rule changed; manual review required.");
  const rating = (index) => +(1 + Math.floor(index / 3) + [0, 0.3, 0.7][index % 3]).toFixed(1);
  return {
    rankMin: from,
    rankMax: to,
    brMin: rating(from),
    brMax: to === 50 ? null : rating(to),
    hitPoints: rule.actions.varSetReal.value,
  };
});
const areas = [];
function scan(value) {
  if (!value || typeof value !== "object") return;
  if (value.missionSetBombingArea?.var_value === "bdt_base_hp")
    areas.push(value.missionSetBombingArea);
  for (const child of Object.values(value)) scan(child);
}
scan(template);
const fire = areas[0]?.hpFireMult;
if (
  areas.length !== 2 ||
  !Number.isFinite(fire) ||
  fire < 0 ||
  fire >= 1 ||
  areas.some((area) => area.hpFireMult !== fire)
)
  throw Error("Base burnout rules differ or are missing.");
const curve = Object.values(explosive.explosiveTypeToSplashParams.explosiveMassToDamage);
const penetration = Object.values(explosive.explosiveTypeToSplashParams.explosiveMassToPenetration);
for (const points of [curve, penetration])
  if (
    !points.every(
      ([mass, value], index) => mass > 0 && value > 0 && (!index || mass > points[index - 1][0]),
    )
  )
    throw Error("Invalid explosion curve.");
if (
  !(armor.armorThickness > 0) ||
  !(armor.restrainExplosionDamage >= 0) ||
  !(reward.presetDmgMax > reward.presetDmgMin) ||
  !(reward.presetDmgMin > 1) ||
  !(reward.bombingRewardModifier > 1)
)
  throw Error("Invalid target or reward rules.");
const existing = JSON.parse(await readFile(resolve(root, "data/loadout-bombing.json")));
const paths = [
  [
    "战区耐久与燃烧自毁参数",
    "mis.vromfs.bin_u/gamedata/missions/templates/enduring_confrontation/bdt_bases_destroy_template.blkx",
  ],
  ["炸弹伤害与穿深曲线", "aces.vromfs.bin_u/gamedata/damage_model/explosive.blkx"],
  ["战区装甲参数", "aces.vromfs.bin_u/gamedata/flightmodels/dm/armorclasses.blkx"],
  ["战区收益参数", "char.vromfs.bin_u/config/warpoints.blkx"],
  ["游戏收益系数算法", "gui.vromfs.bin_u/globals/econweaponutils.nut"],
  ["游戏系数显示口径", "gui.vromfs.bin_u/scripts/weaponry/weaponrytooltippkg.nut"],
];
const value = {
  ...existing,
  checkedAt: new Date().toISOString(),
  sourceCommit: commit,
  sources: paths.map(([label, path], index) => ({
    label,
    url: `https://github.com/gszabi99/War-Thunder-Datamine/blob/${commit}/${path}`,
    bytes: bytes[index + 1].length,
    sha256: createHash("sha256")
      .update(bytes[index + 1])
      .digest("hex"),
  })),
  tiers,
  tntToBlastDamage: curve,
  tntToPenetration: penetration,
  baseBurnoutFraction: fire,
  baseArmor: {
    thicknessMm: armor.armorThickness,
    restrainExplosionDamage: armor.restrainExplosionDamage,
  },
  reward: {
    presetDamageMin: reward.presetDmgMin,
    presetDamageMax: reward.presetDmgMax,
    bombingModifier: reward.bombingRewardModifier,
    fighterMultiplier: reward.fighterBombingRewardMul,
    premiumMultiplier: reward.premBombingRewardMul,
    uiDecoration: decoration,
    piecewiseLinear: reward.piecewiseLinearTable.v,
  },
  verifiedConventionalBaseModel: true,
  verifiedFullGameDamage: false,
};
const target = resolve(
  root,
  write ? "data/loadout-bombing.json" : "artifacts/loadout-bombing-candidate.json",
);
await writeFile(target, JSON.stringify(value, null, 2) + "\n");
console.log(
  `Prepared ${tiers.length} durability tiers, damage/penetration curves, ${fire * 100}% burnout threshold and native reward rules. ${write ? "Canonical updated by explicit flag." : "Candidate only."} No publication.`,
);
