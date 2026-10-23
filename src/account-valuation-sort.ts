/** Sort copies only: the same cached valuation may be open in several views. */
export function sortValuationPrices<T extends { amountCents: number | null }>(items: readonly T[]): T[] {
  const amount = (value: number | null): bigint | null =>
    value != null && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  return [...items].sort((a, b) => {
    const left = amount(a.amountCents), right = amount(b.amountCents);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return left === right ? 0 : left > right ? -1 : 1;
  });
}
