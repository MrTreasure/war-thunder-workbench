/** Code regressions for platform entry points; no browser or visual acceptance. */
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { bootAppearance } from "../src/boot-appearance.mjs";
import { canUseCountryWorker, createCountryDecoder } from "../src/country-resource-decoder.ts";
import { readFile } from "node:fs/promises";

const defaults = JSON.parse(
  await readFile(new URL("../data/workbench-appearance.json", import.meta.url)),
);
const properties = new Map();
const document = {
  documentElement: {
    dataset: {},
    style: { setProperty: (key, value) => properties.set(key, value) },
  },
};
let requests = 0;
const context = {
  document,
  URL,
  Date,
  Image: class {},
  localStorage: { getItem: () => null },
  AbortSignal,
  fetch: () => {
    requests++;
    return Promise.reject(Error("offline"));
  },
};
// QMuse's document has none of our HTML bootstrap. The shared function must
// apply a usable background synchronously, even when its refresh fails.
const code = `(${bootAppearance.toString()})(${JSON.stringify(defaults)}, "https://example.test");`;
runInNewContext(code, context);
assert.equal(
  properties.get("--wt-loading-background-image"),
  `url(${JSON.stringify(defaults.backgroundUrl)})`,
);
assert.equal(properties.get("--wt-loading-background-position"), "50% 50%");
runInNewContext(code, context);
assert.equal(requests, 1, "HTML and application entries must not fetch appearance twice");

assert.equal(
  canUseCountryWorker("https://renderstatic.qmuse.pub/assets/app.js", "https://render.qmuse.pub"),
  false,
);
assert.equal(
  canUseCountryWorker("https://wt.mrtreasure.cc/assets/app.js", "https://wt.mrtreasure.cc"),
  true,
);
const entry = {};
let created = 0;
const fallback = (csv) => ({ csv });
const blocked = createCountryDecoder(() => {
  created++;
  throw Error("SecurityError");
}, fallback);
assert.deepEqual(await blocked("first", entry), { csv: "first" });
assert.deepEqual(await blocked("second", entry), { csv: "second" });
assert.equal(created, 1, "A rejected worker must not be constructed again");
assert.deepEqual(await createCountryDecoder(null, fallback)("no-worker", entry), {
  csv: "no-worker",
});
let terminated = 0;
const failed = createCountryDecoder(() => {
  const worker = {
    terminate: () => terminated++,
    postMessage: () => queueMicrotask(() => worker.onerror({ preventDefault() {} })),
  };
  return worker;
}, fallback);
assert.deepEqual(await Promise.all([failed("a", entry), failed("b", entry)]), [
  { csv: "a" },
  { csv: "b" },
]);
assert(terminated > 0);
const corrupt = createCountryDecoder(
  () => {
    const worker = {
      terminate() {},
      postMessage: ({ id }) =>
        queueMicrotask(() => worker.onmessage({ data: { id, error: "invalid CSV" } })),
    };
    return worker;
  },
  () => assert.fail("Invalid worker data must not silently bypass validation"),
);
await assert.rejects(corrupt("invalid", entry), /invalid CSV/);
console.log(
  "Platform bootstrap verified: QMuse background without source HTML, idempotent startup, worker origin policy and verified parsing fallback.",
);
