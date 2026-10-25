import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "src/generated/manifest.json"), "utf8"));
const files = await readdir(dist, { recursive: true });
assert(
  !files.some((file) => /\.(wasm|wat)$/.test(file)),
  "Efficiency is calculated by the server; publish no client runtime",
);

assert(
  !files.some((file) => file.endsWith(".json")),
  "Published build must not contain JSON files",
);
const html = await readFile(resolve(dist, "index.html"), "utf8");
const atlasModules = files.filter((file) => /^assets\/MapAtlas\.[^/]+\.js$/.test(file));
assert.equal(atlasModules.length, 1, "Expected one lazy guide page module");
assert(!html.includes(atlasModules[0]), "Hidden guide page must not be preloaded");
const published = [];
for (const [country, entry] of Object.entries(manifest.countries)) {
  const prefix = entry.file.replace(/\.js$/, ".");
  const candidates = files.filter(
    (file) => file.startsWith(`assets/${prefix}`) && file.endsWith(".js"),
  );
  assert.equal(candidates.length, 1, `Expected one separate JS module for ${country}`);
  const path = resolve(dist, candidates[0]);
  assert(
    !html.includes(candidates[0]),
    `Country ${country} must not be preloaded on initial render`,
  );
  const { default: text } = await import(pathToFileURL(path).href);
  assert.equal(typeof text, "string");
  assert.equal(Buffer.byteLength(text), entry.bytes);
  assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256);
  assert.equal(JSON.parse(text).country, country);
  published.push(relative(dist, path));
}
assert.equal(files.filter((file) => /assets\/country-.*\.js$/.test(file)).length, 10);
const factModules = files.filter((file) => /^assets\/vehicle-facts-[a-z]+\.[a-f0-9]{16}\.[^/]+\.js$/.test(file));
assert.equal(factModules.length, 10, "Expected ten small lazy vehicle metadata modules");
for (const file of factModules) {
  assert(!html.includes(file), "Vehicle metadata must not be preloaded at startup");
  const { default: text } = await import(pathToFileURL(resolve(dist, file)).href);
  const hash = createHash("sha256").update(text).digest("hex");
  assert(file.includes(hash.slice(0, 16)), "Vehicle metadata content hash must match its filename");
  const body = JSON.parse(text);
  assert.equal(body.schemaVersion, 1);
  assert(body.items.length > 0);
  for (const unit of body.items) {
    assert.equal(unit.country, body.country);
    assert(unit.br && Object.hasOwn(unit, "role"));
    assert(!("wikiDetails" in unit) && !("modifications" in unit), "Metadata excludes full detail and modification bodies");
  }
}
console.log(
  JSON.stringify({
    countryJsModules: published.length,
    jsonFilesPublished: 0,
    verifiedCanonicalHashes: published.length,
  }),
);

await import("./check-seo.mjs");
