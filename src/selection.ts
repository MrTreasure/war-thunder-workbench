import { object } from "./validation.ts";
const KEY = "wt-workbench-selection-v1";
export interface Selection {
  country: string;
  category: string;
}
export function initialSelection(
  countries: Record<string, string>,
  categories: Record<string, string>,
  search: string,
): Selection {
  const query = new URLSearchParams(search);
  let saved: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (object(value)) saved = value;
  } catch {
    /* First visit or storage unavailable. */
  }
  const requested = query.get("country"),
    requestedCategory = query.get("category");
  const country =
    requested && Object.hasOwn(countries, requested)
      ? requested
      : typeof saved.country === "string" && Object.hasOwn(countries, saved.country)
        ? saved.country
        : "";
  const category =
    requestedCategory && Object.hasOwn(categories, requestedCategory)
      ? requestedCategory
      : typeof saved.category === "string" && Object.hasOwn(categories, saved.category)
        ? saved.category
        : "ground";
  return { country, category };
}
export function rememberSelection(value: Selection): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
