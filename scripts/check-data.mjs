import { encodeCsv, countryBody } from "../src/country-csv.mjs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import "./check-map-atlas.mjs";
import "./check-ground-maps.mjs";
import "./check-player-medal-details.mjs";
import { checkVehicleReference } from "./check-vehicle-reference.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const manifest = await read("src/generated/manifest.json");
const catalog = await read("data/generated/catalog.json"),
  mods = await read("data/modifications.json");
const settings = await read("data/catalog-settings.json");
const modificationPresentation = await read("data/modification-presentation.json");
const modificationTiers = await read("data/modification-tiers.json");
const localization = await read("data/localization.json");
const lineupRules = await read("data/lineup-rules.json");
const codebook = await read("data/lineup-codebook.json");
const storePrices = await read("data/store-prices.json");
const purchases = await read("data/purchases.json");
const vehicleDetails = await read("data/vehicle-details.json");
assert.equal(vehicleDetails.schemaVersion, 1);
checkVehicleReference(vehicleDetails.vehicles);
for (const [id, details] of Object.entries(vehicleDetails.vehicles)) {
  assert.match(id, /^[a-zA-Z0-9_-]+$/);
  for (const source of [details.purchase, details.rewards].filter(Boolean)) {
    assert.match(
      source.source,
      /^https:\/\/wiki\.warthunder\.com\/(ground|aviation|helicopters|ships|boats|unit\/[a-zA-Z0-9_-]+)$/,
    );
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isFinite(Date.parse(source.checkedAt)));
  }
  if (details.purchase) {
    assert(["SL", "GE"].includes(details.purchase.currency));
    assert(Number.isSafeInteger(details.purchase.amount) && details.purchase.amount >= 0);
  }
  if (details.rewards)
    for (const currency of ["rp", "sl"]) {
      const multiplier = details.rewards[currency];
      assert(
        Number.isFinite(multiplier.factor) && multiplier.factor > 0 && multiplier.factor <= 20,
      );
      assert(Object.keys(multiplier.basePercent).length > 0);
      for (const [mode, base] of Object.entries(multiplier.basePercent)) {
        assert(["ab", "rb", "sb"].includes(mode));
        assert(Number.isFinite(base) && base >= 0 && base <= 10000);
        assert.equal(multiplier.percent[mode], base * multiplier.factor);
      }
    }
}
const priceReport = await read("data/store-prices-report.json");
const leaderboards = await read("data/player-leaderboards.json");
const researchCounts = await read("data/player-research-counts.json");
assert.equal(researchCounts.schemaVersion, 1);
assert.equal(researchCounts.checkedAt, catalog.checkedAt);
assert.deepEqual(researchCounts.sources, catalog.sources);
for (const [country, categories] of Object.entries(researchCounts.countries)) {
  assert(country in settings.countries);
  assert.deepEqual(Object.keys(categories).sort(), Object.keys(settings.categories).sort());
  for (const [category, total] of Object.entries(categories)) {
    const tree = catalog.trees[category]?.[country];
    if (!tree) {
      assert.equal(total, null);
      assert.equal(researchCounts.researchVehicleIds[country][category], null);
      continue;
    }
    const ids = new Set();
    for (const rank of tree.ranks)
      for (const node of rank.research)
        for (const v of node.variant ? node.members.slice(0, 1) : node.members) ids.add(v.id);
    assert.equal(total, ids.size, `${country}/${category}: researchable count drift`);
    assert.deepEqual(researchCounts.researchVehicleIds[country][category], [...ids]);
  }
}
assert.deepEqual(
  Object.keys(researchCounts.countries).sort(),
  Object.keys(settings.countries).sort(),
);
assert.equal(leaderboards.schemaVersion, 1);
assert.equal(leaderboards.boards.length, 6);
assert.equal(new Set(leaderboards.boards.map((b) => `${b.mode}/${b.branch}`)).size, 6);
for (const board of leaderboards.boards) {
  assert(["ab", "rb", "sb"].includes(board.mode));
  assert(["ground", "air"].includes(board.branch));
  assert.equal(board.period, "all-time");
  assert.equal(
    board.metric,
    board.branch === "ground" ? "ground-targets-destroyed" : "air-targets-destroyed",
  );
  assert(Number.isFinite(Date.parse(board.fetchedAt)));
  assert.equal(board.players.length, 30);
  assert.equal(new Set(board.players.map((p) => p.nickname)).size, 30);
  board.players.forEach((p, index) => {
    assert.equal(p.rank, index + 1);
    assert(typeof p.nickname === "string" && p.nickname.length >= 2 && p.nickname.length <= 64);
  });
  assert.equal(board.sources.length, 2);
  board.sources.forEach((source, index) => {
    const url = new URL(source);
    assert.equal(url.origin, "https://warthunder.com");
    assert.equal(url.pathname, "/en/community/leaderboard/");
    assert.equal(
      url.searchParams.get("game"),
      { ab: "arcade", rb: "historical", sb: "simulation" }[board.mode],
    );
    assert.equal(url.searchParams.get("sort"), board.branch === "ground" ? "gtd" : "atd");
    assert.equal(url.searchParams.get("page"), String(index + 1));
  });
}
const valuationRules = await read("data/account-valuation-rules.json");
assert.equal(valuationRules.schemaVersion, 1);
assert.equal(valuationRules.ge.cents, 18900);
assert.equal(valuationRules.ge.units, 5000);
assert.equal(valuationRules.rpUnit, 10000);
assert.equal(valuationRules.scenarios.secondHand.label, "参考价值");
assert.deepEqual(
  new Set(valuationRules.researchRanks),
  new Set(
    Object.values(catalog.trees).flatMap((countries) =>
      Object.values(countries).flatMap((tree) => tree?.ranks.map((rank) => rank.rank) || []),
    ),
  ),
  "Valuation filters must include every canonical research rank",
);
for (const [key, expected] of Object.entries({
  normal: [300, 200, 100],
  discount: [300, 200, 50],
  secondHand: [150, 100, 30],
})) {
  const rule = valuationRules.scenarios[key];
  assert.equal(rule.rpCents.ground, expected[0]);
  assert.equal(rule.rpCents.helicopters, expected[0]);
  assert.equal(rule.rpCents.aviation, expected[1]);
  assert.equal(rule.purchasePercent, expected[2]);
}
const vehiclePolicies = await read("data/account-vehicle-policies.json");
assert.equal(vehiclePolicies.schemaVersion, 1);
assert.equal(
  new Set(vehiclePolicies.vehicles.map((v) => v.id)).size,
  vehiclePolicies.vehicles.length,
);
const canonicalUnitIds = new Set(
  Object.values(catalog.trees).flatMap((countries) =>
    Object.values(countries).flatMap((tree) =>
      tree
        ? tree.ranks.flatMap((rank) =>
            [...rank.research, ...rank.special].flatMap((node) => node.members.map((v) => v.id)),
          )
        : [],
    ),
  ),
);
for (const policy of vehiclePolicies.vehicles) {
  assert(canonicalUnitIds.has(policy.id), `Unknown valuation policy vehicle ${policy.id}`);
  assert(["auto", "exclude", "unpriced"].includes(policy.defaultMode));
  assert.equal(new URL(policy.source).protocol, "https:");
  assert(["wiki.warthunder.com", "warthunder.com"].includes(new URL(policy.source).hostname));
  assert.match(policy.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isFinite(Date.parse(policy.checkedAt)));
  if (policy.classification === "initial_free") assert(policy.freePurchase && policy.rp === 0);
}
for (const id of ["us_m4_sherman_promo", "jp_destroyer_hatsuzuki"])
  assert.equal(vehiclePolicies.vehicles.find((v) => v.id === id)?.defaultMode, "exclude");
