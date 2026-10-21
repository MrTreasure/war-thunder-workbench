import { readFile, writeFile } from "node:fs/promises";
const read = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const tree = await read("data/trees.json"),
  loc = (await read("data/localization.json")).entries;
const labels = {};
function walk(v, country, category) {
  if (Array.isArray(v)) v.forEach((x) => walk(x, country, category));
  else if (v && typeof v === "object") {
    if (v.id && v.role && v.br) {
      const raw = loc["units:" + v.id + "_shop"]?.chineseRaw || v.name || v.id;
      labels[v.id.toLowerCase()] = {
        id: v.id,
        name: raw.replace(/[\u200b\ufeff]/g, ""),
        country,
        category,
        rank: v.rank,
        br: v.br,
      };
    }
    Object.values(v).forEach((x) => walk(x, country, category));
  }
}
for (const [category, countries] of Object.entries(tree.trees))
  for (const [country, value] of Object.entries(countries)) walk(value, country, category);
const output = new URL("../../war-thunder-stats-service/data/", import.meta.url);
for (const [name, value] of Object.entries({
  "vehicle-labels.json": labels,
  "report-assets.json": await read("data/player-report-assets.json"),
  "stats-rules.json": await read("data/player-stats-rules.json"),
}))
  await writeFile(new URL(name, output), JSON.stringify(value));
console.log("Prepared stats service metadata:", Object.keys(labels).length, "vehicles");
