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
  !files.some((file) => file.endsWith(".json")),
  "Published build must not contain JSON files",
);
const html = await readFile(resolve(dist, "index.html"), "utf8");
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
console.log(
  JSON.stringify({
    countryJsModules: published.length,
    jsonFilesPublished: 0,
    verifiedCanonicalHashes: published.length,
  }),
);
