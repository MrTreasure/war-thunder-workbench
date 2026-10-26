import { useEffect, useSyncExternalStore } from "react";
import { gameTagOptions } from "./game-tag-options";
import type { TagOption } from "./components/TagSelector";
import registry from "../data/lineup-sharing-tags.json";
import settings from "./config/player-stats.json";
type CatalogState = {
  items: TagOption[];
  revision: string;
  loading: boolean;
  error: string;
  loaded: boolean;
};
type Manifest = {
  schemaVersion: number;
  resource: string;
  sha256: string;
  bytes: number;
  path: string;
};
type Saved = { manifest: Manifest; body: string };
const preview = import.meta.env.VITE_WT_CATALOG_SOURCE === "preview";
const resource = preview ? "game-tags-preview" : "game-tags";
const base = `${settings.apiBaseUrl}/${preview ? "lineup-community-preview" : "lineup-community"}`;
let state: CatalogState = { items: [], revision: "", loading: true, error: "", loaded: false };
const listeners = new Set<() => void>();
let flight: Promise<void> | null = null;
const notify = () => listeners.forEach((listener) => listener());
async function read(path: string) {
  const response = await fetch(`${base}/${path}`, {
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("标签文案暂时无法读取");
  return response.json();
}
function valid(m: Manifest) {
  return (
    m.schemaVersion === 1 &&
    m.resource === "game-tags" &&
    /^[a-f0-9]{64}$/.test(m.sha256) &&
    Number.isSafeInteger(m.bytes) &&
    m.bytes > 0 &&
    m.bytes <= 2_097_152 &&
    m.path === `tags/catalog/${m.sha256}`
  );
}
async function verify(saved: Saved) {
  if (!saved || !valid(saved.manifest) || typeof saved.body !== "string")
    throw Error("标签版本无效");
  const bytes = new TextEncoder().encode(saved.body);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.byteLength !== saved.manifest.bytes || hash !== saved.manifest.sha256)
    throw Error("标签文案校验失败，请重试");
  const value = JSON.parse(saved.body) as { items: TagOption[]; revision: string };
  if (
    !Array.isArray(value.items) ||
    typeof value.revision !== "string" ||
    value.items.some(
      (item) =>
        typeof item.id !== "string" ||
        typeof item.label !== "string" ||
        typeof item.group !== "string",
    )
  )
    throw Error("标签文案格式不正确");
  return value;
}
async function directory() {
  return (await navigator.storage.getDirectory()).getDirectoryHandle("wt-public-resources-v1", {
    create: true,
  });
}
async function cached(): Promise<Saved | null> {
  try {
    const file = await (await (await directory()).getFileHandle(resource + ".json")).getFile();
    if (file.size < 2_200_000) return JSON.parse(await file.text());
  } catch {
    /* Isolated public-resource fallback only. */
  }
  try {
    const text = localStorage.getItem("wt-public-resources-v1:" + resource);
    if (text && text.length < 2_200_000) return JSON.parse(text);
  } catch {
    /* No cache. */
  }
  return null;
}
async function writeSaved(saved: Saved) {
  const text = JSON.stringify(saved);
  try {
    const file = await (await directory()).getFileHandle(resource + ".json", { create: true });
    const writer = await file.createWritable();
    try {
      await writer.write(text);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
    return;
  } catch {
    /* Never evict account, lineup or vehicle data. */
  }
  try {
    localStorage.setItem("wt-public-resources-v1:" + resource, text);
  } catch {
    /* Keep in memory. */
  }
}
let writeFlight: Promise<void> = Promise.resolve();
function persist(saved: Saved) {
  writeFlight = writeFlight.catch(() => {}).then(() => writeSaved(saved));
  return writeFlight;
}
export function refreshTagCatalog() {
  if (flight) return flight;
  state = { ...state, loading: true, error: "" };
  notify();
  flight = (async () => {
    const old = await cached();
    try {
      const manifest: Manifest = await read("tags/catalog");
      if (!valid(manifest)) throw Error("标签版本格式不正确");
      let saved: Saved;
      if (old?.manifest.sha256 === manifest.sha256) {
        try {
          await verify(old);
          saved = old;
        } catch {
          const object = await read(manifest.path);
          saved = { manifest, body: object.payload };
        }
      } else {
        const object = await read(manifest.path);
        saved = { manifest, body: object.payload };
      }
      const value = await verify(saved);
      state = {
        items: value.items,
        revision: manifest.sha256,
        loading: false,
        error: "",
        loaded: true,
      };
      void persist(saved);
    } catch (cause) {
      let items = state.items;
      if (old) {
        try {
          items = (await verify(old)).items;
        } catch {
          /* Damaged cache is never displayed. */
        }
      }
      state = {
        ...state,
        items,
        loading: false,
        error: cause instanceof Error ? cause.message : "标签读取失败",
      };
    }
  })().finally(() => {
    flight = null;
    notify();
  });
  return flight;
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function useTagCatalog(scope: "lineup" | "vehicle" = "lineup") {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!state.loaded && !flight) void refreshTagCatalog();
    const visible = () => {
      if (!document.hidden) void refreshTagCatalog();
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []);
  return {
    ...current,
    options: current.items.filter(
      (item) => !item.system && (!item.scopes || item.scopes.includes(scope)),
    ),
    refresh: refreshTagCatalog,
  };
}
export function tagLabel(id: string, items: readonly TagOption[]) {
  return (
    items.find((item) => item.id === id)?.label ||
    gameTagOptions.find((item) => item.id === id)?.label ||
    registry.tags.find((item) => item.id === id)?.label
  );
}
