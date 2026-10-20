import { chromium } from "playwright";
import { parseHTML } from "linkedom";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { refreshMapCollections } from "./extract-map-collections.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split(/=(.*)/s)));
const source = args.get("source") || "https://render.mrtreasure.cc/muse/wt-map-atlas/index.html";
const origin = args.get("origin");
const delay = Math.max(6000, Number(args.get("interval") || 7000));
if (!Number.isFinite(delay)) throw Error("Invalid interval");
const now = new Date().toISOString();
const output = resolve(root, "data/map-atlas.json");
const artifacts = resolve(root, "artifacts/atlas-extraction");
await mkdir(artifacts, { recursive: true });
let previous = null;
try {
  previous = JSON.parse(await readFile(output, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (
  !args.has("force") &&
  previous?.collection?.checkedAt &&
  Date.now() - Date.parse(previous.collection.checkedAt) < 6 * 3600_000
) {
  console.log("Recent verified snapshot retained; use --force to check again after the cooldown.");
  await refreshMapCollections(args);
  process.exit(0);
}
const hash = (text) => createHash("sha256").update(text).digest("hex");
const tidy = (text) => text.replace(/\s+/g, " ").trim();
function articleText(value) {
  let html = value;
  try {
    const blocks = JSON.parse(value);
    if (Array.isArray(blocks))
      html = blocks
        .filter((b) => b.type === "html" && typeof b.text === "string")
        .map((b) => b.text)
        .join(" ");
  } catch {
    /* Some public articles still use plain HTML. */
  }
  return tidy(parseHTML(`<main>${html}</main>`).document.querySelector("main").textContent);
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.WT_PLAYWRIGHT_EXECUTABLE
    ? { executablePath: process.env.WT_PLAYWRIGHT_EXECUTABLE }
    : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let lastVisit = 0;
async function visit(page, url) {
  await new Promise((r) => setTimeout(r, Math.max(0, delay - (Date.now() - lastVisit))));
  lastVisit = Date.now();
  console.log("Visiting", url);
  await page.goto(url, { waitUntil: "commit", timeout: 40000 });
}
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (
    ["image", "font", "media"].includes(request.resourceType()) ||
    /data_report|analytics|beacon|related\/recommend_web/.test(url.pathname)
  )
    return route.abort();
  if (origin && url.origin === new URL(source).origin) {
    const target = new URL(url.pathname + url.search, origin);
    const response = await new Promise((resolve, reject) => {
      const req = (target.protocol === "http:" ? httpGet : httpsGet)(
        target,
        { headers: { Host: url.host } },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              contentType: res.headers["content-type"],
              body: Buffer.concat(chunks),
            }),
          );
          res.on("error", reject);
        },
      );
      req.setTimeout(30000, () => req.destroy(Error("Origin timeout")));
      req.on("error", reject);
    });
    return route.fulfill({
      status: response.status,
      contentType: response.contentType || "text/plain",
      body: response.body,
    });
  }
  return route.continue();
});
const page = await context.newPage();
let stopAdditionalVisits = false;
try {
  await visit(page, source);
  await page.locator("#new-guides h3").first().waitFor({ timeout: 30000 });
  const html = await page.content();
  await writeFile(resolve(artifacts, "source.html"), html);
  async function sourceJson(name) {
    return page.evaluate(async (name) => {
      const r = await fetch(name, { cache: "no-store" });
      if (!r.ok) throw Error(`Source ${name}: HTTP ${r.status}`);
      return r.text();
    }, name);
  }
  const guidesText = await sourceJson("guides.json");
  const imagesText = await sourceJson("data.json");
  const originalGuides = JSON.parse(guidesText),
    images = JSON.parse(imagesText);
  await writeFile(resolve(artifacts, "guides.json"), guidesText);
  await writeFile(resolve(artifacts, "images.json"), imagesText);
  if (!Array.isArray(originalGuides) || originalGuides.length < 10 || !Array.isArray(images))
    throw Error("Unexpected source atlas structure; snapshot unchanged");
  const { document } = parseHTML(html);
  const sourceDate = originalGuides
    .map((g) => g.verified)
    .sort()
    .at(-1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) throw Error("Missing source verification date");
  const collectionUrl = document.querySelector('a[href*="collection_detail"]')?.href;
  if (!collectionUrl) throw Error("Missing collection source");
  const guides = originalGuides.map((g) => ({
    id: g.source.split("/").at(-1),
    name: g.name,
    source: g.source,
    overview: g.overview,
    mode: g.mode,
    verifiedAt: g.verified,
    variants: g.variants.map((v) => ({
      id: v.id,
      side: v.side,
      imageId: v.id,
      notes: v.notes.map((text, i) => ({ label: ["开局选择", "转点条件", "风险与取舍"][i], text })),
    })),
  }));
  for (const heading of document.querySelectorAll("#new-guides h3")) {
    const paragraphs = [];
    for (let el = heading.nextElementSibling; el && el.tagName !== "H3"; el = el.nextElementSibling)
      if (el.tagName === "P" && el.querySelector("b")) paragraphs.push(el);
    const link = paragraphs.flatMap((p) => [...p.querySelectorAll("a[href]")])[0]?.href;
    if (!link) throw Error(`Missing source for ${heading.textContent}`);
    const name = tidy(heading.textContent),
      id = link.split("/").at(-1);
    const risk = paragraphs.find((p) => p.querySelector("b")?.textContent.includes("风险"));
    const paragraphText = (p) =>
      tidy(
        p.textContent
          .replace(p.querySelector("b")?.textContent || "", "")
          .replace(p.querySelector("a")?.textContent || "", ""),
      );
    const image = images.find((i) => i.kind === "原图" && i.name === name);
    const variants = paragraphs
      .filter((p) => p !== risk)
      .map((p, i) => ({
        id: `${id}-${i}`,
        side: tidy(p.querySelector("b").textContent).replace(/[：:]$/, ""),
        imageId: image?.id || null,
        notes: [
          { label: "走线思路", text: paragraphText(p) },
          ...(risk ? [{ label: "风险与取舍", text: paragraphText(risk) }] : []),
        ],
      }));
    guides.push({
      id,
      name,
      source: link,
      overview: "已整理走线摘要，标注图请对照作者原帖。",
      mode: "主要面向作者所玩的冷战及以上陆战历史；请在原帖核对地图变体与编号。",
      verifiedAt: sourceDate,
      variants,
    });
  }
  const resources = [...document.querySelectorAll("#guide a[href]")].map((a) => ({
    title: tidy(a.textContent).replace(/\s*↗$/, ""),
    source: a.href,
    context: tidy(a.parentElement.textContent),
  }));
  const records = [],
    pending = [];
  const collectionErrors = [];
  const onResponse = (response) => {
    const url = new URL(response.url());
    if (url.hostname !== "api.xiaoheihe.cn" || !url.pathname.includes("article_collection/"))
      return;
    pending.push(
      (async () => {
        if ([401, 403, 429].includes(response.status()))
          throw Error(`Collection access limited: ${response.status()}`);
        const data = await response.json();
        if (["show_captcha", "need_login", "need_verify", "login_required"].includes(data.status))
          throw Error(`Collection access limited: ${data.status}`);
        if (data.status !== "ok") throw Error("Collection returned an unsuccessful response");
        records.push({ path: url.pathname, data });
      })().catch((error) => collectionErrors.push(error)),
    );
  };
  page.on("response", onResponse);
  await visit(page, collectionUrl);
  for (let turn = 0; turn < 25; turn++) {
    await page.waitForTimeout(1000);
    if (collectionErrors.length) throw collectionErrors[0];
    if (
      records.some((r) => r.path.endsWith("get_collection_detail")) &&
      records.some((r) => r.path.endsWith("get_link_list"))
    )
      break;
  }
  await Promise.all(pending);
  if (collectionErrors.length) throw collectionErrors[0];
  const detail = records.find((r) => r.path.endsWith("get_collection_detail"))?.data.result;
  if (!detail || detail.heybox_info?.username !== "木炉")
    throw Error("Collection author not verified");
  for (let turn = 0; turn < 3; turn++) {
    const articles = records
      .filter((r) => r.path.endsWith("get_link_list"))
      .flatMap((r) => r.data.result.articles || []);
    if (new Set(articles.map((a) => a.share_url)).size >= detail.count) break;
    await page.waitForTimeout(delay);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    await Promise.all(pending);
  }
  const articles = [
    ...new Map(
      records
        .filter((r) => r.path.endsWith("get_link_list"))
        .flatMap((r) => r.data.result.articles || [])
        .map((a) => [a.share_url, a]),
    ).values(),
  ];
  if (articles.length !== detail.count)
    throw Error("Incomplete collection; previous snapshot retained");
  await writeFile(resolve(artifacts, "collection.html"), await page.content());
  await writeFile(
    resolve(artifacts, "collection-responses.json"),
    JSON.stringify(records, null, 2),
  );
  page.off("response", onResponse);
  const known = new Set([
    ...guides.map((g) => g.id),
    ...resources.map((r) => r.source.split("/").at(-1)),
  ]);
  const entries = articles.map((a) => {
    const id = new URL(a.share_url).searchParams.get("link_id");
    if (!id || !/^[a-zA-Z0-9]+$/.test(id)) throw Error("Invalid article identity");
    return {
      id,
      title: a.title,
      source: `https://www.xiaoheihe.cn/app/bbs/link/${id}`,
      publishedAt: new Date(Number(a.create_at) * 1000).toISOString(),
      updatedAt: new Date(Number(a.modify_at) * 1000).toISOString(),
      isMapGuide: guides.some((g) => g.id === id),
      includedInSource: known.has(id),
    };
  });
  const baseline = previous?.collection?.checkedAt || `${sourceDate}T23:59:59+08:00`;
  const articleChecks = { ...previous?.collection?.articleChecks };
  const articleCheckErrors = [];
  const checkLimit = Math.min(12, Math.max(0, Number(args.get("article-checks") || 8)));
  const toCheck = entries
    .filter(
      (e) =>
        (!articleChecks[e.id] ||
          articleChecks[e.id].updatedAt !== e.updatedAt ||
          articleChecks[e.id].bodyFormat !== 1) &&
        Date.parse(e.updatedAt) > Date.parse(`${sourceDate}T23:59:59+08:00`),
    )
    .slice(0, checkLimit);
  for (const entry of toCheck) {
    try {
      const responsePromise = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/bbs/app/link/tree",
        { timeout: 30000 },
      );
      // Attach a rejection handler before navigation so a blocked page cannot
      // leave an unhandled response timeout while the browser is being closed.
      responsePromise.catch(() => {});
      await visit(page, entry.source);
      const response = await responsePromise;
      if (response.status() !== 200) throw Error(`Article HTTP ${response.status()}`);
      const body = await response.json();
      if (["show_captcha", "need_login", "need_verify", "login_required"].includes(body.status))
        throw Error(`Article access limited: ${body.status}`);
      const link = body.result?.link;
      if (
        body.status !== "ok" ||
        !link ||
        link.title !== entry.title ||
        String(link.user?.userid) !== String(detail.heybox_info.userid) ||
        typeof link.text !== "string"
      )
        throw Error("Article identity or body not verified");
      const text = articleText(link.text);
      if (text.length < 40) throw Error("Incomplete article text");
      await writeFile(resolve(artifacts, `article-${entry.id}.txt`), text);
      articleChecks[entry.id] = {
        source: entry.source,
        checkedAt: new Date().toISOString(),
        updatedAt: entry.updatedAt,
        bodySha256: hash(text),
        characters: text.length,
        bodyFormat: 1,
      };
      console.log("Article verified", entry.title);
    } catch (error) {
      articleCheckErrors.push({ id: entry.id, source: entry.source, error: error.message });
      if (/401|403|429|access limited/.test(error.message)) {
        stopAdditionalVisits = true;
        break;
      }
    }
  }
  const collection = {
    source: collectionUrl,
    author: detail.heybox_info.username,
    title: detail.title,
    checkedAt: new Date().toISOString(),
    count: detail.count,
    complete: true,
    articleChecks,
    articleCheckErrors,
    entries,
    newEntries: entries.filter((e) => !known.has(e.id)),
    publishedAfterSnapshot: entries
      .filter((e) => Date.parse(e.publishedAt) > Date.parse(baseline))
      .map((e) => e.id),
    editedAfterSnapshot: entries
      .filter((e) => Date.parse(e.updatedAt) > Date.parse(baseline))
      .map((e) => e.id),
    sha256: hash(JSON.stringify(entries)),
  };
  const data = {
    schemaVersion: 1,
    extractedAt: now,
    source: {
      url: source,
      checkedAt: now,
      sha256: hash(html),
      guidesSha256: hash(guidesText),
      imagesSha256: hash(imagesText),
    },
    collection,
    guides,
    images,
    resources,
    attribution: "非官方玩家资料整理。攻略摘要依据木炉原帖，走线标注归原作者，游戏素材归原权利人。",
    scope: "主要面向冷战及以上陆战历史。走线取决于地图变体、车辆和实时敌情，请结合原帖判断。",
  };
  await writeFile(output, JSON.stringify(data, null, 2) + "\n");
  console.log(
    JSON.stringify({
      guides: guides.length,
      images: images.length,
      collectionEntries: entries.length,
      newEntries: collection.newEntries.map((e) => e.title),
      editedSinceSnapshot: collection.editedAfterSnapshot.length,
    }),
  );
} finally {
  await browser.close();
}
if (!stopAdditionalVisits) await refreshMapCollections(args);
