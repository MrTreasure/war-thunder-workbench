import seo from "../data/site-seo.json";

/** QMuse replaces source head tags; restore public metadata after app startup too. */
export function updateSearchMetadata(page: string) {
  const zh = seo.locales["zh-CN"];
  const description =
    zh.features.find((feature) => feature.route === page)?.description || zh.description;
  const titles: Record<string, string> = {
    tree: "战雷科技树与研发规划",
    stats: "战雷战绩查询与战雷账号价值",
    maps: "战雷走线与陆战地图编辑",
    lineups: "战雷出击队列",
    loadouts: "战雷模拟挂载与导弹对比",
    sales: "战雷折扣日历",
    decals: "战雷贴花查询与解锁条件",
  };
  document.title = `${titles[page] || "战争雷霆玩家工具"} · 战雷工作台 | War Thunder Workbench`;
  const qmuse =
    location.origin === new URL(seo.qmuseUrl).origin ||
    location.origin === "https://render.qmuse.pub";
  const canonical = qmuse ? seo.qmuseUrl : seo.siteUrl;
  const setMeta = (attribute: "name" | "property", name: string, content: string) => {
    const [existing, ...duplicates] = document.head.querySelectorAll<HTMLMetaElement>(
      `meta[${attribute}="${name}"]`,
    );
    for (const duplicate of duplicates) duplicate.remove();
    let tag = existing;
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, name);
      document.head.append(tag);
    }
    tag.content = content;
  };
  setMeta("name", "description", description);
  setMeta("property", "og:title", document.title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", seo.imageUrl);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", document.title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", seo.imageUrl);
  const [existingLink, ...duplicateLinks] =
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]');
  for (const duplicate of duplicateLinks) duplicate.remove();
  let link = existingLink;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = canonical; // Fragment routes are app state, not separate indexed pages.
  const [existingStructured, ...duplicateStructured] =
    document.head.querySelectorAll<HTMLScriptElement>("script[data-wt-seo]");
  for (const duplicate of duplicateStructured) duplicate.remove();
  let structured = existingStructured;
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
    description,
    inLanguage: "zh-CN",
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    featureList: zh.features.map((feature) => feature.title),
  });
}