for (const id of [
  "germ_panther_ii",
  "germ_pzkpfw_vi_ausf_b_tiger_iih_kwk46",
  "germ_pzkpfw_maus",
  "germ_pzkpfw_e_100",
])
  assert.equal(vehiclePolicies.vehicles.find((v) => v.id === id)?.defaultMode, "unpriced");
assert.equal(storePrices.schemaVersion, 1);
assert.equal(priceReport.errors.length, 0, "Resolve store price refresh errors before publishing");
for (const purchase of Object.values(purchases)) {
  if (!purchase.store) continue;
  const id = new URL(purchase.store).searchParams.get("id");
  const price = storePrices.products[id];
  assert(price, `Missing store price record for ${id}`);
  assert.equal(price.productId, id);
  assert.equal(price.currency, "CNY");
  assert.equal(price.source, `https://store.gaijin.net/story.php?id=${id}&skin_lang=zh`);
  assert.equal(new URL(price.finalUrl).hostname, "store.gaijin.net");
  assert.equal(new URL(price.finalUrl).protocol, "https:");
  assert.match(price.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isFinite(Date.parse(price.checkedAt)));
  if (price.status === "priced") {
    assert(typeof price.title === "string" && price.title.length > 0);
    assert(Number.isSafeInteger(price.amountCents) && price.amountCents > 0);
    assert(
      Number.isSafeInteger(price.regularAmountCents) &&
        price.regularAmountCents >= price.amountCents,
    );
    assert.equal(price.reason, undefined);
  } else {
    assert.equal(price.status, "unavailable");
    assert.equal(price.amountCents, null);
    assert.equal(price.regularAmountCents, null);
    assert(["not_listed", "no_cny_price"].includes(price.reason));
  }
}
assert.deepEqual(
  catalog.categories,
  settings.categories,
  "Catalog categories must match collection settings",
);
assert.deepEqual(Object.keys(catalog.trees).sort(), Object.keys(settings.categories).sort());
for (const category of Object.keys(settings.categories)) {
  assert.deepEqual(
    Object.keys(catalog.trees[category]).sort(),
    Object.keys(settings.countries).sort(),
  );
  assert.equal(catalog.sources[category].url, `https://wiki.warthunder.com/${category}`);
  assert.match(catalog.sources[category].sha256, /^[a-f0-9]{64}$/);
}
assert.equal(codebook.schemaVersion, 1);
assert.equal(lineupRules.schemaVersion, 1);
assert.equal(lineupRules.maxSlots, 11);
assert.equal(lineupRules.emptyCode, "00");
assert.equal(
  lineupRules.alphabet,
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
);
assert.equal(lineupRules.airArcadeRounding, "nearest_step_ties_up");
assert.equal(lineupRules.airArcadeGapSteps, 2);
assert.equal(lineupRules.airArcadeMaxReductionSteps, 1);
assert.equal(lineupRules.navalAircraftMaxExtraSteps, 1);
assert.deepEqual(catalog.lineup, lineupRules);
assert.deepEqual(Object.keys(codebook.countries).sort(), Object.keys(catalog.countries).sort());
assert.deepEqual(
  Object.keys(lineupRules.countryCodes).sort(),
  Object.keys(catalog.countries).sort(),
);
assert.equal(
  new Set(Object.values(lineupRules.countryCodes)).size,
  Object.keys(catalog.countries).length,
);
for (const code of Object.values(lineupRules.countryCodes)) assert.match(code, /^[0-9A-Za-z]{2}$/);
for (const source of lineupRules.sources)
  assert(["wiki.warthunder.com", "warthunder.com"].includes(new URL(source.url).hostname));
