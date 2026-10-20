import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";

const root = fileURLToPath(new URL("../", import.meta.url));
const clean = (text) => text.replace(/\s+/g, " ").trim();
function cnyCents(text) {
  const match = clean(text).match(/^(\d+(?:,\d{3})*)(?:\.(\d{1,2}))?\s*CN¥$/);
  if (!match) throw Error(`Expected an explicit CNY amount: ${clean(text)}`);
  const cents =
    BigInt(match[1].replaceAll(",", "")) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Invalid price");
  return Number(cents);
}

// Read only this product's purchase panel, never recommendations or GJN balances.
export function parseStorePrice(html, productId) {
  const { document } = parseHTML(html);
  const title = clean(document.querySelector(".shop__title")?.textContent || "") || null;
  const item = document.querySelector(".shop-buy [data-cart-item-id]");
  const panel = document.querySelector(".shop-buy__price");
  const unavailable = {
    title,
    currency: "CNY",
    amountCents: null,
    regularAmountCents: null,
    status: "unavailable",
  };
  if (!title || !item) return { ...unavailable, reason: "not_listed" };
  if (item.getAttribute("data-cart-item-id") !== productId)
    throw Error("Store redirected to a different product");
  if (!panel || !panel.textContent.includes("CN¥"))
    return { ...unavailable, reason: "no_cny_price" };
  const old = panel.querySelector('[class*="__old"]');
  const current = panel.querySelector('[class*="__new"]');
  if (Boolean(old) !== Boolean(current)) throw Error("Incomplete discount price");
  const amountCents = cnyCents((current || panel).textContent);
  const regularAmountCents = old ? cnyCents(old.textContent) : amountCents;
  if (regularAmountCents < amountCents) throw Error("Discount exceeds regular price");
  return { title, currency: "CNY", amountCents, regularAmountCents, status: "priced" };
}

async function refresh() {
  const purchases = JSON.parse(await readFile(resolve(root, "data/purchases.json"), "utf8"));
  const path = resolve(root, "data/store-prices.json");
  let data = { schemaVersion: 1, products: {} };
  try {
    data = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const pending = [
    ...new Set(
      Object.values(purchases)
        .filter((p) => p.store)
        .map((p) => new URL(p.store).searchParams.get("id")),
    ),
  ].filter((id) => !process.argv.includes("--only-missing") || !data.products[id]);
  const errors = [];
  let done = 0;
  async function worker() {
    while (pending.length) {
      const id = pending.shift();
      const source = `https://store.gaijin.net/story.php?id=${id}&skin_lang=zh`;
      try {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await fetch(source, {
              signal: AbortSignal.timeout(30000),
              headers: { "User-Agent": "WT-Workbench/1.0 (public store price reference)" },
            });
            if (!response.ok) throw Error(`HTTP ${response.status}`);
            break;
          } catch (error) {
            if (attempt === 1) throw error;
          }
        }
        const finalUrl = new URL(response.url);
        if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "store.gaijin.net")
          throw Error("Unexpected store response origin");
        const html = await response.text();
        const notFound =
          finalUrl.pathname === "/404.php" &&
          parseHTML(html).document.querySelector(".error-page__status_404");
        if (!notFound && !html.includes('class="shop') && !html.includes('class="showcase'))
          throw Error("Missing store content");
        const price = parseStorePrice(html, id);
        data.products[id] = {
          productId: id,
          ...price,
          source,
          finalUrl: response.url,
          checkedAt: new Date().toISOString(),
          sha256: createHash("sha256").update(html).digest("hex"),
        };
      } catch (error) {
        // Keep the previous verified record and timestamp on any failed request.
        errors.push({ productId: id, source, error: error.message });
      }
      done++;
      if (done % 10 === 0 || !pending.length) console.log(`Store prices: ${done} checked`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  const rows = Object.values(data.products);
  const report = {
    checkedAt: new Date().toISOString(),
    products: rows.length,
    priced: rows.filter((p) => p.status === "priced").length,
    unavailable: rows.filter((p) => p.status === "unavailable").length,
    errors,
  };
  await writeFile(
    resolve(root, "data/store-prices-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  if (errors.length)
    throw Error(
      "Price refresh failed; previous records retained. See data/store-prices-report.json",
    );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await refresh();
