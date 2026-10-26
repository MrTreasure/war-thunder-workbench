import catalog from "../data/map-recommendations.json";

const files = import.meta.glob<string>("../data/map-recommendations/*.svg", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
export type RecommendedRoute = (typeof catalog.routes)[number] & { url: string };
export function recommendedRoute(
  mapId: string,
  layoutId: string,
  team: number,
): RecommendedRoute | undefined {
  const route = catalog.routes.find(
    (r) => r.mapId === mapId && r.layoutId === layoutId && r.team === team,
  );
  if (!route) return undefined;
  const url = files[`../data/map-recommendations/${route.svg}`];
  return url ? { ...route, url } : undefined;
}
export function hasRecommendedRoutes(mapId: string) {
  return catalog.routes.some((r) => r.mapId === mapId);
}
