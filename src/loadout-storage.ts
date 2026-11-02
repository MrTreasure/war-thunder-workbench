import { useEffect, useState, useRef } from "react";
import { useStored } from "./storage";
import { useAccountWorkspace } from "./workspace-context";
import { isolatedLoadoutPreview, loadoutRequest } from "./loadout-api";
import { loadoutKey, validLoadoutPlans, type LoadoutPlan } from "./loadouts";

type Document = { value: LoadoutPlan[]; revision: number; ownerKey: string };
function readDocument(value: unknown): Document {
  if (!value || typeof value !== "object") throw Error("云端方案格式不正确，未覆盖本地草稿。");
  const doc = value as Document;
  const plans = doc.value === null ? [] : doc.value;
  if (
    !validLoadoutPlans(plans) ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0 ||
    typeof doc.ownerKey !== "string" ||
    !doc.ownerKey
  )
    throw Error("云端方案版本或内容不正确，未覆盖本地草稿。");
  return { ...doc, value: plans };
}
/** Preview only isolates this new document kind; the released workspace and
 * account database remain untouched. Production uses the existing controller. */
export function useLoadoutPlans(owner: string) {
  const workspace = useAccountWorkspace();
  const localKey =
    isolatedLoadoutPreview && owner !== "guest"
      ? `wt-loadouts-preview-cache-v1:${owner}`
      : loadoutKey;
  const [normal, saveNormal, normalError] = useStored(
    localKey,
    [] as LoadoutPlan[],
    validLoadoutPlans,
    undefined,
    true,
  );
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const lifetime = useRef(true);
  const remote = isolatedLoadoutPreview && owner !== "guest";
  useEffect(() => {
    lifetime.current = true;
    if (!remote) return;
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
        (cause: unknown) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : "预览方案恢复失败。");
        },
      );
    return () => {
      lifetime.current = false;
      controller.abort();
    };
  }, [owner, remote, workspace?.consented]);
  const save = (plans: LoadoutPlan[]) => {
    if (!validLoadoutPlans(plans)) {
      setError("方案内容不完整，或已达到 100 套保存上限；草稿保留。");
      return false;
    }
    if (!remote) return saveNormal(plans);
    if (!workspace?.consented) {
      workspace?.open();
      setError("请先在账号工作区同意数据保存说明。");
      return false;
    }
    if (!document) {
      setError("预览云端方案尚未恢复，请重试读取后保存。");
      return false;
    }
    if (sending) {
      setError("上一笔保存尚未完成，请稍后再试；草稿已保留。");
      return false;
    }
    setSending(true);
    setError("");
    const controller = new AbortController();
    void loadoutRequest<unknown>(
      "workspace",
      { key: loadoutKey, ownerKey: document.ownerKey, value: plans, revision: document.revision },
      controller.signal,
    )
      .then((result) => readDocument({ ...(result as Document), ownerKey: document.ownerKey }))
      .then(
        (doc) => {
          if (lifetime.current) {
            setDocument({ ...doc, ownerKey: document.ownerKey });
            setError("");
          }
        },
        (cause: unknown) => {
          if (lifetime.current)
            setError(cause instanceof Error ? cause.message : "云端保存失败，草稿已保留。");
        },
      )
      .finally(() => {
        if (lifetime.current) setSending(false);
      });
    return true;
  };
  const reload = async () => {
    if (!remote) {
      await workspace?.reload();
      return;
    }
    try {
      const doc = readDocument(await loadoutRequest<unknown>("workspace"));
      if (lifetime.current) {
        setDocument(doc);
        setError("");
      }
    } catch (cause) {
      if (lifetime.current) setError(cause instanceof Error ? cause.message : "读取失败。");
    }
  };
  return [
    remote ? document?.value || [] : normal,
    save,
    error || normalError,
    { sending, remote, reload },
  ] as const;
}
