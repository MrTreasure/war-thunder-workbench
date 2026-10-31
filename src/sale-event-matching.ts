import type { SaleChannel, SaleEvent, SaleVehicle } from "./sale-calendar-model";
import participation from "../data/sale-event-participation.json" with { type: "json" };

function inSaleScope(vehicle: SaleVehicle, event: SaleEvent): boolean {
  if (["market", "excluded", "unknown"].includes(vehicle.channel)) return false;
  if (event.countries.length && !event.countries.includes(vehicle.country)) return false;
  if (event.categories.length && !event.categories.includes(vehicle.category)) return false;
  if (event.excludedVehicleIds.includes(vehicle.id)) return false;
  return (
    event.channels.includes(vehicle.channel as SaleChannel) ||
    (event.channels.includes("bundle") && ["pack", "ge"].includes(vehicle.channel))
  );
}

/** A selected promotion needs a named vehicle or that vehicle's discount evidence.
 * Merely sharing a country or purchase channel does not establish participation. */
export function matchesSale(
  vehicle: SaleVehicle,
  event: SaleEvent,
  evidencedActivityIds: readonly string[] = [],
): boolean {
  if (!inSaleScope(vehicle, event)) return false;
  if (event.coverage === "explicit") return event.vehicleIds.includes(vehicle.id);
  if (event.vehicleIds.includes(vehicle.id) || evidencedActivityIds.includes(event.id)) return true;
  // A small, source-pinned supplement repairs historical announcements whose
  // stored calendar entry predates collection of the per-vehicle list.
  if (
    event.status === "confirmed" &&
    participation.events.some(
      (record) =>
        record.eventId === event.id &&
        record.vehicleIds.includes(vehicle.id) &&
        event.sources.some((source) => source.url === record.sourceUrl),
    )
  )
    return true;
  return (
    event.coverage === "all-except-exclusions" &&
    event.channels.includes(vehicle.channel as SaleChannel)
  );
}

export function nextSale(
  vehicle: SaleVehicle,
  events: SaleEvent[],
  now: number,
  evidencedActivityIds: readonly string[] = [],
): SaleEvent | null {
  return (
    events
      .filter((event) => {
        const end = Date.parse(
          event.status === "predicted" ? event.endWindow?.[1] || event.endAt : event.endAt,
        );
        if (!(end > now) || !inSaleScope(vehicle, event)) return false;
        if (event.status === "confirmed") return matchesSale(vehicle, event, evidencedActivityIds);
        // Forecast vehicle lists are intentionally empty. Consult confirmed history
        // for this family AND phase instead of interpreting the empty list as everyone.
        return events.some(
          (past) =>
            past.status === "confirmed" &&
            past.family === event.family &&
            past.phase === event.phase &&
            past.year < event.year &&
            Date.parse(past.startAt) <= now &&
            matchesSale(vehicle, past, evidencedActivityIds),
        );
      })
      .sort(
        (a, b) =>
          Math.max(now, Date.parse(a.startAt)) - Math.max(now, Date.parse(b.startAt)) ||
          Number(a.status === "predicted") - Number(b.status === "predicted"),
      )[0] || null
  );
}
