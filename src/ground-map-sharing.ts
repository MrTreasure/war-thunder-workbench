import atlas from "../data/ground-maps.json" with { type: "json" };

type MapRoute = { mapId: string; layoutId: string; team: number };

export function sharedMapIdentity(mapId: string, layoutId?: string) {
  const variant = atlas.seasonalVariants.find((entry) => entry.mapId === mapId);
  if (!variant) return { mapId, layoutId };
  // Only explicitly associated missions may share a route. Other layouts keep
  // their own identity, even when the terrain belongs to the same map family.
  const sourceLayout = Object.entries(variant.layouts).find(([id]) => id === layoutId)?.[1];
  return layoutId && !sourceLayout
    ? { mapId, layoutId }
    : { mapId: variant.sourceMapId, layoutId: sourceLayout };
}

export function sharedMapGuides(mapId: string) {
  const sourceId = sharedMapIdentity(mapId).mapId;
  const guides = atlas.maps
    .filter((map) => sharedMapIdentity(map.id).mapId === sourceId)
    .flatMap((map) => map.guides);
  return [...new Map(guides.map((guide) => [guide.source, guide])).values()];
}

export function sharedMapRoute<T extends MapRoute>(
  routes: readonly T[],
  mapId: string,
  layoutId: string,
  team: number,
): T | undefined {
  const target = sharedMapIdentity(mapId, layoutId);
  return routes.find((route) => {
    const source = sharedMapIdentity(route.mapId, route.layoutId);
    return (
      source.mapId === target.mapId && source.layoutId === target.layoutId && route.team === team
    );
  });
}
