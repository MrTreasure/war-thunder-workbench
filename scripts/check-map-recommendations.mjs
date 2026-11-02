import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { DOMParser } from "linkedom";
import { sharedMapGuides, sharedMapIdentity, sharedMapRoute } from "../src/ground-map-sharing.ts";
import { displayMapMarks } from "../src/ground-map-marks.ts";
import { MapRouteCache } from "../src/map-route-cache.ts";
import {
  availableRouteLayouts,
  routesForContext,
  selectedMapRoute,
} from "../src/map-route-selection.ts";
import { relatedMapGuides, mapRouteSourceTitle } from "../src/map-related-guides.ts";
import { isMapGuideSourceURL } from "../src/map-route-sources.ts";
import { validMapRoute } from "../src/map-route-validation.ts";
for (const source of [
  "https://www.xiaoheihe.cn/app/bbs/link/166293424",
  "https://www.bilibili.com/video/BV1158z6FEW6/",
  "https://forum.warthunder.com/t/map-guide/12345/2",
  "https://www.youtube.com/watch?v=Bck-Exnk2jo&t=10",
  "https://youtu.be/Bck-Exnk2jo",
  "https://tieba.baidu.com/p/12345678",
])
  assert(isMapGuideSourceURL(source), `Unsupported approved guide source: ${source}`);
for (const source of [
  "http://www.bilibili.com/video/BV1158z6FEW6/",
  "https://www.bilibili.com.evil.test/video/BV1158z6FEW6/",
  "https://token@www.bilibili.com/video/BV1158z6FEW6/",
  "https://www.bilibili.com:8443/video/BV1158z6FEW6/",
  "https://www.youtube.com/watch?v=Bck-Exnk2jo&v=db8AApc_udM",
  "https://tieba.baidu.com/p/not-a-post",
  "https://example.test/guide",
])
  assert(!isMapGuideSourceURL(source), `Unsafe or unapproved guide source: ${source}`);
