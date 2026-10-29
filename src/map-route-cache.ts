import type { MapRoute } from "./map-data-api";

export type LoadedMapRoute = MapRoute & { url: string };
type Reads = {
  index: (releaseId: string, signal: AbortSignal) => Promise<MapRoute[]>;
  svg: (route: MapRoute, releaseId: string, signal: AbortSignal) => Promise<Blob>;
};

// Restricted files stay in this identity's memory, never in persistent/public caches.
export class MapRouteCache {
  private controller = new AbortController();
  private indexes = new Map<string, Promise<MapRoute[]>>();
  private pending = new Map<string, Promise<LoadedMapRoute | undefined>>();
  private saved = new Map<string, LoadedMapRoute | undefined>();
  private pins = new Map<string, number>();
  private reads: Reads;

  constructor(reads: Reads) {
    this.reads = reads;
  }

  key(releaseId: string, mapId: string, layoutId: string, team: number) {
    return JSON.stringify([releaseId, mapId, layoutId, team]);
  }

  index(releaseId: string) {
    if (this.controller.signal.aborted) return Promise.reject(this.controller.signal.reason);
    let request = this.indexes.get(releaseId);
    if (!request) {
      const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(20000)]);
      request = this.reads.index(releaseId, signal).catch((error) => {
        this.indexes.delete(releaseId);
        throw error;
      });
      this.indexes.set(releaseId, request);
    }
    return request;
  }

  peek(key: string) {
    if (!this.saved.has(key)) return null;
    return {
      route: this.saved.get(key),
      status: this.saved.get(key) ? "loaded" : "empty",
      error: "",
    };
  }

  retain(key: string) {
    this.pins.set(key, (this.pins.get(key) || 0) + 1);
    return () => {
      const count = (this.pins.get(key) || 1) - 1;
      if (count) this.pins.set(key, count);
      else this.pins.delete(key);
      this.trim();
    };
  }

  private trim() {
    for (const [key, route] of this.saved) {
      if (this.saved.size <= 24) break;
      if (this.pins.has(key)) continue;
      if (route) URL.revokeObjectURL(route.url);
      this.saved.delete(key);
    }
  }

  load(releaseId: string, mapId: string, layoutId: string, team: number) {
    if (this.controller.signal.aborted) return Promise.reject(this.controller.signal.reason);
    const key = this.key(releaseId, mapId, layoutId, team);
    if (this.saved.has(key)) {
      const route = this.saved.get(key);
      this.saved.delete(key);
      this.saved.set(key, route);
      return Promise.resolve(route);
    }
    let request = this.pending.get(key);
    if (!request) {
      request = (async () => {
        const routes = await this.index(releaseId);
        this.controller.signal.throwIfAborted();
        const route = routes.find(
          (r) => r.mapId === mapId && r.layoutId === layoutId && r.team === team,
        );
        let loaded: LoadedMapRoute | undefined;
        if (route) {
          const blob = await this.reads.svg(
            route,
            releaseId,
            AbortSignal.any([this.controller.signal, AbortSignal.timeout(20000)]),
          );
          this.controller.signal.throwIfAborted();
          loaded = { ...route, url: URL.createObjectURL(blob) };
        }
        this.saved.set(key, loaded);
        this.trim();
        return loaded;
      })().finally(() => this.pending.delete(key));
      this.pending.set(key, request);
    }
    return request;
  }

  dispose() {
    this.controller.abort();
    for (const route of this.saved.values()) if (route) URL.revokeObjectURL(route.url);
    this.saved.clear();
    this.indexes.clear();
    this.pending.clear();
    this.pins.clear();
  }
}
