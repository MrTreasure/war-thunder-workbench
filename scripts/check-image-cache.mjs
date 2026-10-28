/** Offline service-worker contract checks. No browser or public network requests. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { imageCacheEnabled } from "../src/image-cache.ts";

assert(imageCacheEnabled("https://wt.mrtreasure.cc", true));
for (const origin of [
  "https://render.qmuse.pub",
  "https://render.mrtreasure.cc",
  "http://localhost:5178",
])
  assert(!imageCacheEnabled(origin, true));
assert(!imageCacheEnabled("https://wt.mrtreasure.cc", false));

const stores = new Map();
let rejectWrites = false;
const cacheStorage = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const rows = stores.get(name);
    const key = (request) => (typeof request === "string" ? request : request.url);
    return {
      async match(request) {
        return rows.get(key(request))?.clone();
      },
      async put(request, response) {
        if (rejectWrites) throw Error("QuotaExceededError");
        rows.set(key(request), response.clone());
      },
      async delete(request) {
        return rows.delete(key(request));
      },
      async keys() {
        return [...rows.keys()].map((url) => new Request(url));
      },
    };
  },
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  },
};
const listeners = {};
let network = 0;
let offline = false;
let opaque = false;
let now = Date.now();
function imageResponse() {
  const response = new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } });
  if (opaque) {
    Object.defineProperty(response, "type", { value: "opaque" });
    Object.defineProperty(response, "clone", { value: imageResponse });
  }
  return response;
}
const self = {
  location: new URL("https://wt.mrtreasure.cc/wt-image-cache-sw.js"),
  addEventListener(type, handler) {
    listeners[type] = handler;
  },
  async skipWaiting() {},
  clients: { async claim() {} },
};
runInNewContext(
  await readFile(new URL("../public/wt-image-cache-sw.js", import.meta.url), "utf8"),
  {
    self,
    URL,
    Request,
    Response,
    caches: cacheStorage,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    async fetch(request) {
      network++;
      assert.equal(request.credentials, "omit");
      if (offline) throw Error("offline");
      return imageResponse();
    },
  },
);
await cacheStorage.open("wt-public-images-retired");
await cacheStorage.open("private-cart");
const activation = [];
listeners.activate({
  waitUntil(promise) {
    activation.push(promise);
  },
});
await Promise.all(activation);
assert(!stores.has("wt-public-images-retired"));
assert(stores.has("private-cart"));

const icon = "https://static.encyclopedia.warthunder.com/gui_skin/item_type_rp.svg";
function dispatch(url, destination = "image", options = {}) {
  const request = new Request(url, options);
  Object.defineProperty(request, "destination", { value: destination });
  const waits = [];
  let response;
  listeners.fetch({
    request,
    respondWith(promise) {
      response = promise;
    },
    waitUntil(promise) {
      waits.push(promise);
    },
  });
  return {
    get response() {
      return response;
    },
    async finish() {
      const result = await response;
      for (let i = 0; i < waits.length; i++) await waits[i];
      return result;
    },
  };
}
for (const [url, destination, options] of [
  ["https://wt.mrtreasure.cc/", "document"],
  ["https://api.mrtreasure.cc/wt-stats/v1/public/account", ""],
  [icon, ""], // Canvas fetches and data requests keep their existing rules.
  [icon, "image", { method: "POST" }],
  [icon, "image", { headers: { Authorization: "Bearer test" } }],
  [icon + "?account=private", "image"],
  ["https://static.encyclopedia.warthunder.com/private/avatar.png", "image"],
  ["https://example.org/icon.png", "image"],
])
  assert.equal(dispatch(url, destination, options).response, undefined);
const first = dispatch(icon);
const concurrent = dispatch(icon);
assert.equal(await (await first.finish()).text(), "<svg/>");
await concurrent.finish();
assert.equal(network, 1, "Concurrent images share a download");
await dispatch(icon).finish();
assert.equal(network, 1, "A warm image does not request the CDN");

now += 8 * 86400000;
offline = true;
assert.equal(
  await (await dispatch(icon).finish()).text(),
  "<svg/>",
  "Expired images remain usable offline",
);
offline = false;
for (let i = 0; i < 50; i++) {
  now++;
  await dispatch(`https://static.encyclopedia.warthunder.com/gui_skin/check_${i}.svg`).finish();
}
assert(stores.get("wt-public-images-v1-icons").size <= 48, "Icon cache is bounded");
opaque = true;
for (let i = 0; i < 45; i++) {
  now++;
  await dispatch(`https://static.encyclopedia.warthunder.com/slots/check_${i}.png`).finish();
}
assert(
  stores.get("wt-public-images-v1-vehicles").size <= 40,
  "Opaque image quota padding has its own bound",
);
opaque = false;
rejectWrites = true;
assert.equal(
  await (await dispatch(icon).finish()).text(),
  "<svg/>",
  "Quota failures preserve image display",
);
assert(stores.has("private-cart"));
self.location = new URL("https://render.qmuse.pub/wt-image-cache-sw.js");
assert.equal(dispatch(icon).response, undefined);
console.log(
  "Image cache verified: international-only, anonymous public images, warm reads, offline refresh, bounded eviction, quota fallback, user-cache isolation.",
);
