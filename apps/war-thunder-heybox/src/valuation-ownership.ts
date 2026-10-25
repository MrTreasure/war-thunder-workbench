/** Verified valuation lists come from the viewed player's garage, including unplayed vehicles.
 * Older price-group entries omit per-vehicle flags; explicit flags still take precedence.
 */
export function valuationVehicleOwned(
  unit: { owned?: boolean | null },
  ownership?: { verified: boolean } | null,
): boolean {
  return unit.owned ?? ownership?.verified === true;
}
