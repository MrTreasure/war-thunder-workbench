/** Orbit consumes the same presentation and catalog instance as the workbench.
 * This entry exports public vehicle facts only, never player or admin services. */
export { VehicleTile } from "./VehicleTile";
export type { VehicleTileUnit } from "./VehicleTile";
export { vehicleStore } from "./vehicle-store";
export type { VehicleFacts } from "./vehicle-store";
export { useVehicleCatalog } from "./vehicle-catalog";
export { lineupCardRating } from "./lineups";
export type { BattleType, LineupVehicle } from "./lineups";
export type { Mode } from "./models";
export { default as vehicleCodebook } from "../data/lineup-codebook.json";
export { default as vehicleBootstrap } from "./generated/bootstrap.json";
