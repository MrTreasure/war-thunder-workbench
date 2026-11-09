import { useEffect, useSyncExternalStore } from "react";
import { AppUpdateGuards, AppUpdateStore, APP_UPDATE_INTERVAL, readAppBuildId } from "./app-update";
import { vehicleStore } from "./vehicle-store";

declare const __WT_BUILD_ID__: string;
export const appUpdateGuards = new AppUpdateGuards();
const bundledBuild = typeof __WT_BUILD_ID__ === "string" ? __WT_BUILD_ID__ : "development";
// Capture the identity already running in this document, never the first fetched
// response (which might already belong to a newer deployment).
const currentBuild =
  (typeof document !== "undefined" ? readAppBuildId(document.documentElement.outerHTML) : null) ||
  bundledBuild;
export const appUpdateStore = new AppUpdateStore(currentBuild, async () => {
  if (import.meta.env.DEV || currentBuild === "development" || document.hidden || !navigator.onLine)
    return null;
  // Use the active page entry, preserving the Render prefix and QMuse host.
  // Never send account/search parameters with a version check.
  const url = new URL(location.pathname, location.origin);
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "text/html" },
    redirect: "error",
  });
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html"))
    return null;
  const html = await response.text();
  if (html.length > 2_000_000) return null;
  return readAppBuildId(html);
});

export function useAppUpdateGuard(reason: string, active: boolean) {
  useEffect(() => (active ? appUpdateGuards.register(reason) : undefined), [reason, active]);
}
export function useAppUpdate() {
  const state = useSyncExternalStore(
    appUpdateStore.subscribe,
    appUpdateStore.getSnapshot,
    appUpdateStore.getSnapshot,
  );
  useEffect(() => {
    const check = () => {
      if (!document.hidden) void appUpdateStore.check();
    };
    check();
    const timer = window.setInterval(check, APP_UPDATE_INTERVAL);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!appUpdateGuards.getSnapshot().length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guardUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener("beforeunload", guardUnload);
    };
  }, []);
  return state;
}

/** Subscription only: it does not load countries or start a parallel update path. */
export function useCountryUpdateStatus(country?: string) {
  return useSyncExternalStore(
    vehicleStore.subscribe,
    () => (country ? vehicleStore.getCountry(country) : null),
    () => null,
  );
}
