import { prepareAppearance } from "./prepare-appearance.mjs";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
await prepareAppearance(root);
const json = async (name) => JSON.parse(await readFile(resolve(root, "data", name), "utf8"));
const [trees, research, purchases, planning, flags, taxonomy] = await Promise.all(
  [
    "trees.json",
    "research.json",
    "purchases.json",
    "planning.json",
    "flags.json",
    "taxonomy.json",
  ].map(json),
);
let modifications = {};
try {
  modifications = await json("modifications.json");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const localization = await json("localization.json");
const settings = await json("catalog-settings.json");
const lineup = await json("lineup-rules.json");
const lineupCodebook = await json("lineup-codebook.json");
const storePrices = await json("store-prices.json");
const localized = (value, proof) => {
  value.nameEn = value.name;
  value.nameZhCN = proof?.nameZhCN || null;
  value.nameJa = proof?.nameEn === value.name ? proof.nameJa || null : null;
  value.nameRu = proof?.nameEn === value.name ? proof.nameRu || null : null;
  if (proof?.nameEn === value.name && proof.nameZhCN) {
    value.name = proof.nameZhCN;
    value.localizationKey = proof.entry;
  }
};
for (const row of Object.values(modifications))
  for (const item of row.items)
    localized(item, localization.modifications[item.id + "\t" + item.name]);
const catalog = { schemaVersion: 1, ...trees, flags, planning, ...taxonomy, lineup };
for (const [category, values] of Object.entries(catalog.trees))
  for (const [country, tree] of Object.entries(values)) {
    if (!tree) continue;
    for (const rank of tree.ranks.slice(0, -1))
      if (!Number.isInteger(planning.gates?.[category]?.[country]?.[rank.rank]))
        throw Error(`Missing gate ${category}/${country}/${rank.rank}`);
    for (const rank of tree.ranks)
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members) {
          localized(unit, localization.vehicles[unit.id]);
          unit.imageUrl = settings.vehicleImageTemplate.replace(
            "{id}",
            encodeURIComponent(unit.id),
          );
          unit.thumbnailUrl = settings.vehicleThumbnailTemplate.replace(
            "{id}",
            encodeURIComponent(unit.id),
          );
          const rp = research[unit.id];
          if (Number.isSafeInteger(rp?.rp) && rp.rp >= 0) {
            unit.rp = rp.rp;
            unit.rpCheckedAt = rp.checkedAt;
          }
          const proof = purchases[unit.id];
          if (proof) {
            unit.store = proof.store || null;
            unit.market = proof.market || null;
            if (unit.kind !== "gold" && unit.kind !== "squadron") {
              unit.kind = unit.premium
                ? proof.store
                  ? "pack"
                  : proof.market
                    ? "market"
                    : "premium"
                : proof.market
                  ? "market"
                  : "special";
            }
          }
          if (unit.kind === "pack" && unit.store) {
            const productId = new URL(unit.store).searchParams.get("id");
            const price = storePrices.products[productId];
            if (!price) throw Error(`Missing pack price check: ${unit.id}/${productId}`);
            unit.packPrice = price;
          }
        }
  }
for (const countries of Object.values(catalog.trees))
  for (const tree of Object.values(countries)) {
    if (!tree) continue;
    for (const rank of tree.ranks)
      for (const node of [...rank.research, ...rank.special]) {
        if (node.group && localization.groups[node.id])
          localized(node, localization.groups[node.id]);
        else {
          node.name = node.members[0].name;
          node.nameEn = node.members[0].nameEn;
          node.nameRu = node.members[0].nameRu;
          node.nameJa = node.members[0].nameJa;
        }
      }
  }
await rm(resolve(root, "public/data"), { recursive: true, force: true });
await rm(resolve(root, "src/generated/countries"), { recursive: true, force: true });
await mkdir(resolve(root, "src/generated/countries"), { recursive: true });
await mkdir(resolve(root, "data/generated/countries"), { recursive: true });
await mkdir(resolve(root, "src/generated"), { recursive: true });
await mkdir(resolve(root, "data/generated"), { recursive: true });
// The complete snapshot is for build-time checks only; it is never published.
await writeFile(resolve(root, "data/generated/catalog.json"), JSON.stringify(catalog) + "\n");
const { trees: allTrees, audit, ...metadata } = catalog;
const bootstrap = {
  ...metadata,
  availability: Object.fromEntries(
    Object.entries(allTrees).map(([category, countries]) => [
      category,
      Object.fromEntries(
        Object.entries(countries).map(([country, tree]) => [country, Boolean(tree)]),
      ),
    ]),
  ),
};
const manifest = { schemaVersion: 3, countries: {} };
const countryModules = [];
async function emit(key, body) {
  const content = JSON.stringify(body) + "\n",
    sha256 = createHash("sha256").update(content).digest("hex");
  const stem = `${key}.${sha256.slice(0, 16)}`;
  const file = `${stem}.js`;
  // JSON remains the canonical/cache representation; only JS transport is published.
  await writeFile(resolve(root, "data/generated/countries", `${stem}.json`), content);
  await writeFile(
    resolve(root, "src/generated/countries", `${stem}.ts`),
    `export default ${JSON.stringify(content)};\n`,
  );
  countryModules.push(`${JSON.stringify(key)}: () => import("./countries/${stem}")`);
  return { key, file, sha256, bytes: Buffer.byteLength(content) };
}
for (const country of Object.keys(catalog.countries)) {
  const nationTrees = {};
  const units = {};
  for (const category of Object.keys(catalog.categories)) {
    const tree = allTrees[category][country];
    nationTrees[category] = tree;
    if (!tree) continue;
    for (const rank of tree.ranks)
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members)
          if (modifications[unit.id]) units[unit.id] = modifications[unit.id];
  }
  manifest.countries[country] = await emit(`country-${country}`, {
    schemaVersion: 2,
    country,
    checkedAt: catalog.checkedAt,
    trees: nationTrees,
    modifications: units,
    lineupCodes: lineupCodebook.countries[country],
  });
}
await writeFile(
  resolve(root, "src/generated/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(resolve(root, "src/generated/bootstrap.json"), JSON.stringify(bootstrap) + "\n");
await writeFile(
  resolve(root, "src/generated/country-modules.ts"),
  `// Generated: load only the selected country's transport module.\nexport const countryModules: Record<string, () => Promise<{ default: string }>> = {\n${countryModules.join(",\n")}\n};\n`,
);
console.log(
  `Prepared ${catalog.audit.length} national trees in one file per country (all categories and modifications); no full catalog is published.`,
);
