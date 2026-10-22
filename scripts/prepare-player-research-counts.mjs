import { readFile, writeFile } from "node:fs/promises";
const read = async (path) =>
  JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const catalog = await read("data/generated/catalog.json"),
  settings = await read("data/catalog-settings.json");
const countries = {};
const researchVehicleIds = {};
for (const country of Object.keys(settings.countries)) {
  const categories = {};
  const categoryIds = {};
  for (const category of Object.keys(settings.categories)) {
    const tree = catalog.trees[category]?.[country];
    if (!tree) {
      categories[category] = null;
      categoryIds[category] = null;
      continue;
    }
    const ids = new Set();
    for (const rank of tree.ranks)
      for (const node of rank.research) {
        for (const vehicle of node.variant ? node.members.slice(0, 1) : node.members)
          ids.add(vehicle.id);
      }
    categories[category] = ids.size;
    categoryIds[category] = [...ids];
  }
  countries[country] = categories;
  researchVehicleIds[country] = categoryIds;
}
const data = {
  schemaVersion: 1,
  checkedAt: catalog.checkedAt,
  sources: catalog.sources,
  categories: settings.categories,
  countryNames: settings.countries,
  countries,
  researchVehicleIds,
  basis:
    "当前常规科技树可研发项目，包含初始载具和文件夹成员；组合载具按一个研发项目计数，不含金鹰、礼包、联队及活动等特种载具。无科技树的国家军种为 null。",
};
const body = JSON.stringify(data, null, 2) + "\n";
await writeFile(new URL("../data/player-research-counts.json", import.meta.url), body);
if (!process.argv.includes("--local-only"))
  await writeFile(
    new URL("../../war-thunder-stats-service/data/player-research-counts.json", import.meta.url),
    body,
  );
console.log(
  "Prepared verified researchable counts for all ten countries and five categories; no publication performed.",
);
