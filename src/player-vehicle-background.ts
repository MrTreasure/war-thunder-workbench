import ww2 from "./assets/vehicle-card-ww2.webp?url";
import coldwar from "./assets/vehicle-card-coldwar.webp?url";
import modern from "./assets/vehicle-card-modern.webp?url";
import layout from "../data/player-vehicle-card.json";
import type { PlayerVehicle } from "./player-stats-api";

export type VehicleCardEra = keyof typeof layout.backgrounds;
export const vehicleCardBackgrounds = layout.backgrounds;
export const vehicleCardBackgroundUrls: Record<VehicleCardEra, string> = { ww2, coldwar, modern };
export function defaultVehicleCardEra(vehicle: PlayerVehicle): VehicleCardEra {
  const overrides = layout.selection.vehicleOverrides as Record<string, VehicleCardEra>;
  const categories = layout.selection.rankFallback as Record<
    string,
    Record<string, VehicleCardEra>
  >;
  // Theme selection is approximate when no per-vehicle override is available.
  return overrides[vehicle.id] || categories[vehicle.category || ""]?.[vehicle.rank || ""] || "ww2";
}
