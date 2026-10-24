/** Extract allowlisted published Wiki card fields from archived HTML only. */
import { gunzipSync } from "node:zlib";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
const root = fileURLToPath(new URL("../", import.meta.url));
const option = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const treesDirectory = option("trees-dir"),
  unitsDirectory = option("units-dir");
const checkedAt = option("checked-at") || new Date().toISOString();
const onlyMissing = process.argv.includes("--only-missing");
const collectionPath = option("collection-manifest");
const collection = collectionPath ? JSON.parse(await readFile(collectionPath, "utf8")) : null;
const capturedAt = (key) => collection?.sources?.[key]?.checkedAt || checkedAt;
async function capturedPage(directory, name) {
  try {
    return await readFile(resolve(directory, name + ".html"), "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return gunzipSync(await readFile(resolve(directory, name + ".html.gz"))).toString("utf8");
  }
}
if (!treesDirectory && !unitsDirectory)
  throw Error("Supply --trees-dir or --units-dir with archived Wiki HTML");
if (!Number.isFinite(Date.parse(checkedAt))) throw Error("Invalid checked-at");
const path = resolve(root, "data/vehicle-details.json");
let data = { schemaVersion: 1, vehicles: {} };
try {
  data = JSON.parse(await readFile(path, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const canonicalIds = new Map(
  Object.keys(JSON.parse(await readFile(resolve(root, "data/modifications.json"), "utf8"))).map(
    (id) => [id.toLowerCase(), id],
  ),
);
for (const id of Object.keys(data.vehicles)) {
  const canonical = canonicalIds.get(id.toLowerCase());
  if (canonical && canonical !== id) {
    data.vehicles[canonical] = { ...data.vehicles[id], ...data.vehicles[canonical] };
    delete data.vehicles[id];
  }
}
const digest = (text) => createHash("sha256").update(text).digest("hex");
if (treesDirectory)
  for (const category of ["ground", "aviation", "helicopters", "ships", "boats"]) {
    const html = await capturedPage(treesDirectory, category);
    const literal = html.match(/window\.WT_UnitList\s*=\s*('(?:\\.|[^'\\])*')/)?.[1];
    if (!literal) throw Error(`Missing ${category} Wiki metadata`);
    const rows = JSON.parse(runInNewContext(literal, Object.create(null), { timeout: 100 }));
    for (const row of rows) {
      if (typeof row[0] !== "string" || !/^[a-zA-Z0-9_-]+$/.test(row[0]))
        throw Error("Invalid Wiki vehicle ID");
      const unitId = canonicalIds.get(row[0].toLowerCase()) || row[0];
      const info = row[7],
        price = info?.[1];
      if (
        !Array.isArray(price) ||
        !Number.isSafeInteger(price[0]) ||
        price[0] < 0 ||
        !["w", "g"].includes(price[2])
      )
        continue;
      if (onlyMissing && data.vehicles[unitId]?.purchase) continue;
      data.vehicles[unitId] = {
        ...data.vehicles[unitId],
        purchase: {
          currency: price[2] === "g" ? "GE" : "SL",
          amount: price[0],
          source: `https://wiki.warthunder.com/${category}`,
          checkedAt: capturedAt(`trees/${category}`),
          sha256: digest(html),
        },
      };
    }
  }
function multiplier(text, modeOrder) {
  const normalized = text.replaceAll("×", "x").replace(/\s+/g, " ").trim();
  const match =
    /^(?:(\d+(?:\.\d+)?)\s*x\s*)?\(?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*\)?\s*%$/.exec(
      normalized,
    );
  if (!match) throw Error(`Unsupported reward multiplier: ${normalized}`);
  const factor = match[1] ? Number(match[1]) : 1,
    values = match[2].split("/").map(Number);
  if (
    !(values.length === 1 || values.length === modeOrder.length) ||
    factor <= 0 ||
    values.some((v) => !Number.isFinite(v) || v < 0)
  )
    throw Error("Invalid reward multiplier");
  const basePercent = Object.fromEntries(
    modeOrder.map((mode, i) => [mode, values.length === 1 ? values[0] : values[i]]),
  );
  return {
    factor,
    basePercent,
    percent: Object.fromEntries(
      Object.entries(basePercent).map(([mode, value]) => [mode, value * factor]),
    ),
  };
}
let rewardCount = 0,
  rewardNotListed = 0;
const rewardErrors = [];
if (unitsDirectory)
  for (const name of await readdir(unitsDirectory)) {
    if (!/^[a-zA-Z0-9_-]+\.html(?:\.gz)?$/.test(name)) continue;
    const id = name.replace(/\.html(?:\.gz)?$/, ""),
      html = await capturedPage(unitsDirectory, id);
    if (onlyMissing && data.vehicles[id]?.rewards?.rp && data.vehicles[id]?.rewards?.sl) continue;
    try {
      const { document } = parseHTML(html);
      const header = [...document.querySelectorAll(".game-unit_chars-header")].find(
        (el) => el.textContent.trim() === "Reward multiplier",
      );
      if (!header) {
        if (!document.querySelector(".game-unit_card"))
          throw Error("Missing official vehicle card");
        data.vehicles[id] = {
          ...data.vehicles[id],
          rewardStatus: {
            state: "not_listed",
            source: `https://wiki.warthunder.com/unit/${id}`,
            checkedAt: capturedAt(`units/${id}`),
            sha256: digest(html),
          },
        };
        rewardNotListed++;
        continue;
      }
      const block = header.parentElement.parentElement;
      const order = block
        .querySelector(".game-unit_chars-info")
        ?.textContent.toLowerCase()
        .match(/\b(?:ab|rb|sb)\b/g);
      if (!order?.length || new Set(order).size !== order.length)
        throw Error(`Unknown reward mode order: ${id}`);
      const rewards = {
        source: `https://wiki.warthunder.com/unit/${id}`,
        checkedAt: capturedAt(`units/${id}`),
        sha256: digest(html),
      };
      for (const value of block.querySelectorAll(".game-unit_chars-value")) {
        const currency = value.querySelector("img[alt='SL']")
          ? "sl"
          : value.querySelector("img[alt='RP']")
            ? "rp"
            : null;
        if (currency) rewards[currency] = multiplier(value.textContent, order);
      }
      if (!rewards.sl || !rewards.rp) throw Error(`Incomplete reward block: ${id}`);
      data.vehicles[id] = { ...data.vehicles[id], rewards };
      rewardCount++;
    } catch (error) {
      rewardErrors.push({
        id,
        message: error instanceof Error ? error.message : "Invalid official reward block",
      });
    }
  }
await writeFile(path, JSON.stringify(data) + "\n");
if (collectionPath)
  await writeFile(
    resolve(collectionPath, "../rewards-parse.json"),
    JSON.stringify(
      { rewardCardsPrepared: rewardCount, rewardNotListed, errors: rewardErrors },
      null,
      2,
    ) + "\n",
  );
if (rewardErrors.length) {
  console.error(`Preserved previous reward records for ${rewardErrors.length} parsing errors.`);
  process.exitCode = 1;
}
console.log(
  `Prepared Wiki prices for ${Object.keys(data.vehicles).length} vehicles; ${rewardCount} reward cards read; ${rewardNotListed} official pages without a reward block. Previous verified cards retained.`,
);