assert.equal(new URL(settings.vehicleImageTemplate).hostname, "static.encyclopedia.warthunder.com");
assert.equal(
  new URL(settings.vehicleThumbnailTemplate).hostname,
  "static.encyclopedia.warthunder.com",
);
assert.equal(localization.language, "zh-CN");
assert.equal(localization.column, "<Chinese>");
assert.match(localization.commit, /^[a-f0-9]{40}$/);
assert(Number.isFinite(Date.parse(localization.checkedAt)));
for (const source of Object.values(localization.sources)) {
  assert(source.url.includes(`/${localization.commit}/lang.vromfs.bin_u/lang/`));
  assert(source.url.startsWith("https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/"));
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  assert(source.bytes > 1000000);
}
assert.equal(localization.coverage.categories, Object.keys(settings.categories).length);
for (const [category, key] of Object.entries(settings.categoryLocalizationKeys)) {
  const proof = localization.categories[category];
  assert.equal(proof.entry, `menu:${key}`);
  const entry = localization.entries[proof.entry];
  assert.equal(proof.nameEn, entry.english);
  assert.equal(proof.method, "game_menu_key");
  assert.equal(
    proof.nameZhCN,
    entry.chineseRaw.replaceAll("\u200b", "").replaceAll("\ufeff", "").trim(),
  );
  assert.equal(catalog.categories[category], proof.nameZhCN);
}
function checkName(value, proof, nameEn) {
  assert(proof, `Missing localization mapping: ${nameEn}`);
  assert.equal(proof.nameEn, nameEn);
  assert.equal(value.nameEn, nameEn);
  assert.equal(value.nameZhCN, proof.nameZhCN);
  assert.equal(value.nameRu, proof.nameRu || null);
  assert.equal(value.nameJa, proof.nameJa || null);
  assert.equal(value.name, proof.nameZhCN || nameEn);
  if (proof.nameZhCN) {
    const entry = localization.entries[proof.entry];
    assert(entry, `Missing game language entry: ${proof.entry}`);
    let expected = entry.chineseRaw;
    for (const parameter of proof.parameters) {
      assert.match(parameter, /^\d+(?:\.\d+)?$/);
      expected = expected.replace("%s", parameter);
    }
    assert.equal(expected.replaceAll("\u200b", "").replaceAll("\ufeff", "").trim(), value.nameZhCN);
    if (proof.nameRu) {
      let russian = entry.russianRaw;
      assert.equal(typeof russian, "string");
      for (const parameter of proof.parameters) russian = russian.replace("%s", parameter);
      assert.equal(russian.replaceAll("\u200b", "").replaceAll("\ufeff", "").trim(), value.nameRu);
    }
    if (proof.nameJa) {
      let japanese = entry.japaneseRaw;
      assert.equal(typeof japanese, "string");
      for (const parameter of proof.parameters) japanese = japanese.replace("%s", parameter);
      assert.equal(japanese.replaceAll("\u200b", "").replaceAll("\ufeff", "").trim(), value.nameJa);
    }
    assert.equal(value.localizationKey, proof.entry);
  } else assert(proof.missing);
}
assert.deepEqual(
  localization.coverage.vehicleMissing.sort(),
  Object.entries(localization.vehicles)
    .filter(([, value]) => !value.nameZhCN)
    .map(([id]) => id)
    .sort(),
);
assert.deepEqual(
  localization.coverage.modificationMissing.sort(),
  Object.entries(localization.modifications)
    .filter(([, value]) => !value.nameZhCN)
    .map(([id]) => id)
    .sort(),
);
for (const country of Object.keys(catalog.countries))
  assert.equal(catalog.flags[country], settings.flagSourceTemplate.replace("{country}", country));
