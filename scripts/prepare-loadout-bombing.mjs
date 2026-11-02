/** Offline derivation only. Inputs are public configuration snapshots saved in ignored artifacts.
 * Usage: node scripts/prepare-loadout-bombing.mjs <root-tree.json> <base-template.blkx> <explosive.blkx> [--write]
 * Default writes a candidate under artifacts; never collects or publishes. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  write = args.includes("--write");
const inputs = args.filter((arg) => arg !== "--write");
if (inputs.length !== 3) throw Error("Expected root-tree, base-template and explosive snapshots.");
const root = resolve(import.meta.dirname, "..");
for (const input of inputs)
  if (!resolve(input).startsWith(resolve(root, "artifacts") + "/"))
    throw Error("Inputs must be ignored local artifacts.");
const [tree, base, explosive] = await Promise.all(inputs.map((input) => readFile(input)));
const commit = JSON.parse(tree).sha;
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Expected full source commit.");
const template = JSON.parse(base),
  curves = JSON.parse(explosive);
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
const curve = Object.values(curves.explosiveTypeToSplashParams.explosiveMassToDamage);
if (
  !curve.every(
    ([mass, damage], index) => mass > 0 && damage > 0 && (!index || mass > curve[index - 1][0]),
  )
)
  throw Error("Invalid explosion curve.");
const existing = JSON.parse(await readFile(resolve(root, "data/loadout-bombing.json")));
const paths = [
  "mis.vromfs.bin_u/gamedata/missions/templates/enduring_confrontation/bdt_bases_destroy_template.blkx",
  "aces.vromfs.bin_u/gamedata/damage_model/explosive.blkx",
];
const value = {
  ...existing,
  checkedAt: new Date().toISOString(),
  sourceCommit: commit,
  sources: [base, explosive].map((bytes, index) => ({
    url: `https://github.com/gszabi99/War-Thunder-Datamine/blob/${commit}/${paths[index]}`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })),
  tiers,
  tntToBlastDamage: curve,
  verifiedFullGameDamage: false,
};
const target = resolve(
  root,
  write ? "data/loadout-bombing.json" : "artifacts/loadout-bombing-candidate.json",
);
await writeFile(target, JSON.stringify(value, null, 2) + "\n");
console.log(
  `${tiers.length} durability tiers and ${curve.length} curve points prepared; full damage model remains unverified. ${write ? "Canonical data updated after explicit write flag." : "Candidate only."} No publication.`,
);
