import type { GroundAtlas, MapGuideSource, MapRoute } from "./map-data-api";
import { isMapGuideSourceURL } from "./map-route-sources.ts";

// Source links are map metadata, independent of SVG visibility, layout and side.
export function relatedMapGuides(
  atlas: GroundAtlas,
  mapId: string,
  routes: readonly MapRoute[] = [],
): MapGuideSource[] {
  const family = (id: string) =>
    atlas.seasonalVariants.find((variant) => variant.mapId === id)?.sourceMapId || id;
  const identity = family(mapId);
  const guides: MapGuideSource[] = atlas.maps
    .filter((map) => family(map.id) === identity)
    .flatMap((map) => [...map.guides, ...(map.guideSources || [])]);
  for (const route of routes) {
    if (family(route.mapId) === identity)
      guides.push({ title: route.title, source: route.sourceUrl, edition: route.sourceDate });
  }
  const unique = new Map<string, MapGuideSource>();
  for (const guide of guides) {
    if (!isMapGuideSourceURL(guide.source)) continue;
    const url = new URL(guide.source);
    const key = url.origin + url.pathname.replace(/\/$/, "") + url.search;
    if (!unique.has(key)) unique.set(key, guide);
  }
  return [...unique.values()];
}

export function mapGuideSourceLabel(source: string) {
  const host = new URL(source).hostname;
  if (host === "www.bilibili.com") return "B站";
  if (host === "forum.warthunder.com") return "官方论坛";
  if (host === "www.xiaoheihe.cn") return "小黑盒";
  if (host === "tieba.baidu.com") return "百度贴吧";
  return "YouTube";
}
