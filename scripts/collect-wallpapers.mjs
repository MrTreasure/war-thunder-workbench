/** Manual, anonymous official wallpaper metadata collection. No image downloads or publication. */
import { readFile, writeFile, mkdir, stat, utimes } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseHTML } from "linkedom";
const root = resolve(import.meta.dirname, ".."),
  dir = resolve(root, "artifacts/wallpaper-catalog-20261025");
const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some((a) => a !== "--apply"))
  throw Error("Usage: node scripts/collect-wallpapers.mjs [--apply]");
await mkdir(dir + "/pages", { recursive: true });
const sha = (x) => createHash("sha256").update(x).digest("hex");
const clean = (x) => x.replace(/\s+/g, " ").trim();
let nextRequest = 0;
async function page(url, seed) {
  const target = dir + "/pages/" + sha(url) + ".html";
  try {
    if (Date.now() - (await stat(target)).mtimeMs < 6 * 3600000)
      return await readFile(target, "utf8");
  } catch {}
  if (seed) {
    try {
      const seeded = await stat(dir + "/" + seed);
      if (Date.now() - seeded.mtimeMs >= 6 * 3600000) throw Error("expired seed");
      const body = await readFile(dir + "/" + seed, "utf8");
      if (body.includes("<html") || body.includes("<urlset")) {
        await writeFile(target, body);
        await utimes(target, seeded.atime, seeded.mtime);
        return body;
      }
    } catch {}
  }
  if (Date.now() < nextRequest) await new Promise((r) => setTimeout(r, nextRequest - Date.now()));
  const r = spawnSync(
    "curl",
    [
      "--disable",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "30",
      "--max-filesize",
      "8000000",
      "--write-out",
      "\n__STATUS__%{http_code}",
      url,
    ],
    { encoding: "utf8", maxBuffer: 8500000 },
  );
  nextRequest = Date.now() + 6000 + Math.random() * 4000;
  const match = r.stdout?.match(/\n__STATUS__(\d+)$/),
    status = Number(match?.[1]);
  if (r.status !== 0) throw Error("Transport failure; collection stopped at " + url);
  const body = r.stdout.slice(0, match.index);
  if (
    [403, 429].includes(status) ||
    /cf-chl-|Just a moment\.\.\.|captcha-container|g-recaptcha/i.test(body)
  )
    throw Error("Rate limit or verification; collection stopped at " + url);
  if (status !== 200) throw Error("HTTP " + status + "; collection stopped at " + url);
  await writeFile(target, body);
  return body;
}
function image(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "staticfiles.warthunder.com" &&
      !u.search &&
      !u.hash &&
      u.pathname.startsWith("/upload/image/") &&
      /\.(?:jpg|jpeg|png|webp)$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
function variant(url, text = "") {
  if (!image(url) || url.includes("/_thumbs/")) return null;
  const m = (text + " " + new URL(url).pathname.split("/").pop()).match(
    /(\d{3,5})\s*[x×]\s*(\d{3,5})/i,
  );
  if (!m) return null;
  const width = Number(m[1]),
    height = Number(m[2]);
  return width >= 1280 && height >= 720 ? { url, width, height } : null;
}
function groupKey(url) {
  return new URL(url).pathname
    .replace(/\d{3,5}x\d{3,5}_?/gi, "")
    .replace(/_[a-f0-9]{32}(?=\.)/gi, "");
}
const xml = await page("https://warthunder.com/sitemap-news-en.xml", "sitemap-news-en.xml");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^http:/, "https:"));
const excluded =
  /(?:development-|roadmap-|teaser-|covert-|trophy-|pre-order|stream-|highlights-|survey-results|giveaway-)/;
const candidates = urls.filter(
  (u) =>
    !excluded.test(u) &&
    /(?:meet-(?:the-)?(?:major-)?update|meet-the-.+-major-update|major-update-1-79|welcome-to-update|update-1-\d+-.+(?:released|road-to-glory|locked-on))/.test(
      u,
    ),
);
const updates = [],
  assets = new Map();