const ids = new Set();
let trees = 0;
for (const [category, countries] of Object.entries(catalog.trees))
  for (const [country, tree] of Object.entries(countries)) {
    if (!tree) continue;
    trees++;
    const aliases = new Map(),
      units = new Set();
    for (const rank of tree.ranks)
      for (const node of [...rank.research, ...rank.special]) {
        assert(node.members.length > 0);
        aliases.set(node.id, node.members[0].id);
        for (const unit of node.members) {
          assert(!units.has(unit.id));
          units.add(unit.id);
          ids.add(unit.id);
          aliases.set(unit.id, node.id);
          assert.equal(unit.rank, rank.rank);
          checkName(unit, localization.vehicles[unit.id], unit.nameEn);
          assert.equal(
            unit.imageUrl,
            settings.vehicleMediaOverrides?.[unit.id]?.imageUrl ||
              settings.vehicleImageTemplate.replace("{id}", encodeURIComponent(unit.id)),
          );
          assert.equal(
            unit.thumbnailUrl,
            settings.vehicleMediaOverrides?.[unit.id]?.thumbnailUrl ||
              settings.vehicleThumbnailTemplate.replace("{id}", encodeURIComponent(unit.id)),
          );
          for (const br of Object.values(unit.br)) assert(Number.isSafeInteger(br) && br >= 0);
          if (unit.rp !== undefined) assert(Number.isSafeInteger(unit.rp) && unit.rp >= 0);
          if (unit.kind === "pack") {
            assert(unit.store);
            const id = new URL(unit.store).searchParams.get("id");
            assert.deepEqual(unit.packPrice, storePrices.products[id]);
          } else assert.equal(unit.packPrice, undefined);
        }
      }
    for (const rank of tree.ranks)
      for (const node of rank.research) {
        if (node.req) assert(aliases.has(node.req), `Missing node predecessor ${node.req}`);
        for (const unit of node.members)
          if (unit.req) assert(aliases.has(unit.req), `Missing unit predecessor ${unit.req}`);
      }
    assert.equal(units.size, tree.counts.total);
    assert(catalog.planning.gates[category][country]);
    assert(catalog.flags[country]);
  }
