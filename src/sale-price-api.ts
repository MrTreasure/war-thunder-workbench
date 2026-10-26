import { readPublicResource } from "./public-resource-api";
import { statsRequest } from "./player-stats-api";
import type { PricePreferences, PriceSummary } from "./sale-price-model";
const preview = import.meta.env.VITE_WT_CATALOG_SOURCE === "preview";
const path = preview ? "sales-prices-preview/prices/preferences" : "sales/prices/preferences";
export const readPriceSummary = (country: string, signal?: AbortSignal) =>
  readPublicResource<{ country: string; items: PriceSummary[] }>("prices-" + country, signal);
export const readPriceHistory = (vehicleId: string, signal?: AbortSignal) =>
  readPublicResource<PriceSummary>("price-history-" + vehicleId, signal);
export type PricePreferenceDocument = { revision: number; items: PricePreferences };
export const readPricePreferences = (signal?: AbortSignal) =>
  statsRequest<PricePreferenceDocument>(path, undefined, signal);
export const savePricePreferences = (document: PricePreferenceDocument, ownerKey: string) =>
  statsRequest<PricePreferenceDocument>(path, { ...document, ownerKey });
