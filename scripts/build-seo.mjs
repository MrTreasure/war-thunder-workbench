import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, posix } from "node:path";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { cloudflareAnalyticsSnippet } from "./site-analytics.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("data/site-seo.json", root), "utf8"));
const messages = JSON.parse(await readFile(new URL("data/i18n.json", root), "utf8"));
const dist = resolve(new URL("dist/", root).pathname);
const base = new URL(process.env.WT_SITE_URL || config.siteUrl);
if (base.protocol !== "https:" || base.search || base.hash || base.username || base.password)
  throw Error("WT_SITE_URL must be a public HTTPS base URL without query or fragment");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const url = (path = "") => new URL(path, base).href;
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const languages = Object.entries(config.locales);
const chinese = config.locales["zh-CN"];
const analytics = await cloudflareAnalyticsSnippet();
const preview = process.env.WT_DEPLOY_TARGET === "preview";
const appPath = (locale) => `${locale.path}/`;
const localHref = (from, to) => {
  const [path, hash] = to.split("#");
  return (
    (posix.relative(from || ".", path || ".") || ".") +
    (!path || path.endsWith("/") ? "/" : "") +
    (hash ? `#${hash}` : "")
  );
};
const guidePath = (locale, slug = "") => `about/${locale.path}/${slug ? `${slug}/` : ""}`;
const alternateGroup = (path, fallback) =>
  languages
    .map(([lang, locale]) => [lang, url(path(locale))])
    .concat([["x-default", url(fallback)]]);
const alternates = (group) =>
  group
    .map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${escape(href)}">`)
    .join("");
const appAlternates = alternateGroup(appPath, "");
const schema = (lang, locale, canonical) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: locale.homeLabel,
  url: canonical,
  description: locale.description,
  inLanguage: lang,
  applicationCategory: "GameApplication",
  operatingSystem: "Web browser",
  isAccessibleForFree: true,
  featureList: locale.features.map((feature) => feature.title),
});
const metadata = (locale, canonical, title = locale.title, description = locale.description) =>
  `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${preview ? "noindex,follow" : "index,follow,max-image-preview:large"}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(config.imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(config.imageUrl)}">`;
