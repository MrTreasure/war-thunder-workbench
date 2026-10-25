import { object } from "./validation.ts";
const KEY = "wt-workbench-selection-v1";
export interface Selection {
  country: string;
  category: string;
  mode?: "ab" | "rb" | "sb";
  filter?: string;
  query?: string;
}
export function initialSelection(
  countries: Record<string, string>,
  categories: Record<string, string>,
  search: string,
  preferSaved = true,
): Selection {
  const query = new URLSearchParams(search);
  let saved: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (object(value)) saved = value;
  } catch {
    /* First visit or storage unavailable. */
  }
  // A returning browser restores its last filters rather than stale bookmark parameters.
  if (preferSaved) {
    if (typeof saved.country === "string" && Object.hasOwn(countries, saved.country))
      query.set("country", saved.country);
    if (typeof saved.category === "string" && Object.hasOwn(categories, saved.category))
      query.set("category", saved.category);
    if (saved.mode === "ab" || saved.mode === "rb" || saved.mode === "sb")
      query.set("mode", saved.mode);
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
  const mode = query.get("mode") || saved.mode;
  return {
    country,
    category,
    mode: mode === "ab" || mode === "sb" ? mode : "rb",
    filter:
      typeof saved.filter === "string" &&
      ["all", "premium", "gold", "pack", "squadron", "other"].includes(saved.filter)
        ? saved.filter
        : "all",
    query: typeof saved.query === "string" ? saved.query.slice(0, 120) : "",
  };
}
export function rememberSelection(value: Selection): boolean {
  try {
    let previous = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (object(parsed)) previous = parsed;
    } catch {
      /* Repair only this preference. */
    }
    localStorage.setItem(KEY, JSON.stringify({ ...previous, ...value }));
    return true;
  } catch {
    return false;
  }
}
