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
  const candidates = files.filter(
    (f) => f.startsWith("assets/" + entry.file.replace(/\.js$/, "-")) && f.endsWith(".js"),
  );
  assert.equal(candidates.length, 1, "Exactly one lazy country module for " + country);
  const { default: text } = await import(pathToFileURL(new URL(candidates[0], dist).pathname).href);
  assert.equal(typeof text, "string");
  assert.equal(Buffer.byteLength(text), entry.bytes);
  assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256);
  assert.equal(JSON.parse(text).country, country);
}
assert(
  !JSON.stringify(manifest).includes("heybox-placeholder"),
  "Replace template metadata artwork",
);
const total = await Promise.all(
  files.map(async (f) => (await readFile(new URL(f, dist))).byteLength),
);
console.log(
  JSON.stringify({
    miniapp: "war-thunder-heybox",
    countries: 10,
    wasm: 0,
    standaloneDataJSON: 0,
    bytes: total.reduce((a, b) => a + b, 0),
    uiAcceptance: "manual",
    nativeAuthorization: "not-yet-verified",
  }),
);
