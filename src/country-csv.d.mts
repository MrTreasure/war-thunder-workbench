import type { CountryPayload } from "./models";
export function encodeCsv(value: unknown): string;
export function decodeCsv(text: string): unknown;
export function countryBody(payload: CountryPayload): Omit<CountryPayload, "checkedAt" | "sources">;
export function restoreCountry(
  body: unknown,
  metadata: Pick<CountryPayload, "checkedAt" | "sources">,
): CountryPayload;