const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const { routes } = await read("data/map-recommendations.json");
const { maps, seasonalVariants } = await read("data/ground-maps.json");
const atlas = { maps, seasonalVariants };
const alaska = maps.find((map) => map.id === "avg_alaska_town");
const alaskaSource = "https://www.bilibili.com/video/BV1mU3g6zEh8/";
const alaskaRoutes = [1, 2].map((team) => ({
  id: `alaska-${team}`,
  mapId: alaska.id,
  layoutId: "alaska_town_dom",
  team,
  title: "阿拉斯加城市攻略",
  sourceUrl: alaskaSource,
  sourceDate: "2025-12-01",
}));
assert.equal(mapRouteSourceTitle(alaskaRoutes[0]), "地图冲刺之【阿拉斯加】");
assert.equal(
  mapRouteSourceTitle({ ...alaskaRoutes[0], sourceTitle: "作者更新后的视频标题" }),
  "作者更新后的视频标题",
  "API source titles take priority over the compatibility title records",
);
assert.equal(
  mapRouteSourceTitle({ ...alaskaRoutes[0], sourceData: { source: { title: "来源原始标题" } } }),
  "来源原始标题",
);
assert.equal(
  mapRouteSourceTitle(routes[0]),
  routes[0].title,
  "Legacy posts retain their post titles",
);
assert.equal(
  relatedMapGuides(atlas, alaska.id, alaskaRoutes).length,
  1,
  "Related Bilibili sources must not depend on a downloaded SVG or selected side",
);
const publicAtlas = {
  ...atlas,
  maps: maps.map((map) =>
    map === alaska
      ? {
          ...map,
          guideSources: [{ title: "阿拉斯加城市攻略", source: alaskaSource, edition: "2025" }],
        }
      : map,
  ),
};
assert.equal(
  relatedMapGuides(publicAtlas, alaska.id)[0].source,
  alaskaSource,
  "Public source metadata must work without requesting protected route files",
);
assert.equal(relatedMapGuides(publicAtlas, alaska.id, alaskaRoutes).length, 1);
const maginot = maps.find((map) => map.id === "avg_sector_montmedy");
assert.deepEqual(
  availableRouteLayouts(atlas, maginot, routes, 1).map((layout) => layout.id),
  ["sector_montmedy_02_dom"],
  "Offer the actual Maginot layout without overlaying it on the default layout",
);
assert.equal(routesForContext(routes, maginot.id, "sector_montmedy_dom", 1).length, 0);
const variantIds = new Set();
let sharedLayouts = 0;
for (const variant of seasonalVariants) {
  assert(!variantIds.has(variant.mapId), "Duplicate seasonal map association");
  variantIds.add(variant.mapId);
  const map = maps.find((m) => m.id === variant.mapId);
  const source = maps.find((m) => m.id === variant.sourceMapId);
  assert(map && source && map !== source, "Unknown seasonal map association");
  assert(!seasonalVariants.some((v) => v.mapId === source.id), "Chained seasonal aliases");
  assert.deepEqual(map.bounds, source.bounds, "Seasonal maps use different coordinates");
  assert.deepEqual(sharedMapGuides(map.id), sharedMapGuides(source.id));
  assert.equal(Object.keys(variant.layouts).length, map.layouts.length);
  assert.equal(new Set(Object.values(variant.layouts)).size, map.layouts.length);
  for (const [layoutId, sourceLayoutId] of Object.entries(variant.layouts)) {
    const layout = map.layouts.find((l) => l.id === layoutId);
    const sourceLayout = source.layouts.find((l) => l.id === sourceLayoutId);
    assert(layout && sourceLayout, "Unknown shared mission");
    assert.equal(layout.locName.replace(";missions/winter", ""), sourceLayout.locName);
    assert.equal(layout.postfix, sourceLayout.postfix);
    assert.deepEqual(layout.crop, sourceLayout.crop, "Seasonal mission crops differ");
    for (const team of [1, 2]) {
      const sourceRoute = sharedMapRoute(routes, source.id, sourceLayoutId, team);
      assert.equal(sharedMapRoute(routes, map.id, layoutId, team), sourceRoute);
      if (sourceRoute) {
        assert.deepEqual(layout.marks, sourceLayout.marks, "Shared SVG mission points differ");
        sharedLayouts++;
      }
    }
    assert.equal(sharedMapRoute(routes, map.id, layoutId, 0), undefined);
  }
  assert.equal(sharedMapRoute(routes, map.id, "unknown-layout", 1), undefined);
}
assert.deepEqual(
  [...variantIds].sort(),
  maps
    .filter((m) => m.id.endsWith("_snow"))
    .map((m) => m.id)
    .sort(),
  "Every winter map needs an explicit family association",
);
// Regression cases: two Polish layouts must stay distinct, and both spawn
// sides must reuse their original SVG rather than copying or swapping it.
for (const [mapId, layoutId, sourceMapId, sourceLayoutId] of [
  ["avg_poland_snow", "poland_snow_dom", "avg_poland", "poland_dom"],
  [
    "avg_sector_montmedy_snow",
    "sector_montmedy_snow_02_dom",
    "avg_sector_montmedy",
    "sector_montmedy_02_dom",
  ],
  [
    "avg_soviet_suburban_snow",
    "soviet_suburban_snow_dom",
    "avg_soviet_suburban",
    "soviet_suburban_dom",
  ],
]) {
  for (const team of [1, 2]) {
    const expected = routes.find(
      (r) => r.mapId === sourceMapId && r.layoutId === sourceLayoutId && r.team === team,
    );
    assert(expected);
    assert.equal(sharedMapRoute(routes, mapId, layoutId, team), expected);
  }
}
assert.equal(sharedMapRoute(routes, "avg_poland_snow", "poland_snow_02_dom", 1), undefined);
assert.equal(
  sharedMapGuides("avg_poland_snow")[0]?.source,
  sharedMapGuides("avg_poland")[0]?.source,
);
assert(sharedMapGuides("avg_poland_snow").length > 0);
assert.equal(sharedMapGuides("unknown-map").length, 0);
const seen = new Set(),
  pairs = new Map();
