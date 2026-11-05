/** Current catalog ratings must replace published snapshots without changing the post. */
import assert from "node:assert/strict";
import rules from "../data/lineup-rules.json" with { type: "json" };
import { currentCommunityRating } from "../src/lineup-community-rating.ts";
import { lineupMatchmakingWindow } from "../src/lineups.ts";

const post = {
  id: "historical-post",
  slots: ["tank", "lower", "plane", "heli", null],
  battle: "ground",
  mode: "rb",
  activeAircraft: "",
  step: 35,
  rating: "12.7",
};
const vehicle = (id, category, br) => ({ id, name: id, category, br });
const units = new Map([
  ["tank", vehicle("tank", "ground", { ab: 37, rb: 37 })],
  ["lower", vehicle("lower", "ground", { ab: 35, rb: 35 })],
  ["plane", vehicle("plane", "aviation", { ab: 42, rb: 42, trb: 36 })],
  ["heli", vehicle("heli", "helicopters", { ab: 38, rb: 36 })],
]);
let rating = currentCommunityRating(post, units, rules);
assert.equal(rating.label, "13.3");
assert.equal(rating.step, 37);
assert.deepEqual(lineupMatchmakingWindow(rating.step, "rb", rules), {
  minimum: "12.3",
  maximum: "14.3",
});
assert.equal(post.rating, "12.7", "Reading current BR must not rewrite publication history");
assert.equal(currentCommunityRating({ ...post, mode: "ab" }, units, rules).step, 37);
units.set("tank", vehicle("tank", "ground", { ab: 35, rb: 35 }));
assert.equal(currentCommunityRating(post, units, rules).step, 36, "Ground RB uses aircraft trb");
units.set("heli", vehicle("heli", "helicopters", { ab: 38, rb: 39 }));
assert.equal(currentCommunityRating(post, units, rules).step, 39, "Ground RB includes helicopters");
assert.equal(currentCommunityRating({ ...post, mode: "ab" }, units, rules).step, 35);
units.delete("tank");
rating = currentCommunityRating(post, units, rules);
assert.equal(rating.step, null);
assert.equal(rating.label, "资料待更新", "Missing vehicles must not reuse the old rating");
units.set("tank", vehicle("tank", "ground", { ab: 37, rb: null }));
assert.equal(currentCommunityRating(post, units, rules).label, "权重未知");
assert.equal(currentCommunityRating({ ...post, mode: "sb" }, units, rules).step, null);
console.log("Lineup current-rating regressions passed");
