import { WorkspaceContext, workspaceKey } from "./workspace-context";
import { useContext, useState } from "react";
export function readJson<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
export function useStored<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
  transform?: (value: T) => T,
  strictLocal = false,
) {
  const cloud = useContext(WorkspaceContext);
  const remote = !!cloud?.userId && workspaceKey(key);
  const source = remote ? cloud.documents[key]?.value : undefined;
  const baseValue = valid(source) ? source : fallback;
  const remoteValue = baseValue;
  const [value, setValue] = useState(() => {
    const saved = readJson(key, fallback, valid);
    return transform ? transform(saved) : saved;
  });
  const [error, setError] = useState("");
  function save(next: T) {
    try {
      if (remote) {
        cloud!.save(key, next);
        setError("");
        return true;
      }
      localStorage.setItem(key, JSON.stringify(next));
      setError("");
    } catch (reason) {
      setError(
        remote && reason instanceof Error
          ? reason.message
          : strictLocal
            ? "浏览器保存失败，请导出备份后重试。"
            : "浏览器无法保存，本次设置只在当前页面有效。",
      );
      if (remote || strictLocal) return false;
    }
    setValue(next);
    return true;
  }
  return [remote ? remoteValue : value, save, error || (remote ? cloud.error : "")] as const;
}
export { object, strings, integer } from "./validation.ts";
