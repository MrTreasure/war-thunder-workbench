/** Refresh recovery is restricted to the workbench's dedicated HTTPS origin.
 * QMuse shares an origin with other apps, so its bearer token stays in memory.
 * The backend still validates every restored token; this is not an identity cache.
 */
const KEY = "wt-stats-tab-session-v1";
function dedicatedOrigin() {
  return typeof window !== "undefined" && window.location.origin === "https://wt.mrtreasure.cc";
}
export function readStatsTabSession(): string {
  if (!dedicatedOrigin()) return "";
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
export function writeStatsTabSession(token: string): void {
  if (!dedicatedOrigin()) return;
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage restrictions leave the existing in-memory session usable.
  }
}
