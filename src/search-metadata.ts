import { pathLocale, localeAppPath } from "./i18n/urls";
import { getLocale, t } from "./i18n/core";
import seo from "../data/site-seo.json";

/** QMuse replaces source head tags; restore public metadata after app startup too. */
export function updateSearchMetadata(page: string) {
  const locale = getLocale();
  const zh = seo.locales[locale];
  const titles: Record<string, string> = {
    tree: "战雷科技树与研发规划",
    stats: "战雷战绩查询与战雷账号价值",
    maps: "战雷走线与陆战地图编辑",
    lineups: "战雷出击队列",
    sales: "战雷折扣日历",
  };
  document.title = `${t(titles[page] || "战争雷霆玩家工具")} · ${t("战雷工作台")} | War Thunder Workbench`;
  const qmuse = location.origin === new URL(seo.qmuseUrl).origin;
  const entryLocale = pathLocale(location.pathname);
  const canonical = qmuse
    ? seo.qmuseUrl
    : new URL(entryLocale ? localeAppPath("/", entryLocale).slice(1) : "", seo.siteUrl).href;
  const setMeta = (attribute: "name" | "property", name: string, content: string) => {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, name);
      document.head.append(tag);
    }
    tag.content = content;
  };
  setMeta("name", "description", zh.description);
  setMeta("property", "og:title", document.title);
  setMeta("property", "og:description", zh.description);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", seo.imageUrl);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", document.title);
  setMeta("name", "twitter:description", zh.description);
  setMeta("name", "twitter:image", seo.imageUrl);
  if (!qmuse) {
    for (const lang of ["zh-CN", "en", "ru", "x-default"] as const) {
      let alternate = document.head.querySelector<HTMLLinkElement>(
        `link[rel="alternate"][hreflang="${lang}"]`,
      );
      if (!alternate) {
        alternate = document.createElement("link");
        alternate.rel = "alternate";
        alternate.hreflang = lang;
        document.head.append(alternate);
      }
      alternate.href =
        lang === "x-default"
          ? seo.siteUrl
          : new URL(localeAppPath("/", lang).slice(1), seo.siteUrl).href;
    }
  }
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = canonical; // Fragment routes are app state, not separate indexed pages.
  let structured = document.head.querySelector<HTMLScriptElement>("script[data-wt-seo]");
  if (!structured) {
    structured = document.createElement("script");
    structured.type = "application/ld+json";
    structured.dataset.wtSeo = "true";
    document.head.append(structured);
  }
  structured.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t("战雷工作台"),
    url: canonical,
    description: zh.description,
    inLanguage: locale,
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    featureList: zh.features.map((feature) => feature.title),
  });
}
