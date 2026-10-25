// Shared public vehicle metadata, prepared from the same verified canonical tree.
// Served per country through the existing content-addressed public resource cache.
import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(await readFile(new URL("../data/generated/catalog.json", import.meta.url), "utf8"));
const prices = JSON.parse(
  await readFile(new URL("../data/store-prices.json", import.meta.url), "utf8"),
);
const purchases = JSON.parse(
  await readFile(new URL("../data/purchases.json", import.meta.url), "utf8"),
);
const vehicles = new Map();
function walk(value, country, category) {
  if (Array.isArray(value)) value.forEach((entry) => walk(entry, country, category));
  else if (value && typeof value === "object") {
    if (value.id && value.br && value.side && !value.group) {
      const store = purchases[value.id]?.store || value.store || null;
      const productId = store ? new URL(store).searchParams.get("id") : null;
      const quote = productId ? prices.products[productId] : null;
      const channel =
        value.kind === "squadron"
          ? "excluded"
          : value.market
            ? "market"
            : store
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
        nameRu: value.nameRu || null,
        nameJa: value.nameJa || null,
        nameZhCN: value.nameZhCN || null,
        premium: value.premium,
        role: value.role,
        br: value.br,
        side: value.side,
        rp: value.rp ?? null,
        price: value.price,
        packPrice: value.packPrice || null,
        country,
        category,
        rank: value.rank,
        kind: value.kind,
        channel,
        image:
          value.thumbnailUrl ||
          value.imageUrl ||
          `https://static.encyclopedia.warthunder.com/slots/${value.id}.png`,
        store,
        originalPrice:
          channel === "ge"
            ? {
                currency: "GE",
                amount: Number.isSafeInteger(value.price) && value.price > 0 ? value.price : null,
                checkedAt: source.checkedAt || null,
                source: source.sources?.[category]?.url || null,
              }
            : ["pack", "bundle"].includes(channel)
              ? {
                  currency: "CNY",
                  amount:
                    Number.isSafeInteger(quote?.regularAmountCents) && quote.regularAmountCents > 0
                      ? quote.regularAmountCents
                      : null,
                  checkedAt: quote?.checkedAt || null,
                  source: quote?.source || store,
                }
              : null,
        market: value.market || purchases[value.id]?.market || null,
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
console.log(`Prepared shared country vehicle metadata: ${vehicles.size} vehicles`);
