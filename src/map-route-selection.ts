import type { GroundAtlas, GroundMap, MapRoute } from "./map-data-api";

export function availableRouteLayouts(
  atlas: GroundAtlas,
  map: GroundMap,
  routes: readonly MapRoute[],
  team: number,
) {
  const variant = atlas.seasonalVariants.find((item) => item.mapId === map.id);
  return map.layouts.filter((layout) => {
    const sharedLayout = (variant?.layouts as Record<string, string> | undefined)?.[layout.id];
    return routesForContext(routes, map.id, layout.id, team,
      variant && sharedLayout ? { mapId: variant.sourceMapId, layoutId: sharedLayout } : undefined,
    ).length > 0;
  });
}

export function routesForContext(
  routes: readonly MapRoute[],
  mapId: string,
  layoutId: string,
  team: number,
  shared?: { mapId: string; layoutId: string },
) {
  const seen = new Set<string>();
  return routes
    .filter((route) => {
      const direct = route.mapId === mapId && route.layoutId === layoutId;
      const inherited = shared && route.mapId === shared.mapId && route.layoutId === shared.layoutId;
      if ((!direct && !inherited) || route.team !== team) return false;
      if (seen.has(route.id)) return false;
      seen.add(route.id);
      return true;
    })
    .sort((a, b) => (b.guideVersion || 0) - (a.guideVersion || 0));
}

export function selectedMapRoute(routes: readonly MapRoute[], routeId: string) {
  return routes.find((route) => route.id === routeId) || routes[0];
}