let missing = 0,
  withTotal = 0,
  completeItems = 0;
for (const id of ids) {
  const row = mods[id];
  if (!row) {
    missing++;
    continue;
  }
  assert.equal(row.unitId, id);
  assert.equal(typeof row.allUnlockedByDefault, "boolean");
  assert.equal(row.source, "https://wiki.warthunder.com/unit/" + id);
  if (row.totalRp !== null) {
    assert(Number.isSafeInteger(row.totalRp) && row.totalRp >= 0);
    withTotal++;
  }
  assert(["verified", "unavailable"].includes(row.status));
  const keys = new Set();
  for (const item of row.items) {
    assert(!keys.has(item.id));
    keys.add(item.id);
    assert.equal(typeof item.name, "string");
    if (item.rp !== null) assert(Number.isSafeInteger(item.rp) && item.rp >= 0);
  }
  if (row.itemCostsComplete) {
    assert.equal(row.itemSumRp, row.totalRp);
    assert(row.items.every((item) => item.rp !== null));
    assert.equal(
      row.items.reduce((sum, item) => sum + item.rp, 0),
      row.totalRp,
    );
    completeItems++;
  }
}
assert.equal(missing, 0, `${missing} vehicles have not had modification data checked`);
// Each country file contains every category and exactly the union of its modifications.
assert.equal(manifest.schemaVersion, 4);
assert.deepEqual(Object.keys(manifest.countries).sort(), Object.keys(catalog.countries).sort());
assert.deepEqual(
  (await readdir(resolve(root, "src/generated/countries"))).sort(),
  Object.values(manifest.countries)
    .map((entry) => entry.file.replace(/\.js$/, ".ts"))
    .sort(),
);
for (const [country, entry] of Object.entries(manifest.countries)) {
  assert.equal(entry.key, `country-${country}`);
  const raw = await readFile(resolve(root, "data/generated/countries", entry.key + ".json"));
  const module = await readFile(
    resolve(root, "src/generated/countries", entry.file.replace(/\.js$/, ".ts")),
    "utf8",
  );
  const payload = JSON.parse(raw),
    csv = encodeCsv(countryBody(payload));
  assert.equal(entry.format, "csv-js-v1");
  assert.equal(module, `export default ${JSON.stringify(csv)};\n`);
  assert.equal(Buffer.byteLength(csv), entry.bytes);
  assert.equal(createHash("sha256").update(csv).digest("hex"), entry.sha256);
  assert.equal(Buffer.byteLength(module), entry.transportBytes);
  assert.equal(createHash("sha256").update(module).digest("hex"), entry.transportSha256);
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.country, country);
  assert.equal(payload.checkedAt, catalog.checkedAt);
  assert.deepEqual(payload.lineupCodes, codebook.countries[country]);
  assert.equal(
    new Set(Object.values(payload.lineupCodes)).size,
    Object.keys(payload.lineupCodes).length,
  );
  for (const [code, id] of Object.entries(payload.lineupCodes)) {
    assert.match(code, /^[0-9A-Za-z]{2}$/);
    assert.notEqual(code, lineupRules.emptyCode);
    assert.equal(typeof id, "string");
  }
  assert.deepEqual(Object.keys(payload.trees).sort(), Object.keys(catalog.categories).sort());
  const unitIds = new Set();
  for (const category of Object.keys(catalog.categories)) {
    const expected = catalog.trees[category][country];
    assert.deepEqual(payload.trees[category], expected);
    if (!expected) continue;
    for (const rank of expected.ranks)
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members) unitIds.add(unit.id);
  }
  assert.deepEqual(Object.keys(payload.modifications).sort(), [...unitIds].sort());
  const registered = new Set(Object.values(payload.lineupCodes));
  for (const id of unitIds)
    assert(
      registered.has(id),
      `Missing stable vehicle code for ${country}/${id}; run pnpm run refresh:lineup-codes`,
    );
  for (const id of registered)
    if (ids.has(id)) assert(unitIds.has(id), `Wrong country in lineup registry: ${country}/${id}`);
  for (const [id, row] of Object.entries(payload.modifications)) {
    const original = mods[id];
    const { items, presentation, ...metadata } = row;
    const layout = modificationPresentation.layouts[id];
    assert.deepEqual(
      presentation,
      layout
        ? { groups: layout.groups, source: layout.source, checkedAt: layout.checkedAt }
        : undefined,
    );
    const { items: originalItems, ...originalMetadata } = original;
    assert.deepEqual(metadata, originalMetadata);
    assert.equal(items.length, originalItems.length);
    items.forEach((item, index) => {
      const source = originalItems[index];
      checkName(item, localization.modifications[source.id + "\t" + source.name], source.name);
      const {
        name,
        nameEn,
        nameRu,
        nameJa,
        nameZhCN,
        localizationKey,
        imageUrl,
        tier,
        position,
        ...costFields
      } = item;
      const { name: originalName, ...originalCostFields } = source;
      assert.deepEqual(costFields, originalCostFields);
      if (imageUrl)
        assert.match(
          imageUrl,
          /^https:\/\/static\.encyclopedia\.warthunder\.com\/gui_skin\/[A-Za-z0-9_./-]+\.(png|svg|webp)$/,
        );
      assert.equal(
        tier,
        layout?.items.find((entry) => entry.id === item.id)?.row ||
          modificationTiers.units[id]?.[item.id],
      );
      assert(
        Number.isInteger(tier) && tier >= 1 && tier <= 6,
        "Every modification requires a verified tier",
      );
      if (position) {
        const proof = layout?.items.find((entry) => entry.id === item.id);
        assert(proof, "Modification grid coordinates require verified per-unit provenance");
        assert.deepEqual(position, { group: proof.group, row: proof.row, column: proof.column });
      }
    });
  }
}
console.log(
  JSON.stringify({
    countryFiles: Object.keys(manifest.countries).length,
    lineupVehicleCodes: Object.values(codebook.countries).reduce(
      (sum, rows) => sum + Object.keys(rows).length,
      0,
    ),
    trees,
    localizedVehicles: Object.values(localization.vehicles).filter((value) => value.nameZhCN)
      .length,
    missingModificationNames: localization.coverage.modificationMissing.length,
    vehicles: ids.size,
    modificationTotals: withTotal,
    completeItemCosts: completeItems,
    unavailableTotals: ids.size - withTotal,
  }),
);