for (const url of [...new Set(candidates)]) {
  const body = await page(url, url.includes("/10229-") ? "sky-odyssey.html" : undefined),
    { document } = parseHTML(body);
  const article = document.querySelector("section.article,.article"),
    title = clean(document.querySelector(".content__title,h1")?.textContent || "");
  if (!article || !title) throw Error("Official article schema changed: " + url);
  const titleName =
    title.match(/[“"«]([^”"»]+)[”"»]/)?.[1] ||
    title.match(/'([^']+)'/)?.[1] ||
    title
      .replace(/^Meet\s+(?:the\s+)?(?:Major\s+)?(?:Update\s+)?/i, "")
      .replace(/\s+Major Update!?$/i, "")
      .replace(/!$/, "");
  const date = clean(document.querySelector(".article-meta")?.textContent || "").match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/,
  );
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const update = {
    id: "update-" + url.match(/\/news\/(\d+)/)[1],
    title: titleName,
    version: title.match(/\b\d+\.\d+(?:\.\d+)?\b/)?.[0] || null,
    announcedAt: date
      ? `${date[3]}-${String(months.indexOf(date[2]) + 1).padStart(2, "0")}-${date[1].padStart(2, "0")}`
      : null,
    sourcePage: url,
    sourceTitle: title,
    checkedAt: new Date((await stat(dir + "/pages/" + sha(url) + ".html")).mtimeMs).toISOString(),
    pageSha256: sha(body),
  };
  const poster = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
  if (image(poster)) update.announcementImage = poster;
  const found = new Map();
  for (const a of article.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    let original;
    try {
      original = new URL(href, url).href;
    } catch {
      continue;
    }
    const v = variant(original, clean(a.textContent));
    if (!v) continue;
    let context = a;
    for (let i = 0; i < 3 && context.parentElement; i++) context = context.parentElement;
    if (
      !/wallpaper|обои|壁纸/i.test(context.textContent) &&
      !original.includes("/0_Wallpaper_Renders/")
    )
      continue;
    const key = groupKey(original);
    if (!found.has(key)) found.set(key, []);
    if (!found.get(key).some((x) => x.url === original)) found.get(key).push(v);
  }
  for (const variants of found.values()) {
    variants.sort((a, b) => a.width - b.width);
    const preferred = variants.find((x) => x.width === 1920 && x.height === 1080) || variants[0];
    assets.set(preferred.url, {
      id: "bg-" + sha(preferred.url).slice(0, 10),
      title: update.title + " · 官方壁纸",
      category: "mixed",
      era: "unknown",
      source: preferred.url,
      thumbnail: preferred.url,
      sourcePage: url,
      checkedAt: update.checkedAt,
      update,
      variants,
      width: preferred.width,
      height: preferred.height,
      sourceBasis: "Explicit wallpaper download links on the official update announcement",
    });
  }
  updates.push({ ...update, wallpaperCount: found.size });
  await writeFile(
    dir + "/progress.json",
    JSON.stringify(
      {
        discovered: candidates.length,
        completed: updates.length,
        wallpapers: assets.size,
        last: url,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      completed: updates.length,
      total: candidates.length,
      title: update.title,
      date: update.announcedAt,
      wallpapers: found.size,
    }),
  );
}
// The live official gallery is paginated; read its discovered pages without guessing URLs.
const first = await page("https://warthunder.com/en/media/wallpapers/", "gallery.html");
const galleryUrls = [
  ...new Set([
    "https://warthunder.com/en/media/wallpapers/",
    ...[...parseHTML(first).document.querySelectorAll(".pager a[href]")]
      .map((a) => new URL(a.getAttribute("href"), "https://warthunder.com").href)
      .filter((u) => /\/media\/wallpapers\/page\/\d+$/.test(u) && !u.endsWith("/1")),
  ]),
];
for (const url of galleryUrls) {
  const body = url.endsWith("/wallpapers/") ? first : await page(url),
    { document } = parseHTML(body);
  for (const item of document.querySelectorAll(".showcase__item.widget-image")) {
    const variants = [...item.querySelectorAll(".widget-image__download-link")]
      .map((a) => variant(a.getAttribute("href"), clean(a.textContent)))
      .filter(Boolean);
    if (!variants.length) continue;
    variants.sort((a, b) => a.width - b.width);
    const v = variants.find((x) => x.width === 1920 && x.height === 1080) || variants[0];
    if (assets.has(v.url)) {
      assets.get(v.url).galleryPage = url;
      continue;
    }
    const update =
      updates.find(
        (u) =>
          u.wallpaperCount &&
          u.title.length > 4 &&
          v.url.toLowerCase().includes(
            u.title
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[\u0300-\u036f’']/g, "")
              .replace(/[^a-z0-9]+/g, "_"),
          ),
      ) || null;
    assets.set(v.url, {
      id: "bg-" + sha(v.url).slice(0, 10),
      title: new URL(v.url).pathname
        .split("/")
        .pop()
        .replace(/^\d+x\d+_/, "")
        .replace(/_[a-f0-9]{32}\.\w+$/, "")
        .replace(/_/g, " "),
      category: "mixed",
      era: "unknown",
      source: v.url,
      thumbnail: item.querySelector("img")?.getAttribute("data-src") || v.url,
      sourcePage: url,
      checkedAt: new Date().toISOString(),
      update: update
        ? Object.fromEntries(Object.entries(update).filter(([k]) => k !== "wallpaperCount"))
        : null,
      variants,
      width: v.width,
      height: v.height,
      sourceBasis: update
        ? "Official announcement title matched to gallery asset filename"
        : "Official gallery; release association unconfirmed",
    });
  }
}
const previous = JSON.parse(
  await readFile(resolve(root, "data/player-report-assets.json"), "utf8"),
);
for (const old of previous.backgrounds) {
  const fresh = assets.get(old.source);
  if (fresh)
    assets.set(old.source, {
      ...fresh,
      ...old,
      sourcePage: fresh.sourcePage,
      checkedAt: fresh.checkedAt,
      update: fresh.update,
      variants: fresh.variants,
      width: fresh.width,
      height: fresh.height,
      sourceBasis: fresh.sourceBasis,
    });
  else assets.set(old.source, old);
}
const result = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  source:
    "Official update-announcement sitemap and public wallpaper gallery; no account credentials",
  policy: {
    manual: true,
    concurrency: 1,
    minDelaySeconds: 6,
    maxDelaySeconds: 10,
    imagesDownloaded: false,
  },
  coverage: {
    announcementCandidates: candidates.length,
    announcementsRead: updates.length,
    announcementsWithWallpapers: updates.filter((x) => x.wallpaperCount).length,
    galleryPages: galleryUrls.length,
    completeHistoricalArchive: false,
  },
  updates,
  backgrounds: [
    ...previous.backgrounds.map((old) => assets.get(old.source) || old),
    ...[...assets.values()].filter(
      (item) => !previous.backgrounds.some((old) => old.source === item.source),
    ),
  ],
};
await writeFile(dir + "/catalog-candidate.json", JSON.stringify(result, null, 2) + "\n");
if (apply) {
  await writeFile(
    resolve(root, "data/wallpaper-catalog.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeFile(
    resolve(root, "data/player-report-assets.json"),
    JSON.stringify(
      {
        ...previous,
        backgrounds: previous.backgrounds.map(
          (old) => result.backgrounds.find((item) => item.source === old.source) || old,
        ),
        wallpapers: result.backgrounds,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  JSON.stringify({
    done: true,
    apply,
    backgrounds: result.backgrounds.length,
    updates: updates.length,
    knownReleaseBackgrounds: result.backgrounds.filter((x) => x.update).length,
    coverage: result.coverage,
  }),
);
