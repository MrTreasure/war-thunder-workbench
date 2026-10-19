import { useState } from "react";
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
) {
  const [value, setValue] = useState(() => {
    const saved = readJson(key, fallback, valid);
    return transform ? transform(saved) : saved;
  });
  const [error, setError] = useState("");
  function save(next: T) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setError("");
    } catch {
      setError("浏览器无法保存，本次设置只在当前页面有效。");
    }
    setValue(next);
  }
  return [value, save, error] as const;
}
export { object, strings, integer } from "./validation.ts";
