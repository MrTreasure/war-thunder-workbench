import hosting from "../data/catalog-hosting.json";
import { readPublicResource } from "./public-resource-api";
import { object } from "./validation";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { DataFile } from "./data-loader";
import type { DataManifest } from "./models";

const encoder = new TextEncoder();
type Pointer = {
  available: boolean;
  repository: string;
  commit: string;
  manifest: { path: string; sha256: string; bytes: number };
};
let remembered: { commit: string; manifest: DataManifest } | null = null;
// Transport modules contain a single JSON literal. Fetch them as text and parse
// that literal; remote JavaScript is never executed or imported into the app.
export function parseDataTransport(text: string): unknown {
  const match = /^export default ([\s\S]+);\s*$/.exec(text);
  if (!match) throw new Error("资料资源格式无效。");
  return JSON.parse(match[1]);
}
export async function readCatalogAsset(
  path: string,
  commit: string,
  signal?: AbortSignal,
): Promise<string> {
  if (
    !/^[a-f0-9]{40}$/.test(commit) ||
    !/^war-thunder\/catalog\/(?:manifest(?:\.[a-f0-9]{16})?\.js|countries\/country-[a-z]+\.[a-f0-9]{16}\.js)$/.test(
      path,
    )
  )
    throw new Error("资料资源地址无效。");
  const urls =
    import.meta.env.VITE_WT_CATALOG_SOURCE === "preview"
      ? [
          new URL(
            `preview-catalog/${path.replace(/^war-thunder\/catalog\//, "")}`,
            document.baseURI,
          ).href,
        ]
      : [
          `https://cdn.jsdelivr.net/gh/${hosting.repository}@${commit}/${path}`,
          `https://raw.githubusercontent.com/${hosting.repository}/${commit}/${path}`,
        ];
  for (const url of urls) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(url, {
        credentials: "omit",
        cache:
          import.meta.env.VITE_WT_CATALOG_SOURCE === "preview" && path.endsWith("/manifest.js")
            ? "no-cache"
            : "force-cache",
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20_000)]),
      });
      if (!response.ok) throw new Error("资料资源暂时无法读取。");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 64 * 1024 * 1024) throw new Error("资料资源超过大小限制。");
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  throw new Error("资料资源暂时无法读取，已保留上次数据。");
}
export async function readRemoteCatalog(signal?: AbortSignal): Promise<DataManifest | null> {
  let pointer: Pointer | null;
  if (import.meta.env.VITE_WT_CATALOG_SOURCE === "preview") {
    const response = await fetch(new URL("preview-catalog/pointer.js", document.baseURI), {
      credentials: "omit",
      cache: "no-cache",
      signal,
    });
    if (!response.ok) throw new Error("预览资料索引暂时不可用。");
    const text = await response.text();
    if (encoder.encode(text).byteLength > 65536) throw new Error("预览资料索引过大。");
    pointer = parseDataTransport(text) as Pointer;
  } else {
    pointer = await readPublicResource<Pointer>(hosting.resource, signal);
  }
  if (!pointer?.available) return null;
  if (
    pointer.repository !== hosting.repository ||
    !/^[a-f0-9]{40}$/.test(pointer.commit) ||
    (pointer.manifest?.path !== hosting.manifestPath &&
      !(
        import.meta.env.VITE_WT_CATALOG_SOURCE === "preview" &&
        /^war-thunder\/catalog\/manifest\.[a-f0-9]{16}\.js$/.test(pointer.manifest?.path || "")
      )) ||
    !/^[a-f0-9]{64}$/.test(pointer.manifest.sha256) ||
    !Number.isSafeInteger(pointer.manifest.bytes) ||
    pointer.manifest.bytes < 1 ||
    pointer.manifest.bytes > 65536
  )
    throw new Error("资料版本索引无效。");
  if (remembered?.commit === pointer.commit) return remembered.manifest;
  const text = await readCatalogAsset(pointer.manifest.path, pointer.commit, signal);
  if (
    encoder.encode(text).byteLength !== pointer.manifest.bytes ||
    bytesToHex(sha256(encoder.encode(text))) !== pointer.manifest.sha256
  )
    throw new Error("资料版本索引校验失败。");
  const value = parseDataTransport(text);
  if (!object(value) || value.schemaVersion !== 4 || !object(value.countries))
    throw new Error("资料版本格式无效。");
  const countries: Record<string, DataFile> = {};
  for (const country of [
    "usa",
    "germany",
    "ussr",
    "britain",
    "japan",
    "china",
    "italy",
    "france",
    "sweden",
    "israel",
  ]) {
    const entry = value.countries[country];
    if (
      !object(entry) ||
      entry.key !== `country-${country}` ||
      entry.format !== "csv-js-v1" ||
      !/^[a-f0-9]{64}$/.test(String(entry.sha256)) ||
      !/^[a-f0-9]{64}$/.test(String(entry.transportSha256)) ||
      entry.file !== `country-${country}.${String(entry.transportSha256).slice(0, 16)}.js` ||
      !Number.isSafeInteger(entry.bytes) ||
      Number(entry.bytes) < 1 ||
      Number(entry.bytes) > 64 * 1024 * 1024 ||
      !Number.isSafeInteger(entry.transportBytes) ||
      Number(entry.transportBytes) < 1 ||
      Number(entry.transportBytes) > 64 * 1024 * 1024 ||
      typeof entry.checkedAt !== "string" ||
      !Number.isFinite(Date.parse(entry.checkedAt))
    )
      throw Error("国家CSV索引无效");
    countries[country] = {
      ...entry,
      remote: { commit: pointer.commit, path: hosting.countryDirectory + "/" + entry.file },
    } as unknown as DataFile;
  }
  remembered = { commit: pointer.commit, manifest: { schemaVersion: 4, countries } };
  return remembered.manifest;
}
