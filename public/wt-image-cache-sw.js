/* Public images only. Never cache application HTML, API responses or account data. */
const PREFIX = "wt-public-images-";
const VERSION = PREFIX + "v2";
const META = VERSION + "-meta";
const DAY = 86400000;
const GROUPS = {
  icons: { name: VERSION + "-icons", max: 48, ttl: 7 * DAY },
  vehicles: { name: VERSION + "-vehicles", max: 96, ttl: 7 * DAY },
  backgrounds: { name: VERSION + "-backgrounds", max: 2, ttl: 7 * DAY },
};
const CURRENT = new Set([META, ...Object.values(GROUPS).map((group) => group.name)]);
// Chromium may charge roughly 7 MiB per opaque entry, even for a small icon.
// Keep a separate count limit; readable response sizes cannot describe opaque bodies.
const MAX_OPAQUE = 40;
const pending = new Map();
let writes = Promise.resolve();

function groupFor(request) {
  if (
    self.location.origin !== "https://wt.mrtreasure.cc" ||
    request.method !== "GET" ||
    request.destination !== "image" ||
    request.headers.has("range") ||
    request.headers.has("authorization") ||
    request.cache === "no-store" ||
    request.cache === "reload"
  ) return null;
  const url = new URL(request.url);
  if (url.protocol !== "https:" || url.username || url.password || url.search) return null;
  if (!/\.(png|svg|webp|avif|jpe?g)$/i.test(url.pathname)) return null;
  if (url.hostname === "static.encyclopedia.warthunder.com") {
    if (url.pathname.startsWith("/gui_skin/")) return GROUPS.icons;
    if (/^\/(images|slots)\//.test(url.pathname)) return GROUPS.vehicles;
  }
  if (
    url.hostname === "staticfiles.warthunder.com" &&
    url.pathname.startsWith("/upload/image/0_Wallpaper_Renders/")
  ) return GROUPS.backgrounds;
  return null;
}

async function remove(cache, meta, request) {
  await cache.delete(request);
  await meta.delete(request);
}

async function trimOpaque(meta) {
  const opaque = [];
  for (const key of await meta.keys()) {
    const record = await (await meta.match(key)).json();
    if (record.opaque && CURRENT.has(record.cache)) opaque.push({ key, ...record });
  }
  // Access times preserve frequently used icons while cold vehicle thumbnails are evicted.
  opaque.sort((a, b) => a.touchedAt - b.touchedAt);
  for (const record of opaque.slice(0, Math.max(0, opaque.length - MAX_OPAQUE))) {
    await remove(await caches.open(record.cache), meta, record.key);
  }
}

async function store(request, response, group) {
  const cache = await caches.open(group.name);
  const meta = await caches.open(META);
  try {
    await cache.put(request.url, response);
    await meta.put(request.url, new Response(JSON.stringify({
      cache: group.name,
      storedAt: Date.now(),
      touchedAt: Date.now(),
      opaque: response.type === "opaque",
    })));
    const entries = [];
    for (const key of await cache.keys()) {
      const info = await meta.match(key);
      entries.push({ key, touchedAt: info ? (await info.json()).touchedAt : 0 });
    }
    entries.sort((a, b) => a.touchedAt - b.touchedAt);
    for (const entry of entries.slice(0, Math.max(0, entries.length - group.max))) {
      await remove(cache, meta, entry.key);
    }
    await trimOpaque(meta);
  } catch {
    // Quota/corruption affects these image caches only; never clear IndexedDB or user files.
    await remove(cache, meta, request).catch(() => {});
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(1, Math.ceil(keys.length / 4)))) {
      await remove(cache, meta, key).catch(() => {});
    }
  }
}

function serialize(action) {
  writes = writes.then(action).catch(() => {});
  return writes;
}

function refresh(request, group, event) {
  if (pending.has(request.url)) return pending.get(request.url).then((response) => response.clone());
  const operation = (async () => {
    // Public CDN loads remain anonymous, including cross-origin no-cors image loads.
    // Service-worker fetch requires redirect=follow for no-cors image requests.
    const response = await fetch(new Request(request, { credentials: "omit", redirect: "follow" }));
    const publicImage = response.type === "opaque" || (
      response.ok && response.headers.get("content-type")?.startsWith("image/") &&
      !/no-store|private/i.test(response.headers.get("cache-control") || "")
    );
    // Cache writes and eviction must not delay displaying a newly downloaded image.
    if (publicImage) event.waitUntil(serialize(() => store(request, response.clone(), group)));
    return response;
  })();
  pending.set(request.url, operation);
  void operation.finally(() => pending.delete(request.url)).catch(() => {});
  return operation.then((response) => response.clone());
}

async function load(event, group) {
  const request = event.request;
  try {
    const cache = await caches.open(group.name);
    const meta = await caches.open(META);
    const [cached, info] = await Promise.all([cache.match(request.url), meta.match(request.url)]);
    if (cached && info) {
      const record = await info.json();
      // Opaque HTTP errors cannot be inspected; revalidate them at least daily.
      const ttl = record.opaque ? DAY : group.ttl;
      if (Date.now() - record.storedAt > ttl) {
        event.waitUntil(refresh(request, group, event).catch(() => {}));
      } else {
        event.waitUntil(serialize(async () => {
          // A previous trim may have evicted this response before the queued touch.
          if (await cache.match(request.url)) {
            await meta.put(request.url, new Response(JSON.stringify({ ...record, touchedAt: Date.now() })));
          }
        }));
      }
      return cached;
    }
  } catch {
    // Storage-disabled/private contexts continue with an ordinary anonymous image request.
  }
  return refresh(request, group, event);
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && !CURRENT.has(name)) await caches.delete(name);
  }
  await self.clients.claim();
})()));
self.addEventListener("fetch", (event) => {
  const group = groupFor(event.request);
  if (group) event.respondWith(load(event, group).catch(() =>
    // A failed cache path must retain normal anonymous image-loading behavior.
    fetch(event.request, { credentials: "omit", redirect: "follow" })
  ));
});