let verification = "";
for (const [name, value] of [
  ["google-site-verification", process.env.WT_GOOGLE_SITE_VERIFICATION],
  ["baidu-site-verification", process.env.WT_BAIDU_SITE_VERIFICATION],
]) {
  if (value) verification += `<meta name="${name}" content="${escape(value)}">`;
}
const rawIndex = await readFile(resolve(dist, "index.html"), "utf8");
const sitemap = [];
async function output(path, text) {
  const file = resolve(dist, path);
  await mkdir(resolve(file, ".."), { recursive: true });
  await writeFile(file, text);
}
function translated(source, lang) {
  const key = source.trim().replace(/\s+/g, " ");
  const value = lang === "zh-CN" ? undefined : messages[key]?.[lang === "en" ? 0 : 1];
  return value === undefined ? source : source.replace(source.trim(), value);
}
function localizeBoot(document, lang, locale, entryPath) {
  const walk = (node) => {
    if (node.nodeType === 3) node.textContent = translated(node.textContent, lang);
    else for (const child of [...node.childNodes]) walk(child);
    if (node.nodeType === 1)
      for (const attribute of ["aria-label", "title", "alt"]) {
        if (node.hasAttribute(attribute))
          node.setAttribute(attribute, translated(node.getAttribute(attribute), lang));
      }
  };
  walk(document.getElementById("root"));
  document.getElementById("boot-copy").textContent = locale.intro;
  const help = document.createElement("nav");
  help.className = "wt-seo-help";
  help.setAttribute("aria-label", locale.guideLabel);
  help.innerHTML = `<a href="${localHref(entryPath, guidePath(locale))}">${escape(locale.guideLabel)}</a> · ${languages.map(([code, other]) => `<a lang="${code}" hreflang="${code}" href="${localHref(entryPath, appPath(other))}">${escape(other.name)}</a>`).join(" · ")}`;
  document.querySelector(".wt-loading-content").append(help);
  // Localize the small inline error handler as well as the visible startup screen.
  for (const script of document.querySelectorAll("script:not([src])")) {
    if (!script.textContent.includes("boot-retry")) continue;
    script.textContent = script.textContent.replace(
      /'([^'\n]*[\p{Script=Han}][^'\n]*)'/gu,
      (_, text) => JSON.stringify(translated(text, lang)),
    );
  }
}
for (const [entryPath, lang, locale] of [
  ["", "zh-CN", chinese],
  ...languages.map(([lang, locale]) => [appPath(locale), lang, locale]),
]) {
  const { document } = parseHTML(rawIndex);
  for (const node of document.querySelectorAll(
    "script[data-wt-cf-analytics],.wt-seo-help,style[data-wt-seo-startup]",
  ))
    node.remove();
  document.documentElement.lang = lang;
  if (entryPath) document.documentElement.dataset.wtLocaleEntry = lang;
  document.querySelector("title")?.remove();
  for (const element of document.querySelectorAll(
    'meta[name="description"],meta[name="robots"],meta[name^="twitter:"],meta[property^="og:"],link[rel="canonical"],link[hreflang],script[data-wt-seo]',
  ))
    element.remove();
  document.head.insertAdjacentHTML(
    "beforeend",
    `${verification}${metadata(locale, url(entryPath))}${alternates(appAlternates)}<meta name="wt-localized-entries" content="true"><script data-wt-seo="true" type="application/ld+json">${json(schema(lang, locale, url(entryPath)))}</script>`,
  );
  if (entryPath)
    for (const element of document.querySelectorAll("script[src],link[href]")) {
      const attribute = element.hasAttribute("src") ? "src" : "href";
      const value = element.getAttribute(attribute);
      if (/^(?:\.\/)?assets\//.test(value))
        element.setAttribute(attribute, `../${value.replace(/^\.\//, "")}`);
    }
  document.head.insertAdjacentHTML(
    "beforeend",
    "<style data-wt-seo-startup>.wt-seo-help{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 14px;margin-top:18px;font-size:12px}.wt-seo-help a{display:inline-flex;align-items:center;min-height:44px;color:#e1bc77;text-underline-offset:3px}.wt-seo-help a:focus-visible{outline:2px solid #e1bc77;outline-offset:3px}</style>",
  );
  localizeBoot(document, lang, locale, entryPath);
  document.body.insertAdjacentHTML("beforeend", analytics);
  await output(`${entryPath}index.html`, document.toString());
  sitemap.push({ href: url(entryPath), group: appAlternates });
}

const stylesheet = `section.guide-detail{display:block}.guide-detail article{margin:26px 0}.guide-detail h3{font-size:19px;margin-bottom:10px}.guide-detail li{padding:4px 0}.guide-detail summary{cursor:pointer;min-height:44px;padding:10px 0;color:var(--wt-gold)}.guide-detail details{border-top:1px solid var(--wt-line);padding:8px 0}.guide-detail details p{padding:8px 0}.guide-detail summary:focus-visible{outline:2px solid var(--wt-gold);outline-offset:4px}:root{color-scheme:dark;--wt-bg:#171c22;--wt-text:#ece9df;--wt-dim:#b5b8b8;--wt-line:#444a4c;--wt-gold:#e1bc77}*{box-sizing:border-box}body{margin:0;background:var(--wt-bg);color:var(--wt-text);font:17px/1.8 Georgia,"Microsoft YaHei",serif}a{color:var(--wt-gold);text-underline-offset:5px}a:focus-visible{outline:2px solid var(--wt-gold);outline-offset:6px}header,main,footer{max-width:1040px;margin:auto;padding:32px 28px}header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;border-bottom:1px solid var(--wt-line)}header img{width:135px;height:72px;object-fit:contain}nav{display:flex;gap:22px;flex-wrap:wrap}nav [aria-current]{color:var(--wt-text)}.eyebrow{color:var(--wt-gold);font:12px/1.6 monospace;letter-spacing:3px;margin-top:42px}h1{font-size:clamp(29px,4.5vw,48px);line-height:1.25;font-weight:600;max-width:900px;margin:22px 0}h2{font-size:25px;line-height:1.35;margin:0 0 16px}p{margin:0 0 20px}.intro{max-width:770px;font-size:20px}.note{color:var(--wt-dim);font-size:15px}.launch{display:inline-block;padding:12px 24px;background:#913b30;color:#fff;border:1px solid #c36348;text-decoration:none;margin:8px 0 38px}section{display:grid;grid-template-columns:54px 1fr;gap:20px;border-top:1px solid var(--wt-line);padding:34px 0;scroll-margin-top:25px}section p{max-width:760px}section .number{font:14px/2 monospace;color:var(--wt-gold)}footer{border-top:1px solid var(--wt-line);font-size:14px;color:var(--wt-dim)}@media(max-width:600px){header,main,footer{padding:22px}section{grid-template-columns:30px 1fr;gap:12px}nav{gap:16px}.intro{font-size:18px}}`;
const cssPath = `assets/site-guide.${createHash("sha256").update(stylesheet).digest("hex").slice(0, 16)}.css`;
await output(cssPath, stylesheet);
const faqIndices = [[0, 1, 2], [3], [], [4], [5], []];
for (const [lang, locale] of languages) {
  for (const feature of [null, ...locale.features]) {
    const slug = feature?.slug || "";
    const path = guidePath(locale, slug);
    const canonical = url(path);
    const index = feature ? locale.features.indexOf(feature) : -1;
    const title = feature ? feature.seoTitle : locale.title;
    const description = feature?.description || locale.description;
    const group = alternateGroup((other) => guidePath(other, slug), guidePath(chinese, slug));
    const nav = languages
      .map(
        ([code, other]) =>
          `<a lang="${code}" hreflang="${code}" href="${localHref(path, guidePath(other, slug))}"${code === lang ? ' aria-current="page"' : ""}>${escape(other.name)}</a>`,
      )
      .join("");
    const selected = feature ? [feature] : locale.features;
    const steps = feature ? [locale.howTo[index]] : locale.howTo;
    const faqs = feature ? faqIndices[index].map((i) => locale.faqs[i]) : locale.faqs;
    const sections = selected
      .map(
        (item, i) =>
          `<section id="${escape(item.slug)}"><span class="number">0${i + 1}</span><div><h2>${feature ? escape(item.title) : `<a href="${localHref(path, guidePath(locale, item.slug))}">${escape(item.title)}</a>`}</h2><p>${escape(item.text)}</p></div></section>`,
      )
      .join("");
    const howTo = `<section class="guide-detail"><h2>${escape(locale.howToTitle)}</h2>${steps.map((item) => `<article><h3>${escape(item.title)}</h3><ol>${item.steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol></article>`).join("")}</section>`;
    const faq = faqs.length
      ? `<section class="guide-detail"><h2>${escape(locale.faqTitle)}</h2>${faqs.map((item) => `<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`).join("")}</section>`
      : "";
    const sources = `<section class="guide-detail"><h2>${escape(locale.dataTitle)}</h2><p>${escape(locale.dataNotes)}</p><p>${escape(locale.sourcesLabel)}: ${config.sources.map((source) => `<a href="${escape(source.url)}">${escape(source.name)}</a>`).join(" · ")}</p><p class="note">${escape(locale.reviewedLabel)}: <time datetime="${config.contentReviewedAt}">${config.contentReviewedAt}</time></p></section>`;
    const links = locale.features
      .filter((item) => item !== feature)
      .map(
        (item) =>
          `<a href="${localHref(path, guidePath(locale, item.slug))}">${escape(item.title)}</a>`,
      )
      .join(" · ");
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: locale.homeLabel, item: url(appPath(locale)) },
        { "@type": "ListItem", position: 2, name: locale.guideLabel, item: url(guidePath(locale)) },
        ...(feature
          ? [{ "@type": "ListItem", position: 3, name: feature.title, item: canonical }]
          : []),
      ],
    };
    const launchPath = `${appPath(locale)}${feature ? `#/${feature.route}` : ""}`;
    const launch = url(launchPath);
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata(locale, canonical, title, description)}${alternates(group)}${verification}<link rel="icon" href="https://warthunder.com/i/favicons/favicon.ico"><link rel="stylesheet" href="${localHref(path, cssPath)}"><script type="application/ld+json">${json({ "@context": "https://schema.org", "@type": "WebPage", inLanguage: lang, name: title, description, url: canonical, dateModified: config.contentReviewedAt, about: schema(lang, locale, url(appPath(locale))) })}</script><script type="application/ld+json">${json(breadcrumb)}</script><link rel="alternate" type="text/markdown" href="index.md"></head><body><header><a href="${localHref(path, appPath(locale))}"><img src="https://warthunder.com/assets/img/svg/logo-wt.svg" alt="War Thunder" width="135" height="72"></a><nav aria-label="Language">${nav}</nav></header><main><p class="eyebrow">WAR THUNDER / WORKBENCH</p><h1>${escape(title)}</h1><p class="intro">${escape(feature ? feature.text : locale.intro)}</p><p class="note">${escape(locale.languageNote)}</p><a class="launch" href="${localHref(path, launchPath)}">${escape(locale.open)} ↗</a>${feature ? "" : sections}${howTo}${faq}${sources}<nav aria-label="${escape(locale.guideLabel)}">${links}</nav></main><footer><p>${escape(locale.notes)}</p>${analytics ? `<p>${escape(locale.analyticsNote)}</p>` : ""}<a href="${localHref(path, guidePath(locale))}">${escape(locale.guideLabel)}</a> · <a href="${config.qmuseUrl}">${escape(locale.qmuseLabel)}</a> · <a href="${localHref(path, "llms.txt")}">llms.txt</a></footer>${analytics}</body></html>`;
    await output(`${path}index.html`, html);
    await output(
      `${path}index.md`,
      `# ${title}\n\n${feature ? feature.text : locale.intro}\n\n${locale.languageNote}\n\n[${locale.open}](${launch})\n\n${selected.map((item) => `## ${item.title}\n\n${item.text}\n\n[${locale.guideLabel}](${url(guidePath(locale, item.slug))})`).join("\n\n")}\n\n## ${locale.howToTitle}\n\n${steps.map((item) => `### ${item.title}\n\n${item.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`).join("\n\n")}\n\n## ${locale.faqTitle}\n\n${faqs.map((item) => `### ${item.question}\n\n${item.answer}`).join("\n\n")}\n\n${locale.notes}\n\n${locale.dataNotes}\n\n${config.sources.map((source) => `- [${source.name}](${source.url})`).join("\n")}\n\n${locale.reviewedLabel}: ${config.contentReviewedAt}\n\nSource: ${canonical}\n`,
    );
    sitemap.push({ href: canonical, group, modified: config.contentReviewedAt });
  }
}
await output(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${sitemap.map(({ href, group, modified }) => `<url><loc>${escape(href)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}${group.map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(href)}"/>`).join("")}</url>`).join("")}</urlset>\n`,
);
await output("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${url("sitemap.xml")}\n`);
await output(
  "llms.txt",
  `# War Thunder Workbench · 战雷工作台\n\n> Independent fan-made tools for War Thunder PC international players. The interactive app supports Simplified Chinese, English and Russian. The neutral entry follows browser language until a manual preference is saved; fixed language URLs remain deterministic. Public features allow guest use; some operations require an account and quota.\n\n## Applications\n${languages.map(([, locale]) => `- [${locale.name}](${url(appPath(locale))}): ${locale.description}`).join("\n")}\n- [Default entry](${url()})\n- [QMuse entry](${config.qmuseUrl}): alternative distribution; local data is not shared across domains.\n\n## Feature guides\n${languages.map(([, locale]) => `- [${locale.name}](${url(guidePath(locale))})\n- [${locale.name} Markdown](${url(guidePath(locale))}index.md)\n${locale.features.map((feature) => `  - [${feature.title}](${url(guidePath(locale, feature.slug))})`).join("\n")}`).join("\n")}\n\n## Data boundaries\nPlayer query results may be cached; use their fetch times. Battle records are not complete ownership evidence. Account estimates are for reference, not guaranteed sale prices. Unknown prices and research costs remain unknown. Local research plans, lineups and map plans stay in the browser. No public write API or agent authentication integration is provided. Do not ask users for War Thunder passwords. Not affiliated with Gaijin Entertainment.\n`,
);
await output(
  "404.html",
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>页面不存在 · 战雷工作台</title><h1>404</h1><p><a href="${url()}">返回战雷工作台 / Open workbench</a></p>${analytics}</html>`,
);
console.log(
  `SEO: ${sitemap.length} real URLs, three localized applications and guides, six feature guides per language; preview=${preview}, CF analytics=${!!analytics}`,
);
