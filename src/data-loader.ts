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
  const response = await fetch(`${import.meta.env.BASE_URL}${entry.file}`, { signal });
  if (!response.ok) throw Error(`数据读取失败 (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength !== entry.bytes)
      throw Error("数据下载不完整，请重试");
    return text;
  }
  const decoder = new TextDecoder();
  let received = 0;
  const pieces: string[] = [];
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    received += result.value.byteLength;
    pieces.push(decoder.decode(result.value, { stream: true }));
    progress?.({ received, total: entry.bytes });
  }
  pieces.push(decoder.decode());
  if (received !== entry.bytes) throw Error("数据下载不完整，请重试");
  return pieces.join("");
}
export const downloadLabel = (progress: DownloadProgress) =>
  progress.total > 0
    ? `${(progress.received / 1024 / 1024).toFixed(2)} / ${(progress.total / 1024 / 1024).toFixed(2)} MB`
    : "准备读取数据";
