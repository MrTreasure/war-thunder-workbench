import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface AtlasImage {
  id: string;
  name: string;
  kind: string;
  file: string;
  image: string;
  thumb: string;
  size: number;
  sha256: string;
}
const directoryName = "wt-map-atlas-v1";
let generation = 0;
const writes = new Set<Promise<void>>();
async function directory() {
  try {
    if (!isSecureContext || !navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    const maps = await root.getDirectoryHandle(directoryName, { create: true });
    return maps.getDirectoryHandle("images", { create: true });
  } catch {
    return null;
  }
}
export async function loadMapImage(
  image: AtlasImage,
  signal: AbortSignal,
  progress: (received: number) => void,
): Promise<Blob> {
  const version = generation;
  const dir = await directory();
  signal.throwIfAborted();
  const filename = `${image.id}.${image.sha256.slice(0, 16)}.png`;
  try {
    if (dir) {
      const file = await (await dir.getFileHandle(filename)).getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      signal.throwIfAborted();
      if (bytes.length === image.size && bytesToHex(sha256(bytes)) === image.sha256) {
        progress(image.size);
        return file;
      }
      await dir.removeEntry(filename);
    }
  } catch {
    signal.throwIfAborted();
  }
  const response = await fetch(image.image, { signal });
  if (!response.ok || !response.body) throw Error("高清图暂时无法读取");
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  const digest = sha256.create();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > image.size) throw Error("图片大小与目录不符，请打开原图核对");
      digest.update(value);
      chunks.push(new Uint8Array(value).buffer);
      progress(received);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  signal.throwIfAborted();
  if (received !== image.size || bytesToHex(digest.digest()) !== image.sha256)
    throw Error("图片校验未通过，请打开原图核对");
  const blob = new Blob(chunks, { type: "image/png" });
  if (dir && version === generation) {
    const write = (async () => {
      let writable: FileSystemWritableFileStream | null = null;
      try {
        writable = await (await dir.getFileHandle(filename, { create: true })).createWritable();
        await writable.write(blob);
        await writable.close();
      } catch {
        await writable?.abort().catch(() => {});
      }
    })();
    writes.add(write);
    await write.finally(() => writes.delete(write));
  }
  return blob;
}
export async function clearMapImages() {
  generation++;
  await Promise.allSettled([...writes]);
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(directoryName, { recursive: true }).catch((error) => {
    if (error.name !== "NotFoundError") throw error;
  });
}
