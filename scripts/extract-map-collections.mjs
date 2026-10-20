import { chromium } from "playwright";
import { parseHTML } from "linkedom";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const clean = (value) => value.replace(/\s+/g, " ").trim();
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
    /* Older posts may contain plain HTML instead of rich-text JSON. */
  }
  return clean(parseHTML(`<main>${html}</main>`).document.querySelector("main").textContent);
}
export async function refreshMapCollections(args = new Map()) {
  const settings = JSON.parse(
    await readFile(resolve(root, "data/map-collection-settings.json"), "utf8"),
  );
  const atlas = JSON.parse(await readFile(resolve(root, "data/map-atlas.json"), "utf8"));
  const path = resolve(root, "data/map-collections.json");
  let data = { schemaVersion: 1, categoryLabels: settings.categoryLabels, collections: [] };
  try {
    data = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const delay = Math.max(7000, Number(args.get("interval") || 8000));
  const checkLimit = Math.min(12, Math.max(0, Number(args.get("article-checks") || 8)));
  if (!Number.isFinite(delay) || !Number.isFinite(checkLimit))
    throw Error("Invalid collection limits");
  const pendingSources = settings.collections.filter((source) => {
    const old = data.collections.find((c) => c.id === source.id);
    return (
      args.has("force") || !old?.complete || Date.now() - Date.parse(old.checkedAt) >= 6 * 3600_000
    );
  });
  if (!pendingSources.length) {
    console.log("Additional collections: recent verified snapshots retained.");
    return;
  }
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.WT_PLAYWRIGHT_EXECUTABLE
      ? { executablePath: process.env.WT_PLAYWRIGHT_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  let lastVisit = Date.now(),
    lastApi = 0,
    apiQueue = Promise.resolve();
  let accessLimited = false;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      ["image", "font", "media"].includes(request.resourceType()) ||
      /data_report|analytics|beacon|related\/recommend_web/.test(url.pathname)
    )
      return route.abort();
    if (
      url.hostname === "api.xiaoheihe.cn" &&
      (url.pathname.includes("article_collection/") || url.pathname === "/bbs/app/link/tree")
    ) {
      apiQueue = apiQueue.then(async () => {
        await new Promise((r) => setTimeout(r, Math.max(0, delay - (Date.now() - lastApi))));
        lastApi = Date.now();
      });
      await apiQueue;
      if (accessLimited) return route.abort();
    }
    return route.continue();
  });
  async function visit(page, url) {
    await new Promise((r) => setTimeout(r, Math.max(0, delay - (Date.now() - lastVisit))));
    if (accessLimited) throw Error("Access limited; stopped without further visits");
    lastVisit = Date.now();
    console.log("Collection visit", url);
    await page.goto(url, { waitUntil: "commit", timeout: 40000 });
  }
  const failures = [];
  try {
    for (const source of pendingSources) {
      const old = data.collections.find((c) => c.id === source.id);
      const artifacts = resolve(root, "artifacts/atlas-collections", source.id);
      await mkdir(artifacts, { recursive: true });
      const page = await context.newPage();
      const records = [],
        tasks = [],
        responseErrors = [];
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.hostname !== "api.xiaoheihe.cn") return;
        if ([401, 403, 429].includes(response.status())) {
          accessLimited = true;
          return;
        }
        if (
          !url.pathname.includes("article_collection/") ||
          url.searchParams.get("obj_id") !== source.id
        )
          return;
        tasks.push(
          (async () => {
            const body = await response.json();
            if (
              ["show_captcha", "need_login", "need_verify", "login_required"].includes(body.status)
            )
              accessLimited = true;
            if (!response.ok() || body.status !== "ok")
              throw Error("Unsuccessful collection response");
            records.push({ path: url.pathname, body });
          })().catch((error) => responseErrors.push(error.message)),
        );
      });
      const getArticles = () => [
        ...new Map(
          records
            .filter((r) => r.path.endsWith("get_link_list"))
            .flatMap((r) => r.body.result.articles || [])
            .map((a) => [new URL(a.share_url).searchParams.get("link_id"), a]),
        ).values(),
      ];
      try {
        await visit(page, source.source);
        for (let turn = 0; turn < 35; turn++) {
          await page.waitForTimeout(1000);
          if (accessLimited || responseErrors.length)
            throw Error("Collection access limited or response failed");
          if (records.some((r) => r.path.endsWith("get_collection_detail")) && getArticles().length)
            break;
        }
        await Promise.all(tasks);
        const detail = records.find((r) => r.path.endsWith("get_collection_detail"))?.body.result;
        if (
          !detail ||
          detail.heybox_info?.username !== source.author ||
          String(detail.heybox_info.userid) !== source.authorId
        )
          throw Error("Collection author not verified");
        if (!Number.isSafeInteger(detail.count) || detail.count < 1 || detail.count > 200)
          throw Error("Unexpected collection size");
        for (let turn = 0; turn < 8 && getArticles().length < detail.count; turn++) {
          const before = getArticles().length;
          await page.waitForTimeout(delay);
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            for (const el of document.querySelectorAll("*")) {
              if (
                el.scrollHeight > el.clientHeight + 100 &&
                /auto|scroll/.test(getComputedStyle(el).overflowY)
              )
                el.scrollTop = el.scrollHeight;
            }
          });
          for (let wait = 0; wait < 18 && getArticles().length <= before; wait++) {
            await page.waitForTimeout(1000);
            if (accessLimited || responseErrors.length)
              throw Error("Pagination access limited or failed");
          }
          await Promise.all(tasks);
          console.log(`Collection pagination: ${getArticles().length}/${detail.count}`);
          if (getArticles().length === before)
            throw Error("Pagination stopped; previous snapshot retained");
        }
        if (getArticles().length !== detail.count)
          throw Error("Incomplete collection; previous snapshot retained");
        await writeFile(resolve(artifacts, "collection.html"), await page.content());
        await writeFile(resolve(artifacts, "responses.json"), JSON.stringify(records, null, 2));
        const entries = getArticles().map((a) => {
          const id = new URL(a.share_url).searchParams.get("link_id");
          if (!/^[A-Za-z0-9]+$/.test(id)) throw Error("Invalid article identity");
          const category =
            settings.categoryRules.find((rule) => rule.terms.some((term) => a.title.includes(term)))
              ?.category || "other";
          return {
            id,
            title: a.title,
            source: `https://www.xiaoheihe.cn/app/bbs/link/${id}`,
            publishedAt: new Date(Number(a.create_at) * 1000).toISOString(),
            updatedAt: new Date(Number(a.modify_at) * 1000).toISOString(),
            category,
            relatedGuideIds: atlas.guides.filter((g) => a.title.includes(g.name)).map((g) => g.id),
          };
        });
        const articleChecks = { ...old?.articleChecks },
          articleCheckErrors = [];
        const articlePaused =
          old?.articleRetryAfter && Date.now() < Date.parse(old.articleRetryAfter);
        const checks = articlePaused
          ? []
          : entries
              .filter(
                (e) =>
                  e.category === "routes" &&
                  (!articleChecks[e.id] || articleChecks[e.id].updatedAt !== e.updatedAt),
              )
              .slice(0, checkLimit);
        for (const entry of checks) {
          try {
            const responsePromise = page.waitForResponse(
              (r) => new URL(r.url()).pathname === "/bbs/app/link/tree",
              { timeout: 45000 },
            );
            responsePromise.catch(() => {});
            await visit(page, entry.source);
            const response = await responsePromise;
            if (!response.ok() || accessLimited) throw Error("Article access limited or failed");
            const body = await response.json(),
              link = body.result?.link;
            if (
              ["show_captcha", "need_login", "need_verify", "login_required"].includes(body.status)
            ) {
              accessLimited = true;
              throw Error(`Article verification required: ${body.status}; no retry`);
            }
            if (
              body.status !== "ok" ||
              link?.title !== entry.title ||
              String(link.user?.userid) !== source.authorId ||
              typeof link.text !== "string"
            )
              throw Error("Article identity or content not verified");
            const text = articleText(link.text);
            if (text.length < 40) throw Error("Incomplete article");
            await writeFile(resolve(artifacts, `article-${entry.id}.txt`), text);
            articleChecks[entry.id] = {
              articleId: String(link.linkid),
              source: entry.source,
              checkedAt: new Date().toISOString(),
              updatedAt: entry.updatedAt,
              bodySha256: hash(text),
              characters: text.length,
              bodyFormat: 1,
            };
            console.log("Archive article verified", entry.title);
          } catch (error) {
            articleCheckErrors.push({ id: entry.id, source: entry.source, error: error.message });
            if (accessLimited) break;
          }
        }
        const oldEntries = new Map((old?.entries || []).map((e) => [e.id, e]));
        const ids = new Set(entries.map((e) => e.id));
        const collection = {
          ...source,
          title: detail.title,
          count: detail.count,
          complete: true,
          checkedAt: new Date().toISOString(),
          collectionUpdatedAt: new Date(Number(detail.modified_time) * 1000).toISOString(),
          entries,
          articleChecks,
          articleCheckErrors,
          articleChecksStoppedReason:
            accessLimited || articlePaused ? "verification_required" : null,
          articleRetryAfter: accessLimited
            ? new Date(Date.now() + 24 * 3600_000).toISOString()
            : old?.articleRetryAfter || null,
          sha256: hash(JSON.stringify(entries)),
          changes: {
            initial: !old,
            added: old ? entries.filter((e) => !oldEntries.has(e.id)).map((e) => e.id) : [],
            edited: entries
              .filter((e) => oldEntries.has(e.id) && oldEntries.get(e.id).updatedAt !== e.updatedAt)
              .map((e) => e.id),
            removed: [...oldEntries.keys()].filter((id) => !ids.has(id)),
          },
        };
        data.collections = [...data.collections.filter((c) => c.id !== source.id), collection];
        data.categoryLabels = settings.categoryLabels;
        await writeFile(path, JSON.stringify(data, null, 2) + "\n");
        console.log(
          JSON.stringify({
            collection: collection.title,
            entries: entries.length,
            categories: Object.fromEntries(
              Object.keys(settings.categoryLabels).map((category) => [
                category,
                entries.filter((e) => e.category === category).length,
              ]),
            ),
            articleChecks: checks.length,
            errors: articleCheckErrors.length,
          }),
        );
      } catch (error) {
        failures.push({ id: source.id, error: error.message });
        console.error("Collection unchanged:", source.id, error.message);
      } finally {
        await page.close();
      }
      if (accessLimited) break;
    }
  } finally {
    await browser.close();
  }
  if (failures.length)
    throw Error("Collection refresh failed; previous verified snapshots retained");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split(/=(.*)/s)));
  await refreshMapCollections(args);
}
