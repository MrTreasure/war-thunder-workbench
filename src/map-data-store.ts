import { useEffect, useState, useSyncExternalStore } from "react";
import {
  fetchMapSnapshot,
  fetchMapRoutes,
  fetchMapRouteSVG,
  validateMapSnapshot,
  mapAPIBase,
} from "./map-data-api";
import type { MapSnapshot, MapRoute } from "./map-data-api";
import { statsHeaders } from "./player-stats-api";
import { MapRouteCache } from "./map-route-cache";
import type { LoadedMapRoute } from "./map-route-cache";

let routeOwner = "";
let routesCache: MapRouteCache | null = null;
function routeCache(authorization: string) {
  if (routeOwner !== authorization) {
    routesCache?.dispose();
    routesCache = null;
    routeOwner = authorization;
  }
  if (!authorization) return null;
  return (routesCache ??= new MapRouteCache({
    index: (releaseId, signal) => fetchMapRoutes(releaseId, signal),
    svg: fetchMapRouteSVG,
  }));
}

type State = { snapshot: MapSnapshot | null; loading: boolean; error: string };
let state: State = { snapshot: null, loading: true, error: "" };
let pending: Promise<void> | null = null;
let lastCheck = 0;
const listeners = new Set<() => void>();
function emit(next: State) {
  state = next;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => state;
function cache(mode: "read" | "write", value?: MapSnapshot): Promise<MapSnapshot | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: MapSnapshot | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => finish(null), 300);
    try {
      const request = indexedDB.open("wt-map-data-cache-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("public");
      request.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (done) {
          db.close();
          return;
        }
        const tx = db.transaction("public", mode === "read" ? "readonly" : "readwrite");
        const store = tx.objectStore("public");
        const op = mode === "read" ? store.get(mapAPIBase) : store.put(value, mapAPIBase);
        let result: MapSnapshot | null = null;
        op.onsuccess = () => {
          if (mode === "read" && validateMapSnapshot(op.result)) result = op.result;
        };
        tx.oncomplete = () => {
          clearTimeout(timer);
          db.close();
          finish(result);
        };
        tx.onerror = tx.onabort = () => {
          clearTimeout(timer);
          db.close();
          finish(null);
        };
      };
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}
export function refreshMapCatalog(force = false): Promise<void> {
  if (pending) return pending;
  if (!force && state.snapshot && Date.now() - lastCheck < 60000) return Promise.resolve();
  lastCheck = Date.now();
  pending = (async () => {
    if (!state.snapshot) {
      const saved = await cache("read");
      if (saved) emit({ snapshot: saved, loading: false, error: "" });
    }
    emit({ ...state, loading: !state.snapshot, error: "" });
    try {
      const fresh = await fetchMapSnapshot(AbortSignal.timeout(20000));
      emit({ snapshot: fresh, loading: false, error: "" });
      void cache("write", fresh);
    } catch (e) {
      emit({
        ...state,
        loading: false,
        error: e instanceof Error ? e.message : "地图资料暂时不可用",
      });
    }
  })().finally(() => {
    pending = null;
  });
  return pending;
}
export function useMapCatalog() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void refreshMapCatalog();
    const focus = () => {
      if (!document.hidden) void refreshMapCatalog();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  return {
    ...current,
    retry: () => {
      void refreshMapCatalog(true);
    },
  };
}
export function useMapRouteCoverage(releaseId: string, enabled: boolean) {
  const [saved, setSaved] = useState<{ key: string; routes: MapRoute[] }>({ key: "", routes: [] });
  const authorization = statsHeaders().Authorization || "";
  const key = `${authorization}:${releaseId}`;
  const cache = routeCache(enabled ? authorization : "");
  useEffect(() => {
    if (!cache || !releaseId) return;
    let active = true;
    void cache
      .index(releaseId)
      .then((routes) => {
        if (active) setSaved({ key, routes });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, cache, releaseId]);
  return enabled && authorization && saved.key === key ? saved.routes : [];
}
export function useMapRoute(
  releaseId: string,
  mapId: string,
  layoutId: string,
  team: number,
  enabled: boolean,
  retry: number,
) {
  const authorization = statsHeaders().Authorization || "";
  const key = `${authorization}:${releaseId}:${mapId}:${layoutId}:${team}:${retry}`;
  const cache = routeCache(enabled ? authorization : "");
  const cacheKey = cache?.key(releaseId, mapId, layoutId, team) || "";
  const [saved, setSaved] = useState<{
    key: string;
    route: LoadedMapRoute | undefined;
    status: string;
    error: string;
  }>({ key: "", route: undefined, status: "loading", error: "" });
  useEffect(() => {
    if (!cache) return;
    let active = true;
    const release = cache.retain(cacheKey);
    void (async () => {
      const route = await cache.load(releaseId, mapId, layoutId, team);
      if (active) setSaved({ key, route, status: route ? "loaded" : "empty", error: "" });
    })().catch((e) => {
      if (active)
        setSaved({
          key,
          route: undefined,
          status: "error",
          error: e instanceof Error ? e.message : "推荐走线读取失败",
        });
    });
    // Only the other side of this mission is warmed, after authorization.
    void cache.load(releaseId, mapId, layoutId, team === 1 ? 2 : 1).catch(() => {});
    return () => {
      active = false;
      release();
    };
  }, [key, cache, cacheKey, releaseId, mapId, layoutId, team]);
  return enabled && authorization
    ? cache?.peek(cacheKey) ||
        (saved.key === key ? saved : { route: undefined, status: "loading", error: "" })
    : { route: undefined, status: "empty", error: "" };
}
