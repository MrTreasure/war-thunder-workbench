import { readFile, writeFile } from "node:fs/promises";
import { applyValuationPriceReferences } from "./valuation-price-references.mjs";
const read = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const catalog = await read("data/generated/catalog.json");
const research = await read("data/research.json");
const purchases = await read("data/purchases.json");
const units = {},
  aliases = {},
  markets = [];
for (const [category, countries] of Object.entries(catalog.trees)) {
  for (const [country, tree] of Object.entries(countries)) {
    if (!tree) continue;
    for (const rank of tree.ranks) {
      for (const node of [...rank.research, ...rank.special]) {
        aliases[node.id] = node.members[0].id;
        for (const v of node.members) aliases[v.id] = node.variant ? node.members[0].id : v.id;
      }
    }
    for (const rank of tree.ranks)
      for (const node of [...rank.research, ...rank.special]) {
        for (const v of node.members) {
          if (node.variant && v.id !== node.members[0].id) continue;
          const proof = purchases[v.id] || {};
          const req = v.req || (v.id === node.members[0].id ? node.req : null);
          units[v.id] = {
            id: v.id,
            name: v.name,
            category,
            country,
            rank: rank.rank,
            kind: v.kind,
            side: v.side,
            parent: req ? aliases[req] || req : null,
            rp: v.rp ?? null,
            rpSource: research[v.id]?.source || null,
            rpCheckedAt: research[v.id]?.checkedAt || null,
            ge: v.kind === "gold" ? v.price : null,
            geSource: catalog.sources[category]?.url,
            geCheckedAt: catalog.checkedAt,
            pack: v.store ? v.packPrice || null : null,
            store: v.store,
            market: v.market,
          };
          if (proof.market)
            markets.push({
              vehicleId: v.id,
              name: v.name,
              source: proof.market,
              averageGjnCents: null,
              checkedAt: null,
              sampleCount: null,
              method: null,
            });
        }
      }
  }
}
const output = new URL("../../war-thunder-stats-service/data/", import.meta.url);
const valuationCatalog = applyValuationPriceReferences(
  { schemaVersion: 1, units, aliases },
  await read("data/account-valuation-price-references.json"),
);
// Include reviewed historical market associations without changing purchase
// availability in the public research tree. Maintained DB quotes remain intact.
for (const unit of Object.values(units)) {
  if (unit.market && !markets.some((entry) => entry.vehicleId === unit.id))
    markets.push({
      vehicleId: unit.id,
      name: unit.name,
      source: unit.market,
      averageGjnCents: null,
      checkedAt: null,
      sampleCount: null,
      method: null,
    });
}
await writeFile(new URL("valuation-catalog.json", output), JSON.stringify(valuationCatalog));
await writeFile(
  new URL("valuation-rules.json", output),
  JSON.stringify(await read("data/account-valuation-rules.json")),
);
// Acquisition metadata is versioned independently of financial basis/cache keys.
await writeFile(
  new URL("valuation-vehicle-policies.json", output),
  JSON.stringify(await read("data/account-vehicle-policies.json")),
);
// Initial unknown quotes remain null. The database is authoritative for maintained market averages.
await writeFile(new URL("valuation-market-seed.json", output), JSON.stringify(markets));
console.log(
  `Prepared valuation catalog: ${Object.keys(units).length} vehicles, ${markets.length} market entries`,
);
