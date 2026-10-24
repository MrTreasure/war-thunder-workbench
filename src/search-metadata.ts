import seo from "../data/site-seo.json";

/** QMuse replaces source head tags; restore public metadata after app startup too. */
export function updateSearchMetadata(page: string) {
  const zh = seo.locales["zh-CN"];
  const titles: Record<string, string> = {
    tree: "战雷科技树与研发规划",
    stats: "战雷战绩查询与战雷账号价值",
    maps: "战雷走线与陆战地图编辑",
    lineups: "战雷出击队列",
    sales: "战雷折扣日历",
    decals: "战雷贴花查询与解锁条件",
  };
  document.title = `${titles[page] || "战争雷霆玩家工具"} · 战雷工作台 | War Thunder Workbench`;
  const qmuse = location.origin === new URL(seo.qmuseUrl).origin;
  const canonical = qmuse ? seo.qmuseUrl : seo.siteUrl;
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
    name: "War Thunder Workbench · 战雷工作台",
    url: canonical,
    description: zh.description,
    inLanguage: "zh-CN",
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    featureList: zh.features.map((feature) => feature.title),
  });
}
