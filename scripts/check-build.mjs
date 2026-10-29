import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { decodeCsv, restoreCountry } from "../src/country-csv.mjs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "src/generated/manifest.json"), "utf8"));
const files = await readdir(dist, { recursive: true }),
  html = await readFile(resolve(dist, "index.html"), "utf8");
assert.equal(manifest.schemaVersion, 4);
assert(
  !files.some((file) => /\.(?:wasm|wat|json|csv|gz)$/.test(file)),
  "Publish only JS-wrapped CSV data, no browser scoring runtime",
);
assert(
  !files.some((file) => /^assets\/vehicle-facts-/.test(file)),
  "No duplicate legacy vehicle directory",
);
const atlas = files.filter((file) => /^assets\/MapAtlas\.[^/]+\.js$/.test(file));
assert.equal(atlas.length, 1);
assert(!html.includes(atlas[0]));
const publicResources = files.filter((file) =>
  /^assets\/public-resource-api\.[^/]+\.js$/.test(file),
);
assert.equal(publicResources.length, 1, "One shared public-resource reader");
assert.equal(
  (await readFile(resolve(dist, publicResources[0]), "utf8")).includes(
    "/sales-prices-preview/prices",
  ),
  process.env.VITE_WT_CATALOG_SOURCE === "preview" &&
    process.env.VITE_WT_PRICE_SOURCE === "preview",
  "Public quotes must use production unless the isolated price source is explicitly selected",
);
assert(
  !files.some((file) => /(?:^|\/)\d+-\d+[.-][^/]*\.svg$/.test(file)),
  "Recommended route SVGs must be fetched through authenticated API, never published as static assets",
);
for (const [country, entry] of Object.entries(manifest.countries)) {
  const prefix = entry.file.replace(/\.js$/, ".");
  const matches = files.filter(
    (file) => file.startsWith("assets/" + prefix) && file.endsWith(".js"),
  );
  assert.equal(matches.length, 1, `One country JS module: ${country}`);
  assert(!html.includes(matches[0]), "Country bodies must remain lazy");
  const { default: csv } = await import(pathToFileURL(resolve(dist, matches[0])).href);
  assert.equal(typeof csv, "string");
  assert.equal(Buffer.byteLength(csv), entry.bytes);
  assert.equal(createHash("sha256").update(csv).digest("hex"), entry.sha256);
  const value = restoreCountry(decodeCsv(csv), entry),
    canonical = JSON.parse(
      await readFile(resolve(root, "data/generated/countries", entry.key + ".json"), "utf8"),
    );
  assert.deepEqual(value, canonical, `Lossless complete country CSV: ${country}`);
}
const countryModules = files.filter((file) =>
  /^assets\/country-(?:usa|germany|ussr|britain|japan|china|italy|france|sweden|israel)\..*\.js$/.test(
    file,
  ),
);
assert.equal(countryModules.length, 10);
console.log(
  JSON.stringify({
    countryCsvJsModules: countryModules.length,
    legacyVehicleModules: 0,
    jsonFilesPublished: 0,
    verifiedCompleteCountries: 10,
  }),
);
await import("./check-seo.mjs");