for (const route of routes) {
  const map = maps.find((m) => m.id === route.mapId);
  assert(
    map?.layouts.some((l) => l.id === route.layoutId),
    route.id + ": unknown mission",
  );
  assert([1, 2].includes(route.team));
  const identity = sharedMapIdentity(route.mapId, route.layoutId);
  const key = `${identity.mapId}:${identity.layoutId}:${route.team}`;
  assert(!seen.has(key), key + ": duplicate team recommendation");
  seen.add(key);
  const pair = `${route.mapId}:${route.layoutId}`;
  pairs.set(pair, (pairs.get(pair) || 0) + 1);
  assert(route.matrix.length === 6 && route.matrix.every(Number.isFinite));
  const [a, b, c, d] = route.matrix;
  assert(a * d - b * c > 0, route.id + ": reflected/degenerate registration");
  assert(route.pointError <= 0.025);
  assert(/^https:\/\/www\.xiaoheihe\.cn\/app\/bbs\/link\/\d+$/.test(route.sourceUrl));
  assert(/^\d+-\d+\.svg$/.test(route.svg));
  const svg = await readFile(new URL("data/map-recommendations/" + route.svg, root), "utf8");
  const sha256 = createHash("sha256").update(svg).digest("hex");
  const apiRoute = {
    ...route,
    svg: {
      path: `map-guides/assets/${sha256}.svg`,
      sha256,
      bytes: Buffer.byteLength(svg),
    },
  };
  assert(validMapRoute(apiRoute), `${route.id}: API must accept the existing numeric side`);
  assert(
    validMapRoute({
      ...apiRoute,
      side: "east",
      guideVersion: 2,
      sourceUrl: "https://www.bilibili.com/video/BV1158z6FEW6/",
    }),
    "New guide side/source must be accepted",
  );
  assert(
    !validMapRoute({ ...apiRoute, side: 0 }),
    "Invalid numeric source ordinal must be rejected",
  );
  assert(!validMapRoute({ ...apiRoute, side: {} }), "Malformed side must be rejected");
  assert(
    !/<!DOCTYPE|<!ENTITY|<script|<foreignObject|\bon\w+=|\bhref=|javascript:|data:|https?:/i.test(
      svg.replace("http://www.w3.org/2000/svg", ""),
    ),
  );
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const element = doc.documentElement;
  assert(element.tagName === "svg");
  assert(element.getAttribute("viewBox") === `0 0 ${route.width} ${route.height}`);
  assert(
    +element.getAttribute("width") === route.width &&
      +element.getAttribute("height") === route.height,
  );
  const ids = new Set(Array.from(element.querySelectorAll("[id]")).map((n) => n.id));
  for (const match of svg.matchAll(/url\(#([\w-]+)\)/g))
    assert(ids.has(match[1]), "Missing marker: " + match[1]);
}
for (const [pair, count] of pairs) assert(count === 2, pair + ": both spawn sides required");
assert(
  (await readdir(new URL("data/map-recommendations/", root))).length === routes.length,
  "Unexpected route files",
);
console.log(
  `Recommended routes: ${routes.length} SVGs, ${pairs.size} layouts, ${new Set(routes.map((r) => r.mapId)).size} maps; ${variantIds.size} seasonal variants reuse ${sharedLayouts} team routes; mission/side, projection and safe SVG checks passed.`,
);

// Real mission exports contain both exact repeats and mode-specific positions.
for (const map of maps)
  for (const layout of map.layouts) {
    const original = structuredClone(layout.marks);
    const marks = displayMapMarks(layout.marks);
    const captures = marks.filter((m) => m.kind === "capture");
    assert.equal(new Set(captures.map((m) => `${m.team}:${m.label}`)).size, captures.length);
    assert.deepEqual(layout.marks, original, "Display must preserve original mission records");
    for (const mark of captures)
      assert.equal(
        mark,
        layout.marks.find(
          (m) => m.kind === "capture" && m.team === mark.team && m.label === mark.label,
        ),
      );
  }
const africa = maps
  .find((m) => m.id === "avg_africa_desert")
  .layouts.find((l) => l.id === "africa_desert_dom");
assert.equal(displayMapMarks(africa.marks).filter((m) => m.label === "B").length, 1);
const spawn = { kind: "spawn", team: 1, label: "出生点", x: 0.1, y: 0.2 };
assert.equal(displayMapMarks([spawn, { ...spawn }, { ...spawn, x: 0.3 }]).length, 2);

let indexCalls = 0,
  svgCalls = 0;
let fail = false;
const cache = new MapRouteCache({
  index: async () => {
    indexCalls++;
    return routes;
  },
  svg: async () => {
    svgCalls++;
    if (fail) throw Error("temporary failure");
    return new Blob(["<svg/>"]);
  },
});
try {
  const route = routes[0];
  const args = ["release-one", route.mapId, route.layoutId, route.team];
  const key = cache.key(...args);
  const release = cache.retain(key);
  const [a, b] = await Promise.all([cache.load(...args), cache.load(...args)]);
  assert.equal(a, b, "Concurrent loads must share one SVG");
  assert.equal(indexCalls, 1);
  assert.equal(svgCalls, 1);
  for (let i = 0; i < 5; i++) {
    assert.equal(cache.peek(key).route.url, a.url);
    assert.equal(await cache.load(...args), a, "Visibility toggles must reuse the object URL");
  }
  assert.equal(svgCalls, 1, "Toggling must not download again");
  await cache.load(args[0], args[1], args[2], route.team === 1 ? 2 : 1);
  assert.equal(indexCalls, 1, "Both teams share the coverage index");
  assert.equal(svgCalls, 2);
  fail = true;
  await assert.rejects(cache.load("release-two", ...args.slice(1)), /temporary failure/);
  fail = false;
  const other = await cache.load("release-two", ...args.slice(1));
  assert.notEqual(other.url, a.url, "A new release must not use the old SVG");
  release();
  cache.dispose();
  assert.equal(cache.peek(key), null, "Identity change must discard cached routes");
  await assert.rejects(cache.load(...args), { name: "AbortError" });
} finally {
  cache.dispose();
}
let finish;
const late = new MapRouteCache({
  index: async () => routes,
  svg: () =>
    new Promise((resolve) => {
      finish = resolve;
    }),
});
const r = routes[0];
const pending = late.load("late", r.mapId, r.layoutId, r.team);
await new Promise((resolve) => setImmediate(resolve));
late.dispose();
finish(new Blob(["<svg/>"]));
await assert.rejects(pending, { name: "AbortError" });
assert.equal(late.peek(late.key("late", r.mapId, r.layoutId, r.team)), null);
const alternate = { ...r, id: `${r.id}-alternate` };
const routeA = { ...r, tacticsMarkdown: "A-side explanation", guideVersion: 1 };
const routeB = { ...alternate, tacticsMarkdown: "B-side explanation", guideVersion: 2 };
const otherTeam = {
  ...r,
  id: `${r.id}-other-team`,
  team: r.team === 1 ? 2 : 1,
  tacticsMarkdown: "Other team",
};
const otherLayout = {
  ...r,
  id: `${r.id}-other-layout`,
  layoutId: `${r.layoutId}-other`,
  tacticsMarkdown: "Other layout",
};
const options = routesForContext(
  [routeA, routeB, { ...routeB }, otherTeam, otherLayout],
  r.mapId,
  r.layoutId,
  r.team,
);
assert.deepEqual(
  options.map((item) => item.id),
  [routeB.id, routeA.id],
  "Context options are unique and newest first",
);
assert.equal(selectedMapRoute(options, routeA.id).tacticsMarkdown, "A-side explanation");
assert.equal(selectedMapRoute(options, routeB.id).tacticsMarkdown, "B-side explanation");
assert.equal(
  selectedMapRoute(options, "retired-id"),
  routeB,
  "Invalid saved choice falls back to a valid route",
);
assert.equal(
  selectedMapRoute(
    routesForContext([routeA, routeB, otherTeam], r.mapId, r.layoutId, otherTeam.team),
    routeB.id,
  )?.tacticsMarkdown,
  "Other team",
  "Team changes cannot retain another side's text",
);
assert.equal(
  selectedMapRoute(
    routesForContext([routeA, routeB, otherLayout], r.mapId, otherLayout.layoutId, r.team),
    routeB.id,
  )?.tacticsMarkdown,
  "Other layout",
  "Layout changes cannot retain another layout's text",
);
const selectedDownloads = [];
const selectionCache = new MapRouteCache({
  index: async () => [r, alternate],
  svg: async (route) => {
    selectedDownloads.push(route.id);
    return new Blob(["<svg/>"]);
  },
});
try {
  const first = await selectionCache.loadById("multi", r.id);
  assert.deepEqual(selectedDownloads, [r.id], "Only the selected SVG may be downloaded");
  assert.equal(
    selectionCache.peek(selectionCache.routeKey("multi", r.id)).route,
    first,
    "A hidden selected layer keeps its loaded SVG without starting another request",
  );
  assert.equal(
    selectionCache.peek(selectionCache.routeKey("multi", alternate.id)),
    null,
    "An unselected SVG remains untouched while the layer is hidden",
  );
  assert.equal(
    await selectionCache.loadById("multi", r.id),
    first,
    "A hidden route keeps its blob URL",
  );
  const second = await selectionCache.loadById("multi", alternate.id);
  assert.notEqual(second.url, first.url, "Separate strategies retain separate SVG blobs");
  assert.deepEqual(selectedDownloads, [r.id, alternate.id]);
  assert.equal(
    await selectionCache.loadById("multi", r.id),
    first,
    "Switching back reuses the SVG",
  );
} finally {
  selectionCache.dispose();
}
console.log(
  "Route session cache: shared requests, selected-only SVG, instant reuse, retry, release/identity isolation; mission capture deduplication passed.",
);
