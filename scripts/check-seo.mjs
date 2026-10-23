import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { parseHTML, DOMParser } from "linkedom";
const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("data/site-seo.json", root), "utf8"));
const base = new URL(process.env.WT_SITE_URL || config.siteUrl);
if (!base.pathname.endsWith("/")) base.pathname += "/";
const url = (path = "") => new URL(path, base).href;
const languages = Object.entries(config.locales);
const preview = process.env.WT_DEPLOY_TARGET === "preview";
const analytics = process.env.WT_DEPLOY_TARGET === "cf";
const files = new Set(await readdir(new URL("dist/", root), { recursive: true }));
const expected = new Map();
const appGroup = languages
  .map(([code, other]) => [code, url(`${other.path}/`)])
  .concat([["x-default", url()]]);
expected.set(base.href, {
  lang: "zh-CN",
  locale: config.locales["zh-CN"],
  group: appGroup,
  app: true,
});
for (const [lang, locale] of languages) {
  expected.set(url(`${locale.path}/`), { lang, locale, group: appGroup, app: true });
  assert(
    !/primarily|主要使用简体中文|Основной язык/.test(locale.languageNote),
    "Stale language support notice",
  );
  for (const feature of [null, ...locale.features]) {
    const suffix = feature ? `${feature.slug}/` : "";
    expected.set(url(`about/${locale.path}/${suffix}`), {
      lang,
      locale,
      feature,
      group: languages
        .map(([code, other]) => [code, url(`about/${other.path}/${suffix}`)])
        .concat([["x-default", url(`about/zh/${suffix}`)]]),
    });
  }
}
function checkAnalytics(document) {
  const loaders = document.querySelectorAll("script[data-wt-cf-analytics]");
  assert.equal(loaders.length, analytics ? 1 : 0, "Deployment-scoped analytics");
  if (analytics) {
    assert(loaders[0].textContent.includes('location.origin!=="https://wt.mrtreasure.cc"'));
    assert(loaders[0].textContent.includes("script[data-cf-beacon]"));
  }
}
function checkTarget(href, canonical) {
  const target = new URL(href, canonical);
  if (target.origin !== base.origin) return;
  assert(target.pathname.startsWith(base.pathname), `Link escapes application: ${href}`);
  const relative = decodeURIComponent(target.pathname.slice(base.pathname.length));
  const file = !relative || relative.endsWith("/") ? `${relative}index.html` : relative;
  assert(files.has(file), `Missing local target ${file} from ${canonical}`);
}
const titles = new Set();
for (const [canonical, page] of expected) {
  const path = new URL(canonical).pathname.slice(base.pathname.length);
  const html = await readFile(new URL(`dist/${path}index.html`, root), "utf8");
  const { document } = parseHTML(html);
  assert.equal(document.documentElement.lang, page.lang);
  for (const selector of [
    "title",
    'meta[name="description"]',
    'meta[name="robots"]',
    'link[rel="canonical"]',
    "h1",
  ])
    assert.equal(document.querySelectorAll(selector).length, 1, `${canonical}: ${selector}`);
  assert.equal(document.querySelector('link[rel="canonical"]').href, canonical);
  assert.equal(document.querySelector('meta[property="og:url"]').content, canonical);
  assert.equal(document.querySelector('meta[name="robots"]').content.includes("noindex"), preview);
  assert(document.querySelector('meta[name="description"]').content.length > 20);
  checkAnalytics(document);
  const group = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((e) => [
    e.hreflang,
    e.href,
  ]);
  assert.deepEqual(group, page.group, `Wrong language graph: ${canonical}`);
  for (const [, href] of group)
    assert(expected.has(href), `Non-indexable language alternate ${href}`);
  const structured = [...document.querySelectorAll('script[type="application/ld+json"]')].map((e) =>
    JSON.parse(e.textContent),
  );
  assert.equal(structured[0].inLanguage, page.lang);
  assert.equal(structured[0].url, canonical);
  if (page.app) {
    assert(document.querySelector('meta[name="wt-localized-entries"]'));
    assert.equal(document.querySelectorAll('script[type="module"][src]').length, 1);
    assert(document.querySelector("#root").textContent.includes(page.locale.intro));
    if (page.lang !== "zh-CN") {
      const startup = document.querySelector("#root").cloneNode(true);
      startup.querySelector(".wt-seo-help")?.remove();
      assert(
        !/\p{Script=Han}/u.test(startup.textContent),
        `Untranslated startup screen: ${canonical}`,
      );
    }
    assert(!/country-[^"<>]*\.js/.test(html), "Country payload must stay lazy");
  } else {
    const title = document.querySelector("title").textContent;
    assert(!titles.has(title), `Duplicate guide title: ${canonical}`);
    titles.add(title);
    const schema = structured.find((s) => s["@type"] === "BreadcrumbList");
    assert(schema && schema.itemListElement.at(-1).item === canonical);
    assert.equal(document.querySelector("time").getAttribute("datetime"), config.contentReviewedAt);
    assert.equal(
      document.querySelectorAll(
        'script:not([type="application/ld+json"]):not([data-wt-cf-analytics])',
      ).length,
      0,
    );
    const markdown = await readFile(new URL(`dist/${path}index.md`, root), "utf8");
    assert(markdown.includes(page.locale.languageNote));
    if (page.feature) {
      assert(document.body.textContent.includes(page.feature.text));
      const launch = new URL(document.querySelector(".launch").href, canonical);
      assert.equal(launch.href, url(`${page.locale.path}/#/${page.feature.route}`));
    } else {
      for (const feature of page.locale.features)
        assert(
          document.querySelector(`a[href="${feature.slug}/"]`),
          `Missing feature entry: ${feature.slug}`,
        );
      for (const faq of page.locale.faqs) assert(document.body.textContent.includes(faq.answer));
    }
  }
  for (const element of document.querySelectorAll(
    'a[href],script[src],link[rel="stylesheet"],link[rel="modulepreload"]',
  ))
    checkTarget(element.getAttribute(element.hasAttribute("src") ? "src" : "href"), canonical);
}
const sitemap = await readFile(new URL("dist/sitemap.xml", root), "utf8");
assert(!sitemap.includes("#"), "Fragments must not enter sitemap");
const xml = new DOMParser().parseFromString(sitemap, "text/xml");
const entries = [...xml.querySelectorAll("url")];
assert.equal(entries.length, expected.size);
const seen = new Set();
for (const entry of entries) {
  const loc = entry.querySelector("loc").textContent;
  assert(!seen.has(loc));
  seen.add(loc);
  const page = expected.get(loc);
  assert(page, `Unexpected sitemap URL: ${loc}`);
  assert.deepEqual(
    [...entry.querySelectorAll("[hreflang]")].map((e) => [
      e.getAttribute("hreflang"),
      e.getAttribute("href"),
    ]),
    page.group,
  );
  if (!page.app) assert.equal(entry.querySelector("lastmod").textContent, config.contentReviewedAt);
}
assert((await readFile(new URL("dist/robots.txt", root), "utf8")).includes(url("sitemap.xml")));
const llms = await readFile(new URL("dist/llms.txt", root), "utf8");
assert(llms.includes(config.qmuseUrl) && !llms.includes("primarily Simplified Chinese"));
for (const [canonical, page] of expected) if (page.app) assert(llms.includes(canonical));
const notFound = parseHTML(await readFile(new URL("dist/404.html", root), "utf8")).document;
checkAnalytics(notFound);
assert.equal(notFound.querySelector('meta[name="robots"]').content, "noindex");
console.log(
  `SEO verified: ${expected.size} real URLs; deterministic language entries, localized startup, reciprocal hreflang, static feature content, valid asset/link targets, canonical/JSON-LD, sitemap and scoped analytics`,
);
