import { t, localize } from "./i18n/core";
import { countryModules } from "./generated/country-modules";
import { readCatalogAsset, parseDataTransport } from "./remote-catalog";
import type { DataFile } from "./data-loader";
import { decodeCountryResource } from "./country-csv-decode";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
let worker: Worker | null = null,
  disabled = false,
  serial = 0;
const waiting = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
async function decode(csv: string, entry: DataFile): Promise<unknown> {
  if (typeof Worker === "undefined" || disabled) return decodeCountryResource(csv, entry);
  try {
    if (!worker) {
      worker = new Worker(new URL("./country-csv-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event) => {
        const item = waiting.get(event.data.id);
        if (!item) return;
        waiting.delete(event.data.id);
        if (event.data.error) item.reject(Error(event.data.error));
        else item.resolve(event.data.value);
      };
      worker.onerror = () => {
        disabled = true;
        worker?.terminate();
        worker = null;
        for (const item of waiting.values()) item.reject(Error("CSV worker unavailable"));
        waiting.clear();
      };
    }
    return await new Promise((resolve, reject) => {
      const id = ++serial;
      waiting.set(id, { resolve, reject });
      try {
        worker!.postMessage({ id, csv, entry });
      } catch (error) {
        waiting.delete(id);
        reject(error);
      }
    });
  } catch (error) {
    if (disabled) return decodeCountryResource(csv, entry);
    throw error;
  }
}
export async function loadCountryResource(entry: DataFile): Promise<unknown> {
  let csv: unknown;
  if (entry.remote) {
    const transport = await readCatalogAsset(entry.remote.path, entry.remote.commit);
    const bytes = new TextEncoder().encode(transport);
    if (
      bytes.length !== entry.transportBytes ||
      bytesToHex(sha256(bytes)) !== entry.transportSha256
    )
      throw Error(t("国家JS资源校验失败"));
    csv = parseDataTransport(transport);
  } else {
    const load = countryModules[entry.key];
    if (!load) throw Error(t("国家资料模块不存在"));
    csv = (await load()).default;
  }
  if (typeof csv !== "string") throw Error(t("国家CSV封装无效"));
  try {
    return await decode(csv, entry);
  } catch (error) {
    throw error instanceof Error ? Error(localize(error.message)) : error;
  }
}
