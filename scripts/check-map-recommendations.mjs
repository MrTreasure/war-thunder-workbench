import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DOMParser } from "linkedom";
const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const { routes } = await read("data/map-recommendations.json");
const { maps } = await read("data/ground-maps.json");
const seen = new Set(),
  pairs = new Map();
for (const route of routes) {
  const map = maps.find((m) => m.id === route.mapId);
  assert(
    map?.layouts.some((l) => l.id === route.layoutId),
    route.id + ": unknown mission",
  );
  assert([1, 2].includes(route.team));
  const key = `${route.mapId}:${route.layoutId}:${route.team}`;
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
  `Recommended routes: ${routes.length} SVGs, ${pairs.size} layouts, ${new Set(routes.map((r) => r.mapId)).size} maps; mission/side, projection and safe SVG checks passed.`,
);
