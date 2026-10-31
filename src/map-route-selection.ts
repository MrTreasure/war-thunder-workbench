import type { MapRoute } from "./map-data-api";

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
