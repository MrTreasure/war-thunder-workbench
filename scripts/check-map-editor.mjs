import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseProject,
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
const iconIds = new Set(catalog.icons.map((i) => i.id));
assert.equal(iconIds.size, 79);
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
  "Map editor verified: import validation, immutable movement, arrow geometry, undo/redo, history grouping, scoped persistence and 79 original icon records",
);
