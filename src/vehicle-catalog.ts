import { useEffect, useSyncExternalStore } from "react";
import bootstrap from "./generated/bootstrap.json";
import { vehicleStore, type VehicleFacts } from "./vehicle-store";
export type { VehicleFacts } from "./vehicle-store";
/** Every page reads the same complete country snapshot and indexes. */
export const loadBundledVehicleCountry = (country: string) =>
  vehicleStore.ensure(country).then(() => {});
export const loadVehicleCountry = loadBundledVehicleCountry;
export function useVehicleCatalog(countries: string[]) {
  const data = useVehicleFacts();
  const key = [...new Set(countries)]
    .filter((country) => Object.hasOwn(bootstrap.countries, country))
    .sort()
    .join(",");
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden)
        for (const country of key.split(",").filter(Boolean))
          void vehicleStore.ensure(country).catch(() => {});
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
  return useSyncExternalStore(vehicleStore.subscribe, vehicleStore.getFacts, vehicleStore.getFacts);
}
export function withVehicleFacts<T extends { id: string }>(
  unit: T,
  facts: ReadonlyMap<string, VehicleFacts>,
) {
  return { ...unit, ...facts.get(unit.id) };
}
