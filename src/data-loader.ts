import { countryModules } from "./generated/country-modules";
export interface DataFile {
  key: string;
  file: string;
  sha256: string;
  bytes: number;
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
  const load = countryModules[entry.key];
  if (!load) throw Error("没有找到该国资料模块，请刷新应用。");
  progress?.({ received: 0, total: 0 });
  // Native dynamic import resolves against the deployed JS chunk URL, rather
  // than the surrounding QMuse page path. No module is requested before selection.
  const module = await load();
  signal?.throwIfAborted();
  const text = module.default;
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength !== entry.bytes)
    throw Error("资料模块不完整，请刷新后重试。");
  return text;
}
export const downloadLabel = (progress: DownloadProgress) =>
  progress.total > 0
    ? `${(progress.received / 1024 / 1024).toFixed(2)} / ${(progress.total / 1024 / 1024).toFixed(2)} MB`
    : "正在载入国家资料模块";
