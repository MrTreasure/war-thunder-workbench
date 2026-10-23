import settings from "../data/catalog-settings.json";
import countryAliases from "../data/country-aliases.json";
import countryFlags from "../data/flags.json";

const countries = settings.countries as Record<string, string>;
const aliases = countryAliases.aliases as Record<string, string>;
const labels = countryAliases.filterLabels as Record<string, string>;
const flags = countryFlags as Record<string, string>;

/** Normalize filter identity only; preserve stored records and original national markings. */
export function statsCountryId(country: string | null | undefined): string {
  const raw = country?.trim() || "unknown";
  const key = raw.toLowerCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : Object.hasOwn(countries, key) ? key : raw;
}

export function statsCountryMatches(country: string | null | undefined, selected: string): boolean {
  return selected === "all" || statsCountryId(country) === statsCountryId(selected);
}

export function statsCountryLabel(country: string): string {
  const id = statsCountryId(country);
  return Object.hasOwn(labels, id) ? labels[id] : Object.hasOwn(countries, id) ? countries[id] : id;
}

/** Flags identify the verified game research nation, independently of background era. */
export function statsCountryFlag(country: string | null | undefined) {
  const id = statsCountryId(country);
  return Object.hasOwn(flags, id) ? { id, url: flags[id], name: countries[id] } : null;
}
