import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseProject,
  bendPoints,
  curveControls,
  routePoint,
  pathData,
  routeDash,
  routeDecorations,
  shapeCorners,
  shapeBounds,
  shapePath,
  mapView,
  makeProject,
  moveAnnotation,
  createHistory,
  reduceHistory,
  arrowPoints,
  draftKey,
  readProject,
  writeProject,
} from "../src/map-editor-model.ts";
const catalog = JSON.parse(
  await readFile(new URL("../data/map-editor-icons.json", import.meta.url), "utf8"),
);
const symbolCatalog = JSON.parse(
  await readFile(new URL("../data/map-editor-symbols.json", import.meta.url), "utf8"),
);
const iconIds = new Set([
  ...catalog.icons.map((i) => i.id),
  ...symbolCatalog.symbols.map((i) => i.id),
]);
assert.equal(new Set(catalog.icons.map((i) => i.id)).size, 79);
assert.equal(iconIds.size, 79 + symbolCatalog.symbols.length);
assert.match(catalog.commit, /^[a-f0-9]{40}$/);
for (const icon of catalog.icons) {
  assert(
    icon.asset.url.startsWith(
      `https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@${catalog.commit}/war-thunder/map-editor/v1/`,
    ),
  );
  assert(icon.asset.url.includes(icon.asset.sha256.slice(0, 24)));
  assert(icon.asset.bytes > 0);
}
const context = { mapId: "test-map", layoutId: "dom", team: 1 };
const known = (c) => c.mapId === "test-map" && c.layoutId === "dom";
const base = { id: "route-1", color: "#e4c477", hidden: false, locked: false };
const path = {
  ...base,
  kind: "path",
  points: [
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.7 },
  ],
  width: 0.003,
  dashed: false,
  arrow: true,
};
// Curve endpoints, midpoints and shared SVG/PNG path commands stay in the same UV space.
const curve = {
  ...path,
  id: "curve-1",
  curve: true,
  points: bendPoints(path.points[0], path.points[1]),
  lineStyle: "defense",
};
assert.equal(curve.points.length, 3);
assert.deepEqual(routePoint(curve, 0, 0), curve.points[0]);
assert.deepEqual(routePoint(curve, 1, 1), curve.points[2]);
assert.match(pathData(curve.points, true), /C/);
assert(!pathData(path.points).includes("C"));
assert.notDeepEqual(routePoint(curve, 0, 0.5), {
  x: (curve.points[0].x + curve.points[1].x) / 2,
  y: (curve.points[0].y + curve.points[1].y) / 2,
});
for (const p of curveControls(curve.points, 0))
  assert(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
assert(routeDecorations(curve).length > 0);
assert.equal(routeDecorations({ ...curve, lineStyle: "solid" }).length, 0);
assert(routeDecorations({ ...curve, lineStyle: "barrier" }).length > 0);
assert.deepEqual(routeDash({ ...path, lineStyle: "solid", dashed: true }), []);
assert(routeDash({ ...path, lineStyle: "dashdot" }).length === 4);
const area = {
  ...base,
  id: "area-1",
  kind: "shape",
  shape: "polygon",
  points: shapeCorners({ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.8 }),
  width: 0.003,
  fillOpacity: 0.12,
  hatch: true,
  caption: "危险区域",
};
assert.match(shapePath(area), /Z$/);
assert.match(
  shapePath({ ...area, shape: "ellipse", points: [area.points[0], area.points[2]] }),
  /a/,
);
const movedArea = moveAnnotation(area, 1, -1),
  bounds = shapeBounds(movedArea);
assert(Math.abs(bounds.x + bounds.w - 1) < 1e-10);
assert.equal(bounds.y, 0);
assert.deepEqual(area.points[0], { x: 0.2, y: 0.3 });
assert.deepEqual(parseProject(makeProject(context, [curve, area]), iconIds, known).items, [
  curve,
  area,
]);
assert.throws(() =>
  parseProject(makeProject(context, [{ ...curve, lineStyle: "javascript:bad" }]), iconIds, known),
);
assert.throws(() =>
  parseProject(makeProject(context, [{ ...curve, curve: "yes" }]), iconIds, known),
);
for (const invalidArea of [
  { ...area, points: [area.points[0], area.points[1]] },
  { ...area, fillOpacity: 1 },
  { ...area, hatch: "true" },
  { ...area, shape: "iframe" },
])
  assert.throws(() => parseProject(makeProject(context, [invalidArea]), iconIds, known));
for (const aspect of [0.4, 1, 1.7, 3.5])
  for (const zoom of [1, 2, 8])
    for (const offset of [
      { x: 0, y: 0 },
      { x: -2000, y: 2000 },
    ]) {
      const view = mapView([0.2, 0.2, 0.725, 0.725], zoom, offset);
      assert(Math.abs(view.w - 525 / zoom) < 1e-8);
      assert(Math.abs(view.h - 525 / zoom) < 1e-8);
      // Wide or tall canvases must not change the selected layout or crop its edges.
      const displayScale = Math.min((aspect * 1000) / view.w, 1000 / view.h);
      assert(view.w * displayScale <= aspect * 1000 + 1e-8 && view.h * displayScale <= 1000 + 1e-8);
      assert(
        view.x >= 0 &&
          view.y >= 0 &&
          view.x + view.w <= 1000 + 1e-8 &&
          view.y + view.h <= 1000 + 1e-8,
      );
    }
const icon = {
  ...base,
  id: "icon-1",
  kind: "icon",
  point: { x: 0.5, y: 0.5 },
  size: 0.035,
  rotation: 90,
  iconId: catalog.icons[0].id,
  caption: "防守点",
};
const symbolMarker = { ...icon, id: "symbol-1", iconId: "tactical_sniper", caption: "狙击点" };
assert.deepEqual(parseProject(makeProject(context, [symbolMarker]), iconIds, known).items, [
  symbolMarker,
]);
assert.throws(() =>
  parseProject(
    makeProject(context, [{ ...symbolMarker, iconId: "tactical_untrusted" }]),
    iconIds,
    known,
  ),
);
const playerIcon = catalog.icons.find((i) => i.id === "map_player_tank_hull");
assert.notEqual(playerIcon.asset.sha256, playerIcon.asset.sourceSha256);
assert(
  playerIcon.asset.normalization.includes("Added SVG namespace for standalone image rendering"),
);
const text = {
  ...base,
  id: "text-1",
  kind: "text",
  point: { x: 0.1, y: 0.1 },
  text: "绕侧线\n第二步",
  fontSize: 0.018,
  rotation: 0,
};
const project = makeProject(context, [path, icon, text]);
assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project)), iconIds, known), project);
const moved = moveAnnotation(path, 1, -1);
assert.equal(moved.points[1].x, 1);
assert.equal(moved.points[0].y, 0);
assert(Math.abs(moved.points[1].x - moved.points[0].x - 0.6) < 1e-10);
assert.deepEqual(path.points, [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.7 },
]);
assert.deepEqual(
  arrowPoints({
    ...path,
    points: [
      { x: 0.2, y: 0.3 },
      { x: 0.8, y: 0.7 },
      { x: 0.8, y: 0.7 },
    ],
  }),
  arrowPoints(path),
);
assert.equal(
  arrowPoints({
    ...path,
    points: [
      { x: 0.3, y: 0.3 },
      { x: 0.3, y: 0.3 },
    ],
  }).length,
  0,
);
let h = createHistory();
h = reduceHistory(h, { type: "commit", items: [path] });
h = reduceHistory(h, { type: "commit", items: [path, icon] });
h = reduceHistory(h, { type: "undo" });
assert.deepEqual(h.present, [path]);
h = reduceHistory(h, { type: "redo" });
assert.deepEqual(h.present, [path, icon]);
h = reduceHistory(h, { type: "undo" });
h = reduceHistory(h, { type: "commit", items: [text] });
assert.equal(h.future.length, 0);
h = createHistory([path]);
h = reduceHistory(h, { type: "commit", items: [{ ...path, width: 0.005 }], group: "width" });
h = reduceHistory(h, { type: "commit", items: [{ ...path, width: 0.01 }], group: "width" });
assert.equal(h.past.length, 1);
h = reduceHistory(h, { type: "undo" });
assert.equal(h.present[0].width, 0.003);
for (let i = 0; i < 100; i++)
  h = reduceHistory(h, { type: "commit", items: [{ ...path, id: "p" + i }] });
