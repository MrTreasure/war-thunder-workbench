import { useEffect, useState, useRef } from "react";
import { useAccountWorkspace } from "./workspace-context";
import { loadoutRequest } from "./loadout-api";
import { loadoutKey, validLoadoutPlans, type LoadoutPlan } from "./loadouts";
type Document = { value: LoadoutPlan[]; revision: number; ownerKey: string };
function readDocument(value: unknown): Document {
  if (!value || typeof value !== "object") throw Error("云端方案格式不正确，未覆盖当前草稿。");
  const doc = value as Document;
  const plans = doc.value === null ? [] : doc.value;
  if (
    !validLoadoutPlans(plans) ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0 ||
    !doc.ownerKey
  )
    throw Error("云端方案版本或内容不正确，未覆盖当前草稿。");
  return { ...doc, value: plans };
}
/** Saved plans always use the existing remote workspace document. Local storage
 * retains an owner-scoped unfinished draft only. Preview uses its isolated DB. */
export function useLoadoutPlans(owner: string) {
  const workspace = useAccountWorkspace();
  const [document, setDocument] = useState<Document | null>(null),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false),
    [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const flight = useRef(false);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void loadoutRequest<unknown>("workspace", undefined, controller.signal)
      .then(readDocument)
      .then(
        (doc) => {
          if (!controller.signal.aborted) {
            setDocument(doc);
            setError("");
          }
        },
        (e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "挂载方案读取失败。");
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [owner, workspace?.consented]);
  const save = async (plans: LoadoutPlan[]) => {
    if (!validLoadoutPlans(plans)) {
      setError("方案不完整或已达到100套保存上限，草稿保留。");
      return false;
    }
    if (!workspace?.consented) {
      workspace?.open();
      setError("请先同意账号数据保存说明。");
      return false;
    }
    if (!document || flight.current) {
      setError("云端方案尚未恢复或正在保存，请稍后重试。");
      return false;
    }
    flight.current = true;
    setSending(true);
    setError("");
    try {
      const raw = await loadoutRequest<Document>("workspace", {
        key: loadoutKey,
        ownerKey: document.ownerKey,
        value: plans,
        revision: document.revision,
      });
      const doc = readDocument({ ...raw, ownerKey: document.ownerKey });
      if (!alive.current) return false;
      setDocument(doc);
      void workspace.reload().catch(() => undefined);
      return true;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "保存失败，草稿保留。");
      return false;
    } finally {
      flight.current = false;
      if (alive.current) setSending(false);
    }
  };
  const reload = async () => {
    setLoading(true);
    try {
      const doc = readDocument(await loadoutRequest("workspace"));
      if (alive.current) {
        setDocument(doc);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "读取失败。");
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  return [document?.value || [], save, error, { sending, remote: true, reload, loading }] as const;
}
