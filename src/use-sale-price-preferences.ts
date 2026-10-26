import { useCallback, useEffect, useRef, useState } from "react";
import { useAccountWorkspace } from "./workspace-context";
import { readPricePreferences, savePricePreferences } from "./sale-price-api";
import type { PricePreferenceDocument } from "./sale-price-api";
import type { PricePreferences } from "./sale-price-model";

const guestKey = "wt-sale-cart-preferences-v1:guest";
function readLocal(key: string): PricePreferences {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
function validItems(value: PricePreferences): PricePreferences {
  const result: PricePreferences = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [id, row] of Object.entries(value).slice(0, 60)) {
    if (!/^[a-z0-9_-]{1,100}$/i.test(id) || !row || typeof row.selected !== "boolean") continue;
    result[id] = { selected: row.selected };
  }
  return result;
}
export function useSalePricePreferences() {
  const workspace = useAccountWorkspace();
  const owner = workspace?.userId ? "user:" + workspace.userId : "";
  const [document, setDocument] = useState<PricePreferenceDocument>({ revision: 0, items: {} });
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const state = useRef(document),
    identity = useRef(owner),
    busy = useRef(false),
    generation = useRef(0);
  const pendingKey = "wt-sale-cart-preferences-v1:" + owner + ":pending";
  const canSave = !owner || !!(workspace?.ready && workspace.consented);
  const load = useCallback(
    async (discard = false) => {
      const epoch = ++generation.current;
      identity.current = owner;
      setReady(false);
      setError("");
      try {
        let next: PricePreferenceDocument = { revision: 0, items: validItems(readLocal(guestKey)) };
        if (owner) {
          next = await readPricePreferences();
          if (epoch !== generation.current) return;
          if (discard) localStorage.removeItem(pendingKey);
          const raw = localStorage.getItem(pendingKey);
          if (raw) {
            const pending = JSON.parse(raw) as PricePreferenceDocument;
            if (pending.revision !== next.revision)
              throw Error("另一设备已修改购车计划。请先导出本机待同步记录，再重新读取云端。");
            next = await savePricePreferences(
              { revision: next.revision, items: validItems(pending.items) },
              owner,
            );
            if (epoch === generation.current) localStorage.removeItem(pendingKey);
          }
        }
        if (epoch !== generation.current) return;
        state.current = next;
        setDocument(next);
        setLoadedOwner(owner);
        setReady(true);
      } catch (reason) {
        if (epoch === generation.current)
          setError(reason instanceof Error ? reason.message : "购车计划读取失败");
      }
    },
    [owner, pendingKey],
  );
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    const cleared = () => {
      void load(true);
    };
    window.addEventListener("wt-sale-preferences-cleared", cleared);
    return () => {
      window.removeEventListener("wt-sale-preferences-cleared", cleared);
      clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const save = (items: PricePreferences) => {
    if (!ready || loadedOwner !== owner || !canSave || busy.current) return;
    const next = { ...state.current, items: validItems(items) },
      epoch = generation.current;
    try {
      localStorage.setItem(
        owner ? pendingKey : guestKey,
        JSON.stringify(owner ? next : next.items),
      );
    } catch {
      setError("浏览器无法保存同步待办，本次修改未提交。请先导出清单。");
      return;
    }
    state.current = next;
    setDocument(next);
    if (!owner) return;
    busy.current = true;
    setSaving(true);
    setError("");
    void savePricePreferences(next, owner)
      .then((saved) => {
        if (epoch !== generation.current || identity.current !== owner) return;
        localStorage.removeItem(pendingKey);
        state.current = saved;
        setDocument(saved);
      })
      .catch((reason) => {
        if (epoch === generation.current)
          setError(reason instanceof Error ? reason.message : "同步失败，已保留本账号待办");
      })
      .finally(() => {
        busy.current = false;
        setSaving(false);
      });
  };
  return {
    items: loadedOwner === owner ? document.items : {},
    ready: ready && loadedOwner === owner && canSave && !saving,
    error,
    save,
    reload: () => load(true),
    exportPending: () => localStorage.getItem(pendingKey),
    pendingKey,
  };
}
