import html from "./generated/weakpoint-shell/shell.html?raw";
import css from "./generated/weakpoint-shell/shell.css?raw";
import script from "./generated/weakpoint-shell/shell.js?url";
import symbols from "./assets/WTSymbols.ttf?url";
import cardFont from "./assets/FiraSansCondensed-Regular.ttf?url";

const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const absolute = (value: string) => new URL(value, location.href).href;

/** Trusted same-origin UI; credentials and private evidence never enter this document. */
export function weakpointShellDocument(vehicle?: string) {
  const selected = vehicle && /^[a-z0-9_]+$/.test(vehicle) ? vehicle : "";
  const styles = css.replaceAll("../../assets/WTSymbols.ttf", absolute(symbols)).replaceAll("../../assets/FiraSansCondensed-Regular.ttf", absolute(cardFont));
  return html
    .replace('<html lang="zh-CN">', `<html lang="zh-CN" data-wt-embedded="true" data-wt-parent-origin="${escapeAttribute(location.origin)}" data-wt-vehicle="${selected}">`)
    .replace('<link rel="stylesheet" href="./shell.css">', `<style>${styles}</style>`)
    .replace("../../assets/WTSymbols.ttf", escapeAttribute(absolute(symbols)))
    .replace("./shell.js", escapeAttribute(absolute(script)));
}

/** Only existing hashed weakpoint images use the shared Cloudflare resource host. */
export function weakpointDisplayResources<T>(value: T): T {
  if (typeof value === "string") {
    return (/^\.\/assets\/weakpoints-[a-zA-Z0-9_.-]+\.[a-f0-9]{16}\.webp$/.test(value)
      ? new URL(value, "https://render.mrtreasure.cc/war-thunder-trees/").href
      : value) as T;
  }
  if (Array.isArray(value)) return value.map(weakpointDisplayResources) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, weakpointDisplayResources(entry)])) as T;
  return value;
}
