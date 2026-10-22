import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { cloudflareAnalyticsSnippet } from "./site-analytics.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("data/site-seo.json", root), "utf8"));
const dist = resolve(new URL("dist/", root).pathname);
const base = new URL(process.env.WT_SITE_URL || config.siteUrl);
if (base.protocol !== "https:" || base.search || base.hash || base.username || base.password)
  throw Error("WT_SITE_URL must be a public HTTPS base URL without query or fragment");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const url = (path = "") => new URL(path, base).href;
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const languages = Object.entries(config.locales);
const chinese = config.locales["zh-CN"];
const analytics = await cloudflareAnalyticsSnippet();
const schema = (locale, canonical) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "War Thunder Workbench · 战雷工作台",
  url: canonical,
  description: locale.description,
  inLanguage: "zh-CN",
  applicationCategory: "GameApplication",
  operatingSystem: "Web browser",
  isAccessibleForFree: true,
  featureList: locale.features.map((feature) => feature.title),
});
const metadata = (locale, canonical) =>
  `<meta name="description" content="${escape(locale.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(locale.title)}"><meta property="og:description" content="${escape(locale.description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(config.imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(locale.title)}"><meta name="twitter:description" content="${escape(locale.description)}"><meta name="twitter:image" content="${escape(config.imageUrl)}">`;
