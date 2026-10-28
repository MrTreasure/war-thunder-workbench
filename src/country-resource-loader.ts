import { t, localize } from "./i18n/core";
import { canUseCountryWorker, createCountryDecoder } from "./country-resource-decoder";
import { countryModules } from "./generated/country-modules";
import { readCatalogAsset, parseDataTransport } from "./remote-catalog";
import type { DataFile } from "./data-loader";
import { decodeCountryResource } from "./country-csv-decode";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
const decode = createCountryDecoder(
  // QMuse serves modules from a different origin and restricts workers. Avoid
  // constructing one there; the verified fallback still populates IndexedDB.
  typeof Worker !== "undefined" && canUseCountryWorker(import.meta.url, location.origin)
    ? () => new Worker(new URL("./country-csv-worker.ts", import.meta.url), { type: "module" })
    : null,
  decodeCountryResource,
);
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
