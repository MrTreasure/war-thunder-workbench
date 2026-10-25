import { t } from "./i18n/core";
import { useEffect, useSyncExternalStore } from "react";
import bootstrap from "./generated/bootstrap.json";
import { readPublicResource } from "./public-resource-api";
import type { CountryPayload, Vehicle } from "./models";

/** One public, country-scoped metadata service. No player data or modifications. */
export type VehicleFacts = Partial<Vehicle> & {
  id: string;
  name: string;
  country?: string;
  category?: string | null;
};
let snapshot: ReadonlyMap<string, VehicleFacts> = new Map();
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<void>>();
const loaded = new Map<string, number>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;
function publish(items: VehicleFacts[]) {
  const next = new Map(snapshot);
  for (const item of items) next.set(item.id, item);
  snapshot = next;
  listeners.forEach((listener) => listener());
}
export function registerCountryVehicles(payload: CountryPayload) {
  const items: VehicleFacts[] = [];
  for (const [category, tree] of Object.entries(payload.trees))
    for (const rank of tree?.ranks || [])
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members)
          items.push({ ...unit, country: payload.country, category });
  publish(items);
}
export function loadVehicleCountry(country: string): Promise<void> {
  if (!Object.hasOwn(bootstrap.countries, country)) return Promise.resolve();
  if ((loaded.get(country) || 0) > Date.now()) return Promise.resolve();
  const previous = pending.get(country);
  if (previous) return previous;
  const request = readPublicResource<{ country: string; items: VehicleFacts[] }>(
    `vehicles-${country}`,
  )
    .then((value) => {
      if (
        value.country !== country ||
        !Array.isArray(value.items) ||
        value.items.some(
          (v) =>
            !v || typeof v.id !== "string" || typeof v.name !== "string" || v.country !== country,
        )
      )
        throw new Error(t("载具目录格式异常。"));
      publish(value.items);
      loaded.set(country, Date.now() + 60_000);
    })
    .finally(() => pending.delete(country));
  pending.set(country, request);
  return request;
}
/** Call once at page/list scope, never once per tile. Hash/OPFS caching is shared. */
export function useVehicleCatalog(countries: string[]) {
  const data = useVehicleFacts();
  const key = [...new Set(countries)]
    .filter((id) => Object.hasOwn(bootstrap.countries, id))
    .sort()
    .join(",");
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden)
        for (const id of key.split(",").filter(Boolean))
          void loadVehicleCountry(id).catch(() => {
            /* Keep known facts and verified cache on failure. */
          });
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key]);
  return data;
}
export function useVehicleFacts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** Canonical facts override incomplete API projections, while keeping caller-only fields. */
export function withVehicleFacts<T extends { id: string }>(
  unit: T,
  facts: ReadonlyMap<string, VehicleFacts>,
) {
  return { ...unit, ...facts.get(unit.id) };
}
