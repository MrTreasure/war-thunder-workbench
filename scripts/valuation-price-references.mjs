import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Historical acquisition prices apply only to account valuation. They do not
// change whether a vehicle is currently sold in the tree or shopping planner.
export function applyValuationPriceReferences(catalog, references) {
  if (references.schemaVersion !== 1 || !Array.isArray(references.vehicles))
    throw new Error("Invalid valuation price reference schema");
  const seen = new Set();
  for (const reference of references.vehicles) {
    const { id, channel, source, checkedAt, sha256 } = reference;
    const unit = catalog.units[id];
    const url = new URL(source);
    if (
      !unit ||
      seen.has(id) ||
      url.protocol !== "https:" ||
      !["wiki.warthunder.com", "warthunder.com", "store.gaijin.net", "trade.gaijin.net"].includes(
        url.hostname,
      ) ||
      !Number.isFinite(Date.parse(checkedAt)) ||
      !/^[a-f0-9]{64}$/.test(sha256)
    )
      throw new Error(`Invalid valuation price evidence: ${id}`);
    seen.add(id);
    // A later verified current catalogue quote takes precedence over a
    // historical fallback. Explicit administrator policies are applied later
    // by the service and remain authoritative as well.
    if (
      (unit.kind === "gold" && Number.isSafeInteger(unit.ge) && unit.ge > 0) ||
      (unit.pack?.status === "priced" && unit.pack.regularAmountCents > 0)
    )
      continue;
    if (channel === "ge") {
      if (!Number.isSafeInteger(reference.ge) || reference.ge <= 0)
        throw new Error(`Invalid historical GE price: ${id}`);
      Object.assign(unit, {
        kind: "gold",
        ge: reference.ge,
        geSource: source,
        geCheckedAt: checkedAt,
        store: null,
        pack: null,
        market: null,
      });
    } else if (channel === "market") {
      if (url.hostname !== "trade.gaijin.net" || !url.pathname.startsWith("/market/1067/"))
        throw new Error(`Invalid official market item: ${id}`);
      Object.assign(unit, { kind: "market", market: source, store: null, pack: null, ge: null });
    } else if (channel === "pack") {
      const pack = reference.pack;
      if (
        !pack ||
        pack.currency !== "CNY" ||
        !Number.isSafeInteger(pack.regularAmountCents) ||
        pack.regularAmountCents <= 0 ||
        !/^\d+$/.test(pack.productId) ||
        !pack.title
      )
        throw new Error(`Invalid historical whole pack price: ${id}`);
      Object.assign(unit, {
        kind: "pack",
        ge: null,
        market: null,
        store: `https://store.gaijin.net/story.php?id=${pack.productId}`,
        pack: {
          ...pack,
          status: "priced",
          amountCents: pack.regularAmountCents,
          source,
          checkedAt,
          sha256,
        },
      });
    } else throw new Error(`Unknown valuation price channel: ${channel}`);
    unit.valuationPriceReference = reference;
  }
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output)
    throw new Error("Usage: node scripts/valuation-price-references.mjs <catalog> <output>");
  const catalog = JSON.parse(await readFile(input, "utf8"));
  const references = JSON.parse(
    await readFile(
      new URL("../data/account-valuation-price-references.json", import.meta.url),
      "utf8",
    ),
  );
  await writeFile(output, JSON.stringify(applyValuationPriceReferences(catalog, references)));
  console.log(`Applied ${references.vehicles.length} reviewed valuation price references`);
}
