import { useCallback, useEffect, useState } from "react";
import { validLineups } from "./lineups";
import { useAccountWorkspace } from "./workspace-context";

/** Counts use the same account/local boundary as useStored, without loading vehicle data. */
export function useLineupCounts(countries: Record<string, string>, maxSlots: number) {
  const workspace = useAccountWorkspace();
  const readLocal = useCallback(() => {
    return Object.fromEntries(
      Object.keys(countries).map((country) => {
        try {
          const raw = localStorage.getItem(`wt-lineups-v1:${country}`);
          const value: unknown = raw === null ? [] : JSON.parse(raw);
          return [country, validLineups(value, maxSlots) ? value.length : null];
        } catch {
          return [country, null];
        }
      }),
    );
  }, [countries, maxSlots]);
  const [local, setLocal] = useState<Record<string, number | null>>(readLocal);
  useEffect(() => {
    const refresh = () => setLocal(readLocal());
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("wt-lineups-v1:")) refresh();
    };
    refresh();
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
    };
  }, [readLocal]);
  const reportCount = useCallback((country: string, count: number) => {
    setLocal((previous) =>
      previous[country] === count ? previous : { ...previous, [country]: count },
    );
  }, []);
  const counts = workspace?.userId
    ? Object.fromEntries(
        Object.keys(countries).map((country) => {
          const value = workspace.documents[`wt-lineups-v1:${country}`]?.value;
          return [
            country,
            !workspace.ready
              ? null
              : value === undefined
                ? 0
                : validLineups(value, maxSlots)
                  ? value.length
                  : null,
          ];
        }),
      )
    : local;
  return { counts, reportCount };
}
