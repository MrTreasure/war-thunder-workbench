export interface DataFile {
  key: string;
  format: "csv-js-v1";
  file: string;
  sha256: string;
  bytes: number;
  transportSha256: string;
  transportBytes: number;
  checkedAt: string;
  sources?: import("./models").CountryPayload["sources"];
  remote?: { commit: string; path: string };
}
export interface DownloadProgress {
  received: number;
  total: number;
}
export const downloadLabel = (progress: DownloadProgress) =>
  progress.total > 0
    ? `${(progress.received / 1024 / 1024).toFixed(2)} / ${(progress.total / 1024 / 1024).toFixed(2)} MB`
    : "正在载入国家载具资料";
