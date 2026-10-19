import type { CartItem, CartLine } from "./models";
import { integer, object } from "./validation.ts";
export const format = (value: number) => value.toLocaleString("zh-CN");
export const money = (cents: number) =>
  `¥ ${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function parseRate(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return integer(cents) && cents <= 100_000_000 ? cents : null;
}
export function quoteCents(lines: CartLine[]): number {
  return Number(
    (lines.reduce((sum, line) => sum + BigInt(line.rp) * BigInt(line.rateCents), 0n) + 5000n) /
      10000n,
  );
}
export function aggregate(items: CartItem[]) {
  const unique = new Map<string, CartLine>(),
    conflicts = new Set<string>();
  for (const item of items)
    for (const line of item.lines) {
      if (line.rp === 0) continue;
      const previous = unique.get(line.key);
      if (previous && previous.rateCents !== line.rateCents) conflicts.add(line.name);
      if (!previous || line.rp > previous.rp) unique.set(line.key, line);
    }
  const lines = [...unique.values()];
  return {
    lines,
    conflicts: [...conflicts],
    rp: lines.reduce((sum, line) => sum + line.rp, 0),
    cents: quoteCents(lines),
    duplicates:
      items.reduce((sum, item) => sum + item.lines.filter((line) => line.rp > 0).length, 0) -
      lines.length,
  };
}
export function validCart(value: unknown): value is CartItem[] {
  return (
    Array.isArray(value) &&
    value.length <= 500 &&
    value.every(
      (item) =>
        object(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.dataVersion === "string" &&
        typeof item.details === "string" &&
        typeof item.fingerprint === "string" &&
        ["vehicle", "modifications"].includes(String(item.kind)) &&
        Array.isArray(item.lines) &&
        item.lines.every(
          (line) =>
            object(line) &&
            ["key", "unitId", "name", "country", "category", "basis"].every(
              (k) => typeof line[k] === "string",
            ) &&
            ["vehicle", "modifications"].includes(String(line.kind)) &&
            integer(line.rp) &&
            integer(line.rateCents) &&
            integer(line.remainingBefore) &&
            line.rp <= 10_000_000 &&
            line.rateCents <= 100_000_000,
        ),
    )
  );
}
export function makeItem(value: Omit<CartItem, "id" | "fingerprint" | "createdAt">): CartItem {
  const fingerprint = JSON.stringify({
    kind: value.kind,
    lines: value.lines
      .map(({ key, rp, rateCents }) => ({ key, rp, rateCents }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
  return {
    ...value,
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
}
