import type { DataFile } from "./data-loader";

export function canUseCountryWorker(moduleUrl: string, pageOrigin: string) {
  return new URL(moduleUrl).origin === pageOrigin;
}

/** Worker failures disable this decoder's worker once, then reuse verified CSV
 * parsing on the main thread. Invalid data still rejects without a retry. */
export function createCountryDecoder(
  createWorker: (() => Worker) | null,
  fallback: (csv: string, entry: DataFile) => unknown,
) {
  let worker: Worker | null = null,
    disabled = !createWorker,
    serial = 0;
  const waiting = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  function failWorker() {
    disabled = true;
    worker?.terminate();
    worker = null;
    for (const item of waiting.values()) item.reject(Error("CSV worker unavailable"));
    waiting.clear();
  }
  return async function decode(csv: string, entry: DataFile): Promise<unknown> {
    if (disabled) return fallback(csv, entry);
    if (!worker) {
      try {
        worker = createWorker!();
        worker.onmessage = (event) => {
          const item = waiting.get(event.data.id);
          if (!item) return;
          waiting.delete(event.data.id);
          if (event.data.error) item.reject(Error(event.data.error));
          else item.resolve(event.data.value);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          failWorker();
        };
      } catch {
        failWorker();
        return fallback(csv, entry);
      }
    }
    try {
      return await new Promise((resolve, reject) => {
        const id = ++serial;
        waiting.set(id, { resolve, reject });
        try {
          worker!.postMessage({ id, csv, entry });
        } catch {
          failWorker();
        }
      });
    } catch (error) {
      if (disabled) return fallback(csv, entry);
      throw error;
    }
  };
}
