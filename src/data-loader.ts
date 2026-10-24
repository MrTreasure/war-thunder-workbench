import { t } from "./i18n/core";
import { countryModules } from "./generated/country-modules";
import { parseDataTransport, readCatalogAsset } from "./remote-catalog";
export interface DataFile {
  key: string;
  file: string;
  sha256: string;
  bytes: number;
  remote?: { commit: string; path: string };
}
export interface DownloadProgress {
  received: number;
  total: number;
}
export async function downloadText(
  entry: DataFile,
  signal?: AbortSignal,
  progress?: (value: DownloadProgress) => void,
): Promise<string> {
  signal?.throwIfAborted();
  if (entry.remote) {
    progress?.({ received: 0, total: 0 });
    const text = parseDataTransport(
      await readCatalogAsset(entry.remote.path, entry.remote.commit, signal),
    );
    if (typeof text !== "string" || new TextEncoder().encode(text).byteLength !== entry.bytes)
      throw Error(t("国家资料资源不完整，已保留上次数据。"));
    return text;
  }
  const load = countryModules[entry.key];
  if (!load) throw Error(t("没有找到该国资料模块，请刷新应用。"));
  progress?.({ received: 0, total: 0 });
  // Native dynamic import resolves against the deployed JS chunk URL, rather
  // than the surrounding QMuse page path. No module is requested before selection.
  const module = await load();
  signal?.throwIfAborted();
  const text = module.default;
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength !== entry.bytes)
    throw Error(t("资料模块不完整，请刷新后重试。"));
  return text;
}
export const downloadLabel = (progress: DownloadProgress) =>
  progress.total > 0
    ? `${(progress.received / 1024 / 1024).toFixed(2)} / ${(progress.total / 1024 / 1024).toFixed(2)} MB`
    : t("正在载入国家资料模块");
