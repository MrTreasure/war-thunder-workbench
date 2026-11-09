import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { appUpdateBuildPlugin } from "./app-update-build.mjs";
import { AppUpdateStore, AppUpdateGuards, readAppBuildId } from "../src/app-update.ts";
const old = "a".repeat(24),
  next = "b".repeat(24);
assert.equal(readAppBuildId(`<meta content='${next}' name='wt-build-id'>`), next);
assert.equal(readAppBuildId(`<meta name="wt-build-id" content="untrusted">`), null);
let now = 100_000,
  calls = 0,
  reply = next,
  fail = false;
const store = new AppUpdateStore(
  old,
  async () => {
    calls++;
    if (fail) throw Error("offline");
    return reply;
  },
  () => now,
);
await Promise.all([store.check(), store.check()]);
assert.equal(calls, 1, "concurrent requests deduplicate");
assert.equal(store.getSnapshot().available, next);
await store.check();
assert.equal(calls, 1, "focus checks respect cooldown");
now += 60_001;
fail = true;
await store.check();
assert.equal(store.getSnapshot().available, next, "offline retains known update");
assert.equal(store.getSnapshot().current, old, "checks never replace current running version");
now += 60_001;
fail = false;
reply = null;
await store.check();
assert.equal(store.getSnapshot().available, next, "missing marker retains known update");
now += 60_001;
reply = old;
await store.check();
assert.equal(
  store.getSnapshot().available,
  null,
  "a server rollback to the running version clears notice",
);
const guards = new AppUpdateGuards();
let reloads = 0;
const releaseA = guards.register("队列草稿"),
  releaseB = guards.register("队列草稿");
assert.deepEqual(guards.getSnapshot(), ["队列草稿"]);
assert.equal(
  guards.requestReload(() => reloads++),
  false,
);
releaseA();
assert.equal(
  guards.requestReload(() => reloads++),
  false,
  "another draft keeps reload blocked",
);
releaseB();
assert.equal(
  guards.requestReload(() => reloads++),
  true,
);
assert.equal(reloads, 1, "reload is exclusively an explicit unguarded action");
console.log(
  "App update checks passed: identities, deduplication, cooldown, failure preservation, rollback, dirty guards.",
);

const plugin = appUpdateBuildPlugin();
const marker = plugin.transformIndexHtml()[0];
const defined = JSON.parse(plugin.config().define.__WT_BUILD_ID__);
assert.equal(marker.attrs.content, defined, "HTML and running bundle share one identity");
assert.equal(
  appUpdateBuildPlugin().transformIndexHtml()[0].attrs.content,
  defined,
  "identical inputs have stable identities",
);
console.log("Build identity checks passed: stable identity and matching HTML/bundle markers.");

const platformHTML =
  '<script>window.__MUSE__=Object.assign(window.__MUSE__||{},{"appId":"8645013411493394","appVersionId":"93400247"});</script>';
assert.equal(readAppBuildId(platformHTML), "qmuse:93400247");
assert.equal(
  readAppBuildId(`<meta name="wt-build-id" content="${old}">${platformHTML}`),
  old,
  "build marker takes precedence",
);
assert.equal(
  readAppBuildId('<script>{"id":"93400247","versionId":"93400247","appId":"93400247"}</script>'),
  null,
);
assert.equal(readAppBuildId('<script>{"appVersionId":"unknown"}</script>'), null);
assert.equal(readAppBuildId('<script>{"appVersionId":"001"}</script>'), null);
assert.equal(readAppBuildId(`<div data-id='"appVersionId":"93400247"'></div>`), null);
assert.equal(
  readAppBuildId(`${platformHTML}<script>{"appVersionId":"93400248"}</script>`),
  null,
  "ambiguous platform identities are unknown",
);
let platformReply = "qmuse:93400247";
const platformStore = new AppUpdateStore("qmuse:93400247", async () => platformReply);
await platformStore.check(0);
assert.equal(platformStore.getSnapshot().available, null, "same platform version is stable");
platformReply = "qmuse:93400248";
await platformStore.check(0);
assert.equal(
  platformStore.getSnapshot().available,
  platformReply,
  "new platform version is detected",
);
platformReply = "unknown";
await platformStore.check(0);
assert.equal(
  platformStore.getSnapshot().available,
  "qmuse:93400248",
  "unknown does not replace the known update",
);
platformReply = old;
await platformStore.check(0);
assert.equal(
  platformStore.getSnapshot().available,
  "qmuse:93400248",
  "different identity namespace is not comparable",
);
console.log(
  "QMuse checks passed: platform bootstrap, strict markers, stable current version, safe unknowns.",
);

const fixture = mkdtempSync(resolve(tmpdir(), "wt-app-update-"));
try {
  for (const dir of ["src", "public", "data/generated", "data/evidence", "scripts"])
    mkdirSync(resolve(fixture, dir), { recursive: true });
  for (const name of [
    "index.html",
    "package.json",
    "pnpm-lock.yaml",
    "vite.config.ts",
    "tsconfig.json",
    "scripts/check-build.mjs",
    "scripts/app-update-build.mjs",
    "scripts/prepare-data.mjs",
    "scripts/build-seo.mjs",
    "src/main.ts",
    "public/test.txt",
    "data/vehicle-theme.json",
    "data/generated/private.json",
    "data/evidence/private.json",
  ])
    writeFileSync(resolve(fixture, name), "initial");
  const identity = () => appUpdateBuildPlugin(fixture).transformIndexHtml()[0].attrs.content;
  let baseline = identity();
  writeFileSync(resolve(fixture, "data/vehicle-theme.json"), "changed canonical UI data");
  assert.notEqual(identity(), baseline, "canonical data changes update the build identity");
  baseline = identity();
  writeFileSync(resolve(fixture, "scripts/build-seo.mjs"), "changed build pipeline");
  assert.notEqual(identity(), baseline, "build script changes update the identity");
  baseline = identity();
  writeFileSync(
    resolve(fixture, "data/generated/private.json"),
    "changed private generated output",
  );
  writeFileSync(resolve(fixture, "data/evidence/private.json"), "changed private evidence");
  assert.equal(identity(), baseline, "private generated and evidence directories are excluded");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
console.log(
  "Identity input checks passed: canonical UI data, build scripts, private directory exclusion.",
);