assert.equal(h.past.length, 60);
const reject = (items) => assert.throws(() => parseProject({ ...project, items }, iconIds, known));
reject([
  {
    ...path,
    points: [
      { x: NaN, y: 0 },
      { x: 1, y: 1 },
    ],
  },
]);
reject([
  {
    ...path,
    points: [
      { x: -0.1, y: 0 },
      { x: 1, y: 1 },
    ],
  },
]);
reject([path, path]);
reject([{ ...icon, iconId: "https://evil.invalid/a.svg" }]);
reject([{ ...text, text: "a".repeat(1001) }]);
reject([{ ...path, color: "url(https://evil.invalid)" }]);
reject(Array.from({ length: 501 }, (_, i) => ({ ...text, id: "x" + i })));
assert.throws(() => parseProject({ ...project, version: 2 }, iconIds, known));
assert.throws(() => parseProject({ ...project, team: 1.5 }, iconIds, known));
assert.throws(() => parseProject({ ...project, mapId: "unknown" }, iconIds, known));
const sanitized = parseProject(
  { ...project, items: [{ ...text, href: "https://evil.invalid", __secret: "no" }] },
  iconIds,
  known,
);
assert(!("href" in sanitized.items[0]));
const store = new Map([
  ["wt-lineups-v1:china", "KEEP"],
  ["wt-planner-v1:cart", "KEEP"],
]);
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => store.set(key, value),
};
writeProject(project);
assert.deepEqual(readProject(context, iconIds).items, project.items);
assert.deepEqual(readProject({ ...context, team: 2 }, iconIds).items, []);
assert.notEqual(draftKey(context), draftKey({ ...context, layoutId: "bttl" }));
assert.equal(store.get("wt-lineups-v1:china"), "KEEP");
assert.equal(store.get("wt-planner-v1:cart"), "KEEP");
store.set(draftKey(context), "{broken");
assert.deepEqual(readProject(context, iconIds).items, []);
assert.equal(store.get(draftKey(context)), "{broken");
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
assert.throws(() => writeProject(project));
console.log(
  "Map editor verified: centered layout viewport, tactical symbols, curves, tactical lines, shapes, import validation, immutable movement, undo/redo, scoped persistence and 79 original icon records",
);
