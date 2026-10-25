import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const app = new URL("../", import.meta.url),
  root = new URL("../../../", import.meta.url);
const dist = new URL("dist/", app),
  files = (
    await Promise.all(
      (await readdir(dist, { recursive: true })).map(async (file) =>
        (await stat(new URL(file, dist))).isFile() ? file : null,
      ),
    )
  ).filter(Boolean);
const html = await readFile(new URL("index.html", dist), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest.json", dist), "utf8"));
assert.equal(manifest.name, "战雷工作台");
for (const key of ["userInfo", "network", "storage", "clipboard", "share"]) {
  assert.equal(
    manifest.permissions?.[key]?.enabled,
    true,
    "Missing permission used by the miniapp: " + key,
  );
}
const copySource = await readFile(new URL("src/MainSiteLink.tsx", app), "utf8");
assert(
  !copySource.includes("navigator.clipboard"),
  "Native copy actions must use the SDK Host clipboard",
);
assert.deepEqual([...manifest.platforms].sort(), ["android", "ios"]);
assert(
  !files.some((f) => /\.(wasm|wat|map)$/.test(f)),
  "No browser efficiency runtime, WAT or source maps",
);
assert(
  !files.some((f) => f.endsWith(".json") && f !== "manifest.json"),
  "Only the mandatory platform manifest may be a standalone JSON file",
);
assert(!html.includes("country-"), "Do not preload country payloads");
assert(
  !files.some((f) => /MapAtlas|Lineups|SaleCalendar|Decals/.test(f)),
  "Publish only the requested miniapp modules",
);
const canonical = JSON.parse(await readFile(new URL("src/generated/manifest.json", root), "utf8"));
for (const [country, entry] of Object.entries(canonical.countries)) {
  const candidates = files.filter((f) => f.startsWith(`assets/c-${country}-`) && f.endsWith(".js"));
  assert.equal(candidates.length, 1, "Exactly one lazy country module for " + country);
  const { default: text } = await import(pathToFileURL(new URL(candidates[0], dist).pathname).href);
  assert.equal(typeof text, "string");
  assert.equal(Buffer.byteLength(text), entry.bytes);
  assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256);
  assert.equal(JSON.parse(text).country, country);
}
const { vehicleFactModules } = await import(new URL("src/generated/vehicle-fact-modules.ts", root));
for (const [country, entry] of Object.entries(vehicleFactModules)) {
  const candidates = files.filter(
    (file) => file.startsWith(`assets/v-${country}-`) && file.endsWith(".js"),
  );
  assert.equal(candidates.length, 1, "Exactly one lazy metadata module for " + country);
  assert(!html.includes(candidates[0]), "Do not preload vehicle metadata");
  const { default: text } = await import(pathToFileURL(new URL(candidates[0], dist).pathname).href);
  assert.equal(Buffer.byteLength(text), entry.bytes);
  assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256);
  const body = JSON.parse(text);
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.country, country);
}
assert(
  !JSON.stringify(manifest).includes("heybox-placeholder"),
  "Replace template metadata artwork",
);
// Production business traffic has exactly one public gateway. Do not introduce
// a NAS/LAN failover when a Cloudflare request is slow or unavailable.
const apiSource = await readFile(new URL("src/api.ts", app), "utf8");
assert(
  apiSource.includes('const API = "https://api.mrtreasure.cc/wt-stats/v1/";'),
  "The production API must remain the Cloudflare gateway",
);
const emittedJS = (
  await Promise.all(
    files
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFile(new URL(file, dist), "utf8")),
  )
).join("\n");
assert(
  !emittedJS.includes("wt-avatar-picker") && !emittedJS.includes("浏览战雷头像"),
  "Avatar selection belongs to the PC website only",
);
assert(
  !emittedJS.includes("wt-heybox-browser-preview:"),
  "Browser preview adapter must never enter the production miniapp",
);
assert(
  emittedJS.includes("https://api.mrtreasure.cc/wt-stats/v1/"),
  "Built requests must retain the public API gateway",
);
for (const blocked of [
  /api-nas\.mrtreasure\.cc/i,
  /https?:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/i,
  /https?:\/\/[^/\s"']+:15432(?:[/"']|$)/i,
]) {
  assert(!blocked.test(emittedJS), "A direct NAS or LAN address entered the production bundle");
}
const total = await Promise.all(
  files.map(async (f) => (await readFile(new URL(f, dist))).byteLength),
);
console.log(
  JSON.stringify({
    miniapp: "war-thunder-heybox",
    countries: 10,
    vehicleMetadataCountries: 10,
    apiGateway: "https://api.mrtreasure.cc/wt-stats/v1/",
    nasDirectAccess: false,
    wasm: 0,
    standaloneDataJSON: 0,
    bytes: total.reduce((a, b) => a + b, 0),
    uiAcceptance: "requires Browser Mock screenshots and native device review",
    nativeAuthorization: "not-yet-verified",
  }),
);
