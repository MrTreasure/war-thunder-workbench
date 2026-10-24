import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "src/generated/manifest.json"), "utf8"));
const files = await readdir(dist, { recursive: true });
const scoring = JSON.parse(
  await readFile(resolve(root, "data/player-efficiency-wasm.json"), "utf8"),
);
const statsRules = JSON.parse(
  await readFile(resolve(root, "data/player-stats-rules.json"), "utf8"),
);
assert.equal(scoring.version, statsRules.version, "Scoring runtime and display version must agree");
assert.match(scoring.commit, /^[a-f0-9]{40}$/);
assert.match(scoring.sha256, /^[a-f0-9]{64}$/);
assert.equal(scoring.argumentCount, 16);
assert.equal(scoring.abi, "slots-f64-v1");
assert(Number.isSafeInteger(scoring.bytes) && scoring.bytes > 0 && scoring.bytes < 32768);
const scoringPath = `war-thunder/efficiency/v3/${scoring.sha256}.wasm`;
assert.equal(
  scoring.url,
  `https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@${scoring.commit}/${scoringPath}`,
);
assert.equal(
  scoring.fallbackUrl,
  `https://raw.githubusercontent.com/MrTreasure/oss-files/${scoring.commit}/${scoringPath}`,
);
assert(
  !("coefficients" in statsRules.efficiency) && !("smoothing" in statsRules.efficiency),
  "Public scoring metadata must not carry a JS formula",
);
const runtimes = files.filter((file) => file.endsWith(".wasm"));
assert.equal(runtimes.length, 1, "Publish exactly one declared local runtime");
const runtimeBytes = await readFile(resolve(dist, runtimes[0]));
assert.equal(runtimeBytes.byteLength, scoring.bytes, "Local runtime byte length changed");
assert.equal(
  createHash("sha256").update(runtimeBytes).digest("hex"),
  scoring.sha256,
  "Local runtime hash changed",
);
assert(!files.some((file) => file.endsWith(".wat")), "Do not publish runtime source");

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
console.log(
  JSON.stringify({
    countryJsModules: published.length,
    jsonFilesPublished: 0,
    verifiedCanonicalHashes: published.length,
  }),
);

await import("./check-seo.mjs");
