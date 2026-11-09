export type AppUpdateSnapshot = {
  current: string;
  available: string | null;
  checking: boolean;
};
export const APP_UPDATE_INTERVAL = 15 * 60_000;
export const APP_UPDATE_FOCUS_INTERVAL = 60_000;
const BUILD_ID = /^[a-f0-9]{24}$/;
const PLATFORM_ID = /^qmuse:(?:0|[1-9]\d{0,31})$/;
function validIdentity(id: string) {
  return BUILD_ID.test(id) || PLATFORM_ID.test(id);
}
function identityNamespace(id: string) {
  return PLATFORM_ID.test(id) ? "qmuse" : BUILD_ID.test(id) ? "build" : "unknown";
}

/** Read a marker without executing fetched HTML or scripts. */
export function readAppBuildId(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g))
      attrs.set(match[1].toLowerCase(), match[3]);
    if (attrs.get("name") === "wt-build-id" && BUILD_ID.test(attrs.get("content") || ""))
      return attrs.get("content")!;
  }
  // QMuse generates the page entry itself. Its inline bootstrap carries the
  // published appVersionId even when Vite HTML metadata is not preserved.
  const platformIds = new Set<string>();
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    for (const match of script[1].matchAll(
      /[{,]\s*"appVersionId"\s*:\s*"(0|[1-9]\d{0,31})"\s*(?=[,}])/g,
    ))
      platformIds.add(match[1]);
  }
  return platformIds.size === 1 ? `qmuse:${[...platformIds][0]}` : null;
}

/** Only a validated successful response can change the known available version. */
export class AppUpdateStore {
  private state: AppUpdateSnapshot;
  private listeners = new Set<() => void>();
  private flight: Promise<void> | null = null;
  private checkedAt = -Infinity;
  private read: () => Promise<string | null>;
  private now: () => number;
  constructor(current: string, read: () => Promise<string | null>, now = Date.now) {
    this.read = read;
    this.now = now;
    this.state = { current, available: null, checking: false };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(next: AppUpdateSnapshot) {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  check(minInterval = APP_UPDATE_FOCUS_INTERVAL): Promise<void> {
    if (this.flight) return this.flight;
    if (this.now() - this.checkedAt < minInterval) return Promise.resolve();
    this.checkedAt = this.now();
    this.set({ ...this.state, checking: true });
    this.flight = Promise.resolve()
      .then(this.read)
      .then((id) => {
        if (
          id &&
          validIdentity(id) &&
          identityNamespace(id) === identityNamespace(this.state.current)
        )
          this.set({ ...this.state, available: id === this.state.current ? null : id });
      })
      .catch(() => {
        // A failed check never invalidates the running build or a known update.
      })
      .finally(() => {
        this.flight = null;
        this.set({ ...this.state, checking: false });
      });
    return this.flight;
  }
}

/** Guards are registered by the owners of actual unsaved or unsynced state. */
export class AppUpdateGuards {
  private entries = new Map<symbol, string>();
  private listeners = new Set<() => void>();
  private reasons: readonly string[] = [];
  getSnapshot = () => this.reasons;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  register(reason: string) {
    const key = Symbol();
    this.entries.set(key, reason);
    this.emit();
    return () => {
      this.entries.delete(key);
      this.emit();
    };
  }
  private emit() {
    this.reasons = [...new Set(this.entries.values())];
    for (const listener of this.listeners) listener();
  }
  requestReload(reload: () => void): boolean {
    if (this.entries.size) return false;
    reload();
    return true;
  }
}
