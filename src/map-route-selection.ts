import type { GroundAtlas, GroundMap, MapRoute } from "./map-data-api";

export function availableRouteLayouts(
  atlas: GroundAtlas,
  map: GroundMap,
  routes: readonly MapRoute[],
  team: number,
) {
  const variant = atlas.seasonalVariants.find((item) => item.mapId === map.id);
  return map.layouts.filter((layout) =>
    routes.some(
      (route) =>
        route.mapId === (variant?.sourceMapId || map.id) &&
        route.layoutId ===
          ((variant?.layouts as Record<string, string> | undefined)?.[layout.id] || layout.id) &&
        route.team === team,
    ),
  );
}

export function routesForContext(
  routes: readonly MapRoute[],
  mapId: string,
  layoutId: string,
  team: number,
) {
  const seen = new Set<string>();
  return routes
    .filter((route) => {
      if (route.mapId !== mapId || route.layoutId !== layoutId || route.team !== team) return false;
      if (seen.has(route.id)) return false;
      seen.add(route.id);
      return true;
    })
    .sort((a, b) => (b.guideVersion || 0) - (a.guideVersion || 0));
}

export function selectedMapRoute(routes: readonly MapRoute[], routeId: string) {
  return routes.find((route) => route.id === routeId) || routes[0];
}
