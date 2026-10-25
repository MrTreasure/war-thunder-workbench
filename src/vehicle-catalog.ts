import { vehicleFactModules } from "./generated/vehicle-fact-modules";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
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
const bundled = new Map<string, Promise<void>>();
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
/** Validated package metadata, also usable in native hosts without browser fetch. */
export function loadBundledVehicleCountry(country: string): Promise<void> {
  if (!Object.hasOwn(bootstrap.countries, country)) return Promise.resolve();
  const previous = bundled.get(country);
  if (previous) return previous;
  const request = (async () => {
    const entry = vehicleFactModules[country];
    if (entry) {
      const { default: text } = await entry.load();
      const bytes = new TextEncoder().encode(text);
      if (bytes.byteLength !== entry.bytes || bytesToHex(sha256(bytes)) !== entry.sha256)
        throw new Error("载具目录格式异常。");
      const body = JSON.parse(text) as {
        schemaVersion: number;
        country: string;
        items: VehicleFacts[];
      };
      if (
        body.schemaVersion !== 1 ||
        body.country !== country ||
        !Array.isArray(body.items) ||
        body.items.some(
          (item) =>
            !item ||
            typeof item.id !== "string" ||
            typeof item.name !== "string" ||
            item.country !== country,
        )
      )
        throw new Error("载具目录格式异常。");
      publish(body.items);
    }
  })().catch((error) => {
    bundled.delete(country);
    throw error;
  });
  bundled.set(country, request);
  return request;
}
export function loadVehicleCountry(country: string): Promise<void> {
  if (!Object.hasOwn(bootstrap.countries, country)) return Promise.resolve();
  if ((loaded.get(country) || 0) > Date.now()) return Promise.resolve();
  const previous = pending.get(country);
  if (previous) return previous;
  const request = (async () => {
    await loadBundledVehicleCountry(country);
    // The immutable build snapshot is a verified fallback. Preview never changes the live catalog.
    if (import.meta.env.VITE_WT_CATALOG_SOURCE !== "preview") {
      try {
        const value = await readPublicResource<{ country: string; items: VehicleFacts[] }>(
          `vehicles-${country}`,
        );
        if (
          value.country !== country ||
          !Array.isArray(value.items) ||
          value.items.some(
            (v) =>
              !v || typeof v.id !== "string" || typeof v.name !== "string" || v.country !== country,
          )
        )
          throw new Error("载具目录格式异常。");
        // Compatibility with older public directories, which contained acquisition data only.
        publish(value.items.filter((v) => v.br && v.side && v.role));
      } catch {
        /* Keep the build snapshot and last verified facts. */
      }
    }
    loaded.set(country, Date.now() + 60_000);
  })().finally(() => pending.delete(country));
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
