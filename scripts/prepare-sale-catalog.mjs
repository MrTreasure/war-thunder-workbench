// Server-only search index, prepared from canonical vehicle data; never shipped as public JSON.
import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(await readFile(new URL("../data/trees.json", import.meta.url), "utf8"));
const vehicles = new Map();
function walk(value, country, category) {
  if (Array.isArray(value)) value.forEach((entry) => walk(entry, country, category));
  else if (value && typeof value === "object") {
    if (value.id && value.br && value.side && !value.group) {
      const channel =
        value.kind === "squadron"
          ? "excluded"
          : value.market
            ? "market"
            : value.store
              ? "pack"
              : value.side === "research"
                ? "sl"
                : value.kind === "gold" || (value.premium && value.price != null)
                  ? "ge"
                  : "unknown";
      vehicles.set(value.id, {
        id: value.id,
        name: value.name,
        nameEn: value.nameEn || "",
        country,
        category,
        rank: value.rank,
        kind: value.kind,
        channel,
        image:
          value.thumbnailUrl ||
          value.imageUrl ||
          `https://static.encyclopedia.warthunder.com/slots/${value.id}.png`,
        store: value.store || null,
        market: value.market || null,
      });
    }
    Object.values(value).forEach((entry) => walk(entry, country, category));
  }
}
for (const [category, countries] of Object.entries(source.trees))
  for (const [country, tree] of Object.entries(countries)) walk(tree, country, category);
const result = { checkedAt: source.checkedAt || null, vehicles: [...vehicles.values()] };
await writeFile(
  new URL("../../war-thunder-stats-service/data/sales-vehicles.json", import.meta.url),
  JSON.stringify(result),
);
console.log(`Prepared server-only sale search index: ${vehicles.size} vehicles`);
