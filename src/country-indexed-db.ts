import type { DataFile } from "./data-loader";
import type { CountryPayload } from "./models";
import { resetLegacyVehicleCaches } from "./vehicle-cache-reset";
export type CountryRecord = { country: string; entry: DataFile; value: CountryPayload };
/** A country's decoded data and its version are one atomic IndexedDB record. */
export class CountryIndexedDB {
  private database: Promise<IDBDatabase | null> | null = null;
  constructor(private name = "wt-vehicle-catalog-v3") {}
  private open(): Promise<IDBDatabase | null> {
    if (this.database) return this.database;
    this.database = (async () => {
      await resetLegacyVehicleCaches();
      return new Promise<IDBDatabase | null>((resolve) => {
        if (typeof indexedDB === "undefined") {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (db: IDBDatabase | null) => {
          if (settled) {
            db?.close();
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(db);
        };
        const timer = setTimeout(() => finish(null), 800);
        let request: IDBOpenDBRequest;
        try {
          request = indexedDB.open(this.name, 1);
        } catch {
          finish(null);
          return;
        }
        request.onupgradeneeded = () =>
          request.result.createObjectStore("countries", { keyPath: "country" });
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.database = null;
          };
          finish(db);
        };
      });
    })();
    return this.database;
  }
  async read(country: string): Promise<CountryRecord | null> {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction("countries", "readonly");
      } catch {
        resolve(null);
        return;
      }
      let result: CountryRecord | null = null;
      const request = tx.objectStore("countries").get(country);
      request.onsuccess = () => {
        const row = request.result as CountryRecord | undefined;
        if (
          row?.country === country &&
          row.entry?.format === "csv-js-v1" &&
          row.value?.country === country
        )
          result = row;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => resolve(null);
    });
  }
  async commit(country: string, entry: DataFile, value: CountryPayload): Promise<boolean> {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction("countries", "readwrite");
        tx.objectStore("countries").put({ country, entry, value } satisfies CountryRecord);
      } catch {
        resolve(false);
        return;
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    });
  }
}
