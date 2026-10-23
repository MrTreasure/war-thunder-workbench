import type { Locale } from "./core";

const segments: Record<Locale, string> = { "zh-CN": "zh", en: "en", ru: "ru" };
/** Outer paths are language entries; hash routes remain application state. */
export function pathLocale(pathname: string): Locale | undefined {
  const segment = pathname.match(/\/(zh|en|ru)\/(?:index\.html)?$/)?.[1];
  return segment === "zh" ? "zh-CN" : segment === "en" || segment === "ru" ? segment : undefined;
}
export function appBasePath(pathname: string): string {
  return pathname.replace(/(?:zh|en|ru)\/(?:index\.html)?$/, "").replace(/index\.html$/, "");
}
export function localeAppPath(pathname: string, locale: Locale): string {
  return `${appBasePath(pathname)}${segments[locale]}/`;
}
export function localeGuidePath(locale: Locale, slug = ""): string {
  return `about/${segments[locale]}/${slug ? `${slug}/` : ""}`;
}