let verification = "";
for (const [name, value] of [
  ["google-site-verification", process.env.WT_GOOGLE_SITE_VERIFICATION],
  ["baidu-site-verification", process.env.WT_BAIDU_SITE_VERIFICATION],
]) {
  if (value) verification += `<meta name="${name}" content="${escape(value)}">`;
}
let index = await readFile(resolve(dist, "index.html"), "utf8");
index = index
  .replace(/<title>[^<]*<\/title>/, `<title>${escape(chinese.title)}</title>`)
  .replace(/<meta (?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, "")
  .replace(/<link rel="canonical"[^>]*>/g, "")
  .replace(
    "</head>",
    `${verification}${metadata(chinese, url())}<script data-wt-seo="true" type="application/ld+json">${json(schema(chinese, url()))}</script></head>`,
  );
index = index.replace(
  "</noscript>",
  ` <a href="./about/zh/">战雷工作台功能介绍 · English · Русский</a></noscript>`,
);
index = index.replace("</body>", `${analytics}</body>`);
await writeFile(resolve(dist, "index.html"), index);

const stylesheet = `section.guide-detail{display:block}.guide-detail article{margin:26px 0}.guide-detail h3{font-size:19px;margin-bottom:10px}.guide-detail li{padding:4px 0}.guide-detail summary{cursor:pointer;min-height:44px;padding:10px 0;color:var(--wt-gold)}.guide-detail details{border-top:1px solid var(--wt-line);padding:8px 0}.guide-detail details p{padding:8px 0}.guide-detail summary:focus-visible{outline:2px solid var(--wt-gold);outline-offset:4px}:root{color-scheme:dark;--wt-bg:#171c22;--wt-text:#ece9df;--wt-dim:#b5b8b8;--wt-line:#444a4c;--wt-gold:#e1bc77}*{box-sizing:border-box}body{margin:0;background:var(--wt-bg);color:var(--wt-text);font:17px/1.8 Georgia,"Microsoft YaHei",serif}a{color:var(--wt-gold);text-underline-offset:5px}a:focus-visible{outline:2px solid var(--wt-gold);outline-offset:6px}header,main,footer{max-width:1040px;margin:auto;padding:32px 28px}header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;border-bottom:1px solid var(--wt-line)}header img{width:135px;height:72px;object-fit:contain}nav{display:flex;gap:22px;flex-wrap:wrap}nav [aria-current]{color:var(--wt-text)}.eyebrow{color:var(--wt-gold);font:12px/1.6 monospace;letter-spacing:3px;margin-top:42px}h1{font-size:clamp(29px,4.5vw,48px);line-height:1.25;font-weight:600;max-width:900px;margin:22px 0}h2{font-size:25px;line-height:1.35;margin:0 0 16px}p{margin:0 0 20px}.intro{max-width:770px;font-size:20px}.note{color:var(--wt-dim);font-size:15px}.launch{display:inline-block;padding:12px 24px;background:#913b30;color:#fff;border:1px solid #c36348;text-decoration:none;margin:8px 0 38px}section{display:grid;grid-template-columns:54px 1fr;gap:20px;border-top:1px solid var(--wt-line);padding:34px 0;scroll-margin-top:25px}section p{max-width:760px}section .number{font:14px/2 monospace;color:var(--wt-gold)}footer{border-top:1px solid var(--wt-line);font-size:14px;color:var(--wt-dim)}@media(max-width:600px){header,main,footer{padding:22px}section{grid-template-columns:30px 1fr;gap:12px}nav{gap:16px}.intro{font-size:18px}}`;
await mkdir(resolve(dist, "about"), { recursive: true });
// Content-addressed CSS follows the same immutable cache rules as application assets.
const { createHash } = await import("node:crypto");
const cssPath = `assets/site-guide.${createHash("sha256").update(stylesheet).digest("hex").slice(0, 16)}.css`;
await writeFile(resolve(dist, cssPath), stylesheet);
for (const [lang, locale] of languages) {
  const canonical = url(`about/${locale.path}/`);
  const alternateLinks = languages
    .map(
      ([code, other]) =>
        `<link rel="alternate" hreflang="${code}" href="${url(`about/${other.path}/`)}">`,
    )
    .join("");
  const nav = languages
    .map(
      ([code, other]) =>
        `<a lang="${code}" hreflang="${code}" href="../${other.path}/"${code === lang ? ' aria-current="page"' : ""}>${escape(other.name)}</a>`,
    )
    .join("");
  const sections = locale.features
    .map(
      (feature, i) =>
        `<section id="feature-${i + 1}"><span class="number">0${i + 1}</span><div><h2><a href="../../#/${feature.route}">${escape(feature.title)}</a></h2><p>${escape(feature.text)}</p></div></section>`,
    )
    .join("");
  const howTo = `<section class="guide-detail"><h2>${escape(locale.howToTitle)}</h2>${locale.howTo.map((item) => `<article><h3>${escape(item.title)}</h3><ol>${item.steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol></article>`).join("")}</section>`;
  const faq = `<section class="guide-detail"><h2>${escape(locale.faqTitle)}</h2>${locale.faqs.map((item) => `<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`).join("")}</section>`;
  const sources = `<section class="guide-detail"><h2>${escape(locale.dataTitle)}</h2><p>${escape(locale.dataNotes)}</p><p>${escape(locale.sourcesLabel)}: ${config.sources.map((source) => `<a href="${escape(source.url)}">${escape(source.name)}</a>`).join(" · ")}</p><p class="note">${escape(locale.reviewedLabel)}: <time datetime="${config.contentReviewedAt}">${config.contentReviewedAt}</time></p></section>`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: locale.homeLabel, item: url() },
      { "@type": "ListItem", position: 2, name: locale.guideLabel, item: canonical },
    ],
  };
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(locale.title)}</title>${metadata(locale, canonical)}${alternateLinks}<link rel="alternate" hreflang="x-default" href="${url("about/zh/")}"><link rel="icon" href="https://warthunder.com/i/favicons/favicon.ico"><link rel="stylesheet" href="../../${cssPath}"><script type="application/ld+json">${json({ "@context": "https://schema.org", "@type": "WebPage", inLanguage: lang, name: locale.title, description: locale.description, url: canonical, dateModified: config.contentReviewedAt, about: schema(locale, url()) })}</script><script type="application/ld+json">${json(breadcrumb)}</script><link rel="alternate" type="text/markdown" href="index.md"></head><body><header><a href="../../"><img src="https://warthunder.com/assets/img/svg/logo-wt.svg" alt="War Thunder" width="135" height="72"></a><nav aria-label="Language">${nav}</nav></header><main><p class="eyebrow">WAR THUNDER / WORKBENCH</p><h1>${escape(locale.title)}</h1><p class="intro">${escape(locale.intro)}</p><p class="note">${escape(locale.languageNote)}</p><a class="launch" href="../../">${escape(locale.open)} ↗</a>${sections}${howTo}${faq}${sources}</main><footer><p>${escape(locale.notes)}</p>${analytics ? `<p>${escape(locale.analyticsNote)}</p>` : ""}<a href="${config.qmuseUrl}">${escape(locale.qmuseLabel)}</a> · <a href="${url("llms.txt")}">llms.txt</a></footer>${analytics}</body></html>`;
  await mkdir(resolve(dist, `about/${locale.path}`), { recursive: true });
  await writeFile(resolve(dist, `about/${locale.path}/index.html`), html);
  await writeFile(
    resolve(dist, `about/${locale.path}/index.md`),
    `# ${locale.title}\n\n${locale.intro}\n\n${locale.languageNote}\n\n${locale.features.map((f) => `## ${f.title}\n\n${f.text}\n\n[${locale.open}](${url(`#/${f.route}`)})`).join("\n\n")}\n\n${locale.notes}\n\n## ${locale.howToTitle}\n\n${locale.howTo.map((item) => `### ${item.title}\n\n${item.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`).join("\n\n")}\n\n## ${locale.faqTitle}\n\n${locale.faqs.map((item) => `### ${item.question}\n\n${item.answer}`).join("\n\n")}\n\n## ${locale.dataTitle}\n\n${locale.dataNotes}\n\n${config.sources.map((source) => `- [${source.name}](${source.url})`).join("\n")}\n\n${locale.reviewedLabel}: ${config.contentReviewedAt}\n\nSource: ${canonical}\n`,
  );
}
const urls = [url(), ...languages.map(([, locale]) => url(`about/${locale.path}/`))];
const alternates = languages
  .map(
    ([lang, locale]) =>
      `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(url(`about/${locale.path}/`))}"/>`,
  )
  .join("");
