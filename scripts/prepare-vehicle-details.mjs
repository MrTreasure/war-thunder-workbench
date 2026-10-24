/** Extract allowlisted published Wiki card fields from archived HTML only. */
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
const digest = (text) => createHash("sha256").update(text).digest("hex");
if (treesDirectory)
  for (const category of ["ground", "aviation", "helicopters", "ships", "boats"]) {
    const html = await readFile(resolve(treesDirectory, `${category}.html`), "utf8");
    const literal = html.match(/window\.WT_UnitList\s*=\s*('(?:\\.|[^'\\])*')/)?.[1];
    if (!literal) throw Error(`Missing ${category} Wiki metadata`);
    const rows = JSON.parse(runInNewContext(literal, Object.create(null), { timeout: 100 }));
    for (const row of rows) {
      if (typeof row[0] !== "string" || !/^[a-zA-Z0-9_-]+$/.test(row[0]))
        throw Error("Invalid Wiki vehicle ID");
      const info = row[7],
        price = info?.[1];
      if (
        !Array.isArray(price) ||
        !Number.isSafeInteger(price[0]) ||
        price[0] < 0 ||
        !["w", "g"].includes(price[2])
      )
        continue;
      data.vehicles[row[0]] = {
        ...data.vehicles[row[0]],
        purchase: {
          currency: price[2] === "g" ? "GE" : "SL",
          amount: price[0],
          source: `https://wiki.warthunder.com/${category}`,
          checkedAt,
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
let rewardCount = 0;
if (unitsDirectory)
  for (const name of await readdir(unitsDirectory)) {
    if (!/^[a-zA-Z0-9_-]+\.html$/.test(name)) continue;
    const id = name.slice(0, -5),
      html = await readFile(resolve(unitsDirectory, name), "utf8");
    const { document } = parseHTML(html);
    const header = [...document.querySelectorAll(".game-unit_chars-header")].find(
      (el) => el.textContent.trim() === "Reward multiplier",
    );
    if (!header) throw Error(`Missing reward block: ${id}`);
    const block = header.parentElement.parentElement;
    const order = block
      .querySelector(".game-unit_chars-info")
      ?.textContent.toLowerCase()
      .match(/\b(?:ab|rb|sb)\b/g);
    if (!order?.length || new Set(order).size !== order.length)
      throw Error(`Unknown reward mode order: ${id}`);
    const rewards = {
      source: `https://wiki.warthunder.com/unit/${id}`,
      checkedAt,
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
  }
await writeFile(path, JSON.stringify(data) + "\n");
console.log(
  `Prepared Wiki prices for ${Object.keys(data.vehicles).length} vehicles; ${rewardCount} reward cards read. Previous verified cards retained.`,
);
