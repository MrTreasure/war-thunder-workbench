import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("data/site-seo.json", root), "utf8"));
const base = new URL(process.env.WT_SITE_URL || config.siteUrl);
if (!base.pathname.endsWith("/")) base.pathname += "/";
const urls = [];
const expectsAnalytics = process.env.WT_DEPLOY_TARGET === "cf";
function checkAnalytics(document) {
  const loaders = document.querySelectorAll("script[data-wt-cf-analytics]");
  assert.equal(
    loaders.length,
    expectsAnalytics ? 1 : 0,
    "Analytics must match the deployment target",
  );
  if (expectsAnalytics) {
    assert(loaders[0].textContent.includes('location.origin!=="https://wt.mrtreasure.cc"'));
    assert(
      loaders[0].textContent.includes("script[data-cf-beacon]"),
      "Existing zone beacon must not be duplicated",
    );
  }
}
for (const [lang, locale] of Object.entries(config.locales)) {
  const canonical = new URL(`about/${locale.path}/`, base).href;
  const html = await readFile(new URL(`dist/about/${locale.path}/index.html`, root), "utf8");
  const { document } = parseHTML(html);
  assert.equal(document.documentElement.lang, lang);
  assert.equal(document.querySelector('link[rel="canonical"]').href, canonical);
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.equal(document.querySelectorAll("section:not(.guide-detail)").length, 5);
  assert.equal(document.querySelectorAll("details").length, locale.faqs.length);
  assert.equal(document.querySelectorAll("article ol").length, locale.howTo.length);
  assert.equal(document.querySelector("time").getAttribute("datetime"), config.contentReviewedAt);
  for (const faq of locale.faqs) assert(document.body.textContent.includes(faq.answer));
  for (const source of config.sources) assert(document.querySelector(`a[href="${source.url}"]`));
  const markdown = await readFile(new URL(`dist/about/${locale.path}/index.md`, root), "utf8");
  for (const faq of locale.faqs) assert(markdown.includes(faq.answer));
  checkAnalytics(document);
  assert.equal(document.querySelectorAll('link[hreflang]:not([hreflang="x-default"])').length, 3);
  assert.equal(
    document.querySelector('meta[name="robots"]').content.includes("noindex"),
    process.env.WT_DEPLOY_TARGET === "preview",
  );
  assert.equal(
    JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).inLanguage,
    lang,
  );
  assert.equal(
    document.querySelectorAll(
      'script:not([type="application/ld+json"]):not([data-wt-cf-analytics])',
    ).length,
    0,
    "Feature guides must work without JavaScript",
  );
  for (const feature of locale.features) assert(document.body.textContent.includes(feature.title));
  for (const anchor of document.querySelectorAll("a[href]")) {
    const target = new URL(anchor.getAttribute("href"), canonical);
    if (target.origin !== base.origin) continue;
    if (target.hash) continue;
    const relative = target.pathname.slice(base.pathname.length);
    const file = !relative || relative.endsWith("/") ? `${relative}index.html` : relative;
    await readFile(new URL(`dist/${file}`, root));
  }
  urls.push(canonical);
}
const index = parseHTML(await readFile(new URL("dist/index.html", root), "utf8")).document;
checkAnalytics(index);
checkAnalytics(parseHTML(await readFile(new URL("dist/404.html", root), "utf8")).document);
assert.equal(index.querySelectorAll('meta[name="description"]').length, 1);
assert.equal(index.querySelectorAll('link[rel="canonical"]').length, 1);
assert.equal(index.querySelector('link[rel="canonical"]').href, base.href);
const sitemap = await readFile(new URL("dist/sitemap.xml", root), "utf8");
assert(!sitemap.includes("#"), "Fragments must not appear in the sitemap");
for (const url of [base.href, ...urls]) assert(sitemap.includes(`<loc>${url}</loc>`));
assert(
  (await readFile(new URL("dist/robots.txt", root), "utf8")).includes(
    new URL("sitemap.xml", base).href,
  ),
);
assert((await readFile(new URL("dist/llms.txt", root), "utf8")).includes(config.qmuseUrl));
console.log(
  "SEO verified: 3 readable locales, workflows, FAQ, sources, metadata, sitemap and deployment-scoped analytics",
);
