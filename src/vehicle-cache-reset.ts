const marker = "wt-vehicle-cache-reset-v3";
const countries = [
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
];
let pending: Promise<boolean> | null = null;
const missing = (e: unknown) => e instanceof DOMException && e.name === "NotFoundError";
/** One release reset, restricted to obsolete public vehicle caches. Never user documents. */
export function resetLegacyVehicleCaches(): Promise<boolean> {
  if (pending) return pending;
  pending = (async () => {
    try {
      if (localStorage.getItem(marker) === "done") return true;
    } catch {
      /* Storage can be disabled. */
    }
    let complete = true;
    try {
      const remove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("wt-data-cache-v1:") ||
            /^wt-public-resources-v1:(?:vehicles-[a-z]+|research-catalog)$/.test(key))
        )
          remove.push(key);
      }
      for (const key of remove) localStorage.removeItem(key);
    } catch {
      /* Disabled localStorage has no readable legacy records. */
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem("wt-sale-read-cache-v3") || "[]");
      if (Array.isArray(saved))
        sessionStorage.setItem(
          "wt-sale-read-cache-v3",
          JSON.stringify(
            saved.filter(
              (row) =>
                !Array.isArray(row) ||
                typeof row[0] !== "string" ||
                !row[0].startsWith("sales/vehicles?"),
            ),
          ),
        );
    } catch {
      /* Ignore unavailable or invalid transient caches. */
    }
    if (navigator.storage?.getDirectory)
      try {
        const root = await navigator.storage.getDirectory();
        try {
          await root.removeEntry("war-thunder-data-v1", { recursive: true });
        } catch (e) {
          if (!missing(e)) complete = false;
        }
        try {
          const directory = await root.getDirectoryHandle("wt-public-resources-v1");
          await Promise.all(
            [...countries.map((c) => "vehicles-" + c), "research-catalog"].map(async (name) => {
              try {
                await directory.removeEntry(name + ".json");
              } catch (e) {
                if (!missing(e)) complete = false;
              }
            }),
          );
        } catch (e) {
          if (!missing(e)) complete = false;
        }
      } catch {
        complete = false;
      }
    if (typeof indexedDB !== "undefined")
      await Promise.all(
        ["wt-vehicle-catalog-v1", "wt-vehicle-catalog-v2"].map(
          (name) =>
            new Promise<void>((resolve) => {
              const timer = setTimeout(() => {
                complete = false;
                resolve();
              }, 500);
              try {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => {
                  clearTimeout(timer);
                  resolve();
                };
                request.onerror = request.onblocked = () => {
                  complete = false;
                  clearTimeout(timer);
                  resolve();
                };
              } catch {
                complete = false;
                clearTimeout(timer);
                resolve();
              }
            }),
        ),
      );
    if (complete)
      try {
        localStorage.setItem(marker, "done");
      } catch {
        /* Retry harmless deletions on the next page session. */
      }
    return complete;
  })();
  return pending;
}
