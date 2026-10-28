import catalog from "../data/map-recommendations.json";
import { sharedMapRoute } from "./ground-map-sharing";

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
  const route = sharedMapRoute(catalog.routes, mapId, layoutId, team);
  if (!route) return undefined;
  const url = files[`../data/map-recommendations/${route.svg}`];
  return url ? { ...route, url } : undefined;
}
export function hasRecommendedRoutes(mapId: string, layoutId: string) {
  return !!sharedMapRoute(catalog.routes, mapId, layoutId, 1);
}
