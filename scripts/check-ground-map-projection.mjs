import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONTOUR_IMAGE_MATRIX,
  CONTOUR_IMAGE_TRANSFORM,
  referenceGrid,
  worldToMap,
} from "../src/ground-map-projection.ts";

const atlas = JSON.parse(
  await readFile(new URL("../data/ground-maps.json", import.meta.url), "utf8"),
);
const map = (id) => atlas.maps.find((m) => m.id === id);
const bounds = [
  [1024, -2048],
  [3072, 2048],
];
assert.deepEqual(worldToMap(bounds, [1024, 2048]), { x: 0, y: 0 });
assert.deepEqual(worldToMap(bounds, [3072, -2048]), { x: 1, y: 1 });
assert.deepEqual(worldToMap(bounds, [2048, 0]), { x: 0.5, y: 0.5 });

// Regression from the user's in-game American Desert comparison: A below B,
// C above B. World Z increases upwards, while image v increases downwards.
const american = map("avg_american_valley");
const dom = american.layouts.find((l) => l.id === "american_valley_dom");
assert(Math.abs(dom.crop[1] - 0.32904051666220724) < 1e-12);
assert(Math.abs(dom.crop[3] - 0.6586303817752928) < 1e-12);
const capture = (layout, label) =>
  layout.marks.find((m) => m.kind === "capture" && m.label === label);
assert(capture(dom, "A").y > capture(dom, "B").y);
assert(capture(dom, "C").y < capture(dom, "B").y);
const teamMarks = (team) => dom.marks.filter((m) => m.kind === "spawn" && m.team === team);
assert(Math.min(...teamMarks(1).map((m) => m.y)) > Math.max(...teamMarks(2).map((m) => m.y)));

const berlin = map("avg_berlin");
const berlinDom = berlin.layouts.find((l) => l.id === "berlin_dom");
assert(Math.abs(capture(berlinDom, "A").y - 0.4537597894668579) < 1e-12);

// Cropping preserves the point's world-relative location. It is not a second flip.
for (const m of atlas.maps) {
  for (const l of m.layouts) {
    for (const p of l.marks) {
      const expected = worldToMap(m.bounds, p.world);
      assert(Math.abs(expected.x - p.x) < 1e-12);
      assert(Math.abs(expected.y - p.y) < 1e-12);
    }
  }
  const grid = referenceGrid(m.bounds, m.grid.default_reference);
  assert.equal(grid.horizontal[0].label, "A");
  assert.equal(grid.horizontal[0].position, 0);
  assert(grid.horizontal[1].position > grid.horizontal[0].position);
}

// The original contour SVG's +Z-down coordinates require one reflection.
// Both the SVG layer and Canvas export consume this exact matrix.
const [a, b, c, d, e, f] = CONTOUR_IMAGE_MATRIX;
const transform = (x, y) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
assert.deepEqual(transform(25, 100), { x: 25, y: 900 });
assert.deepEqual(transform(25, 900), { x: 25, y: 100 });
assert.equal(CONTOUR_IMAGE_TRANSFORM, atlas.projection.contourSvgTransform);
console.log(
  "Ground-map projection verified: in-game American Desert/Berlin regression, all world points, top-down grid and shared SVG/PNG contour reflection",
);
