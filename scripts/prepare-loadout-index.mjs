/** Derive the preview read model from existing prepared Wiki country data.
 * No network request or independent collection is performed. */
import { readFile, writeFile, mkdir, rename, chmod } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const output = process.argv[2];
if (!output || !resolve(output).startsWith(resolve(root, "artifacts") + "/"))
  throw Error("Output must be an ignored local artifact.");
const catalog = JSON.parse(await readFile(resolve(root, "data/generated/catalog.json"), "utf8"));
const rows = [];
for (const [category, nations] of Object.entries(catalog.trees)) {
  if (!["aviation", "helicopters"].includes(category)) continue;
  for (const [country, tree] of Object.entries(nations)) {
    for (const rank of tree?.ranks || [])
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members) {
          const summary = Object.fromEntries(
            [
              "id",
              "name",
              "nameEn",
              "nameRu",
              "nameJa",
              "rank",
              "br",
              "kind",
              "premium",
              "role",
              "side",
              "imageUrl",
              "thumbnailUrl",
            ]
              .filter((key) => unit[key] !== undefined)
              .map((key) => [key, unit[key]]),
          );
          rows.push({
            summary: { ...summary, country, category },
            loadouts: unit.wikiDetails?.loadouts || null,
          });
        }
  }
}
if (!rows.length) throw Error("Empty prepared catalog.");
await mkdir(dirname(resolve(output)), { recursive: true });
const sharing = JSON.parse(await readFile(resolve(root, "data/lineup-sharing-tags.json"), "utf8"));
const vehicleTags = JSON.parse(await readFile(resolve(root, "data/vehicle-tags.json"), "utf8"));
const titles = JSON.parse(await readFile(resolve(root, "data/game-tag-texts.json"), "utf8"));
const theme = JSON.parse(await readFile(resolve(root, "data/game-tag-theme.json"), "utf8"));
const tagPolicy = JSON.parse(await readFile(resolve(root, "data/game-tag-access.json"), "utf8"));
const tagIDs = [
  ...new Set(
    [...sharing.tags.filter((tag) => !tag.system), ...vehicleTags.tags, ...titles.titles].map(
      (tag) => tag.id,
    ),
  ),
];
await writeFile(
  resolve(output) + ".next",
  JSON.stringify({
    schemaVersion: 1,
    rows,
    tagIDs,
    tagTones: Object.keys(theme.tones),
    tagBase: ["original", "red", ...theme.basicColors],
    tagPolicy,
  }),
);
await rename(resolve(output) + ".next", resolve(output));
await chmod(resolve(output), 0o644);
console.log(
  `Prepared ${rows.length} Wiki aircraft/heli records for isolated preview; no collection performed.`,
);
