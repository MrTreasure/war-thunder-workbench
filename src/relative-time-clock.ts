// One display clock for every relative timestamp; no network reads or business jobs.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function refresh() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}
function stop() {
  clearInterval(timer);
  timer = undefined;
}
function visibilityChanged() {
  stop();
  if (document.hidden) return;
  refresh();
  timer = setInterval(refresh, 60000);
}
function focused() {
  if (!document.hidden) refresh();
}
export function subscribeRelativeClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", focused);
    visibilityChanged();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop();
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", focused);
    }
  };
}
export function relativeClockSnapshot() {
  return now;
}
