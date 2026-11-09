import assert from "node:assert/strict";
import { build } from "vite";
import { resolve } from "node:path";
const result = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: false,
    lib: { entry: resolve("src/home-watch-section-model.ts"), formats: ["es"] },
  },
});
const code = (Array.isArray(result) ? result[0] : result).output.find(
  (item) => item.type === "chunk",
).code;
const { homeWatchPage, homeWatchActiveSale } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
assert.deepEqual(homeWatchPage(0, 99), { page: 1, pages: 1, offset: 0 });
assert.deepEqual(homeWatchPage(9, 3), { page: 3, pages: 3, offset: 8 });
assert.deepEqual(homeWatchPage(3, 3), { page: 1, pages: 1, offset: 0 });
const vehicle = { id: "fixture", country: "usa", category: "aviation", channel: "ge" };
const now = Date.parse("2026-11-09T12:00:00Z");
const event = {
  id: "fixture-sale",
  status: "confirmed",
  startAt: "2026-11-09T10:00:00Z",
  endAt: "2026-11-09T14:00:00Z",
  countries: ["usa"],
  categories: ["aviation"],
  channels: ["ge"],
  coverage: "explicit",
  vehicleIds: ["fixture"],
  excludedVehicleIds: [],
  discounts: [{ channel: "ge", percentOff: 50 }],
  sources: [],
};
assert.equal(homeWatchActiveSale(vehicle, [event], now)?.label, "当前 5折");
for (const change of [
  { status: "predicted" },
  { startAt: "2026-11-09T13:00:00Z" },
  { endAt: "2026-11-09T12:00:00Z" },
  { excludedVehicleIds: ["fixture"] },
  { vehicleIds: [] },
  { countries: ["germany"] },
  { categories: ["ground"] },
  { channels: ["pack"] },
])
  assert.equal(
    homeWatchActiveSale(vehicle, [{ ...event, ...change }], now),
    null,
    JSON.stringify(change),
  );
assert.equal(homeWatchActiveSale(vehicle, [event], Date.parse(event.startAt))?.label, "当前 5折");
assert.equal(homeWatchActiveSale(vehicle, [event], Date.parse(event.endAt)), null);
assert.equal(
  homeWatchActiveSale(vehicle, [{ ...event, discounts: [] }], now)?.label,
  "当前活动 · 力度见公告",
);
assert.equal(
  homeWatchActiveSale(
    vehicle,
    [
      {
        ...event,
        discounts: [
          { channel: "ge", percentOff: 50 },
          { channel: "ge", percentOff: 30 },
        ],
      },
    ],
    now,
  )?.label,
  "当前活动 · 力度见公告",
);
assert.equal(
  homeWatchActiveSale(
    vehicle,
    [{ ...event, discounts: [{ channel: "pack", percentOff: 50 }] }],
    now,
  )?.label,
  "当前活动 · 力度见公告",
);
assert.equal(homeWatchActiveSale({ ...vehicle, channel: "excluded" }, [event], now), null);
console.log(
  "Home watch pagination and active promotion boundaries passed: clamped pages, confirmed exact participation, exclusions, time boundaries and unknown/ambiguous rates.",
);
