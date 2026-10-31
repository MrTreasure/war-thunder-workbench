import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useAccountWorkspace } from "./workspace-context";
import { readPricePreferences, savePricePreferences } from "./sale-price-api";
import { statsHeaders } from "./player-stats-api";
import { SalePreferenceDraft } from "./sale-preference-draft";
import type { PricePreferences } from "./sale-price-model";

const drafts = new Map<string, SalePreferenceDraft>();
const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};
export function useSalePricePreferences() {
  const workspace = useAccountWorkspace();
  const owner = workspace?.userId ? "user:" + workspace.userId : "";
  const canSave = !owner || !!(workspace?.ready && workspace.consented);
  const active = useRef({ owner, canSave });
  useLayoutEffect(() => {
    active.current = { owner, canSave };
  }, [owner, canSave]);
  let draft = drafts.get(owner);
  if (!draft) {
    draft = new SalePreferenceDraft(
      owner,
      storage,
      owner
        ? {
            read: () => readPricePreferences(),
            write: (document) => savePricePreferences(document, owner),
            captureIdentity: () => {
              const authorization = statsHeaders().Authorization;
              return () => statsHeaders().Authorization === authorization;
            },
          }
        : undefined,
    );
    drafts.set(owner, draft);
  }
  const currentDraft = draft;
  const snapshot = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  const flush = useCallback(() => {
    if (active.current.owner !== owner || !active.current.canSave) return Promise.resolve();
    return currentDraft.flush();
  }, [owner, currentDraft]);
  useEffect(() => {
    if (!canSave) return;
    void currentDraft.load();
    const cleared = () => {
      void currentDraft.load(true);
    };
    const leaving = () => {
      void flush();
    };
    window.addEventListener("wt-sale-preferences-cleared", cleared);
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("wt-sale-preferences-cleared", cleared);
      window.removeEventListener("pagehide", leaving);
      void flush();
    };
  }, [owner, canSave, currentDraft, flush]);
  return {
    items: snapshot.items,
    ready: snapshot.ready && canSave,
    error: snapshot.error,
    save: (items: PricePreferences) => {
      if (canSave) currentDraft.stage(items);
    },
    flush,
    reload: () => currentDraft.load(true),
    exportPending: currentDraft.exportPending,
    pendingKey: currentDraft.pendingKey,
  };
}
