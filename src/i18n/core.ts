import messages from "../../data/i18n.json";
import { localeAppPath, pathLocale } from "./urls";

export type Locale = "zh-CN" | "en" | "ru";
export const locales: readonly Locale[] = ["zh-CN", "en", "ru"];
const key = "wt-language-v1";
const listeners = new Set<() => void>();
const dictionary = messages as Record<string, readonly string[]>;
const validLocale = (value: unknown): value is Locale => locales.includes(value as Locale);
function browserLocale(): Locale {
  if (typeof navigator === "undefined") return "zh-CN";
  const preferred = [...(navigator.languages || []), navigator.language];
  for (const language of preferred) {
    const base = language?.trim().toLowerCase().split(/[-_]/)[0];
    if (base === "zh") return "zh-CN";
    if (base === "en" || base === "ru") return base;
  }
  return "zh-CN";
}
function initialLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";
  const entryLocale = pathLocale(window.location.pathname);
  if (entryLocale) return entryLocale;
  try {
    const query = new URLSearchParams(window.location.search).get("lang");
    if (validLocale(query)) return query;
    const saved = localStorage.getItem(key);
    if (validLocale(saved)) return saved;
  } catch {
    /* A denied storage permission must not prevent startup. */
  }
  return browserLocale();
}
let locale = initialLocale();
export const getLocale = () => locale;
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function updateDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.wtLocale = locale;
}
updateDocument();
export function setLocale(next: Locale) {
  if (!validLocale(next)) return;
  const changed = locale !== next;
  locale = next;
  updateDocument();
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const localizedEntries = document.querySelector('meta[name="wt-localized-entries"]');
    if (localizedEntries || pathLocale(url.pathname))
      url.pathname = localeAppPath(url.pathname, next);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
    }
    const pathChanged = url.pathname !== window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
    if (pathChanged) window.dispatchEvent(new Event("wt-language-url-change"));
  }
  try {
    localStorage.setItem(key, next);
  } catch {
    /* Keep the in-memory choice. */
  }
  if (changed) for (const listener of listeners) listener();
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    // A fixed language URL must not change when another tab changes its preference.
    const next =
      pathLocale(window.location.pathname) ||
      (validLocale(event.newValue) ? event.newValue : initialLocale());
    if (next === locale) return;
    locale = next;
    updateDocument();
    for (const listener of listeners) listener();
  });
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(dictionary)
  .filter(([source]) => /\{\d+\}/.test(source))
  .map(([source, translations]) => {
    const slots: number[] = [];
    let pattern = "",
      end = 0;
    for (const match of source.matchAll(/\{(\d+)\}/g)) {
      pattern += escape(source.slice(end, match.index)) + "([\\s\\S]*?)";
      slots.push(Number(match[1]));
      end = match.index + match[0].length;
    }
    pattern += escape(source.slice(end));
    return { expression: new RegExp("^" + pattern + "$", "u"), translations, slots, source };
  })
  .sort(
    (a, b) => b.source.replace(/\{\d+\}/g, "").length - a.source.replace(/\{\d+\}/g, "").length,
  );
// Some public providers return English labels. Translate only unambiguous known labels.
const englishLabels = new Map<string, string | null>();
for (const [source, [english, russian]] of Object.entries(dictionary)) {
  if (/\{\d+\}/.test(source) || !english.trim()) continue;
  const key = english.trim();
  const previous = englishLabels.get(key);
  englishLabels.set(key, previous === undefined || previous === russian ? russian : null);
}
const caches = { en: new Map<string, string>(), ru: new Map<string, string>() };
function translated(source: string): string {
  if (locale === "zh-CN") return source;
  const column = locale === "en" ? 0 : 1;
  const cache = caches[locale];
  const cached = cache.get(source);
  if (cached !== undefined) return cached;
  const trimmed = source.trim().replace(/\s+/g, " ");
  let result =
    dictionary[trimmed]?.[column] ??
    (locale === "ru" ? (englishLabels.get(trimmed) ?? undefined) : undefined);
  if (result === undefined && !/\p{Script=Han}/u.test(source)) return source;
  if (result === undefined) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(trimmed);
      if (!match) continue;
      const values = new Map(pattern.slots.map((slot, i) => [slot, match[i + 1]]));
      result = pattern.translations[column].replace(
        /\{(\d+)\}/g,
        (_, slot: string) => values.get(Number(slot)) ?? "",
      );
      break;
    }
  }
  if (result === undefined) return source;
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const value = leading + result + trailing;
  if (cache.size >= 12000) cache.clear();
  cache.set(source, value);
  return value;
}
/** Translate a UI message; placeholders preserve values and their order. */
export function t(source: string, values?: readonly (string | number)[]): string {
  const value = translated(source);
  return values
    ? value.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ""))
    : value;
}
/** Display-only localization: never changes form values, IDs, saved data or React elements. */
export function localize<T>(value: T): T {
  if (typeof value === "string") return translated(value) as T;
  if (Array.isArray(value)) return value.map((entry: unknown) => localize(entry)) as T;
  return value;
}
type Named = { name: string; nameEn?: string; nameRu?: string | null; english?: string };
export function vehicleName(value: Named): string;
export function vehicleName(value: Named | null | undefined): string | undefined;
export function vehicleName(value: Named | null | undefined): string | undefined {
  if (!value) return undefined;
  if (locale === "zh-CN") return value.name;
  const russian = typeof value.nameRu === "string" && value.nameRu ? value.nameRu : undefined;
  const english =
    typeof value.nameEn === "string" && value.nameEn
      ? value.nameEn
      : typeof value.english === "string"
        ? value.english
        : undefined;
  return (locale === "ru" ? russian : undefined) || english || t(value.name);
}

export const decimalSeparator = () =>
  new Intl.NumberFormat(getLocale()).formatToParts(1.1).find((part) => part.type === "decimal")
    ?.value || ".";
export const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat(getLocale(), { year: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
/** Search every verified name, regardless of the current display language. */
export function vehicleSearchText(value: Named & { id?: string }) {
  return [value.name, value.nameEn, value.nameRu, value.english, value.id]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ");
}
