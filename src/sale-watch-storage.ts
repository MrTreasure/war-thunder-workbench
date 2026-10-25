import bootstrap from "./generated/bootstrap.json";
import { object } from "./validation";
import { vehicleMedia } from "./vehicle-media";
import type { SaleVehicle } from "./sale-calendar-model";
export const saleWatchKey = "wt-sale-watch-v1";
/** Read older snapshots per item: one missing image must not discard the full list. */
export const saleWatchEnvelope = (value: unknown): value is unknown[] =>
  Array.isArray(value) && value.length <= 60;
export function normalizeSaleWatch(value: unknown): SaleVehicle[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, SaleVehicle>();
  for (const row of value.slice(0, 60)) {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !/^[a-z0-9_-]{1,100}$/i.test(row.id) ||
      typeof row.country !== "string" ||
      !Object.hasOwn(bootstrap.countries, row.country) ||
      typeof row.category !== "string" ||
      !Object.hasOwn(bootstrap.categories, row.category) ||
      typeof row.channel !== "string" ||
      !["ge", "pack", "bundle"].includes(row.channel)
    )
      continue;
    const image =
      typeof row.image === "string" &&
      row.image.startsWith("https://static.encyclopedia.warthunder.com/")
        ? row.image
        : vehicleMedia(row.id).thumbnailUrl;
    const quote = object(row.originalPrice) ? row.originalPrice : null;
    const originalPrice =
      quote && (quote.currency === "GE" || quote.currency === "CNY")
        ? {
            currency: quote.currency as "GE" | "CNY",
            amount:
              typeof quote.amount === "number" &&
              Number.isSafeInteger(quote.amount) &&
              quote.amount > 0
                ? quote.amount
                : null,
            checkedAt:
              typeof quote.checkedAt === "string" && Number.isFinite(Date.parse(quote.checkedAt))
                ? quote.checkedAt
                : null,
            source:
              typeof quote.source === "string" && quote.source.startsWith("https://")
                ? quote.source
                : null,
          }
        : null;
    items.set(row.id, {
      id: row.id,
      name: typeof row.name === "string" && row.name ? row.name.slice(0, 160) : row.id,
      nameEn: typeof row.nameEn === "string" ? row.nameEn.slice(0, 160) : "",
      country: row.country,
      category: row.category,
      channel: row.channel as SaleVehicle["channel"],
      image,
      rank: typeof row.rank === "string" ? row.rank.slice(0, 12) : "",
      store: typeof row.store === "string" && row.store.startsWith("https://") ? row.store : null,
      market:
        typeof row.market === "string" && row.market.startsWith("https://") ? row.market : null,
      originalPrice,
    });
  }
  return [...items.values()];
}