await writeFile(
  resolve(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.map((item, i) => `<url><loc>${escape(item)}</loc>${i ? alternates : ""}</url>`).join("")}</urlset>\n`,
);
await writeFile(
  resolve(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${url("sitemap.xml")}\n`,
);
await writeFile(
  resolve(dist, "llms.txt"),
  `# War Thunder Workbench · 战雷工作台\n\n> Independent fan-made tools for War Thunder PC international players. The interactive app is primarily Simplified Chinese. Public features allow guest use; some operations require an account and quota.\n\n## Feature guides\n${languages.map(([, locale]) => `- [${locale.name}](${url(`about/${locale.path}/`)}): ${locale.description}\n- [${locale.name} Markdown](${url(`about/${locale.path}/index.md`)})`).join("\n")}\n\n## Applications\n- [Primary workbench](${url()}): stats lookup, research trees, RP planning, ground map routes, account estimates, lineups.\n- [QMuse entry](${config.qmuseUrl}): alternative distribution of this workbench.\n\n## Data boundaries\nPlayer query results may be cached; use their fetch times. Battle records are not complete ownership evidence. Account estimates are for reference, not guaranteed sale prices. Unknown prices and research costs remain unknown. Local research plans, lineups and map plans stay in the browser. No public write API or agent authentication integration is provided. Do not ask users for War Thunder passwords. Not affiliated with Gaijin Entertainment.\n`,
);
await writeFile(
  resolve(dist, "404.html"),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>页面不存在 · 战雷工作台</title><h1>404</h1><p><a href="${url()}">返回战雷工作台 / Open workbench</a></p>${analytics}</html>`,
);
console.log(
  `SEO: canonical ${url()}, 3 localized HTML/Markdown guides with workflows/FAQ/sources, sitemap, robots and llms.txt; CF analytics ${analytics ? "enabled" : "excluded"}`,
);
