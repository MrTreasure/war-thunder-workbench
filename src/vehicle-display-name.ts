/** Preserve official variant markers; WTSymbols renders their game-specific glyphs. */
export function vehicleDisplayName(raw: string): string {
  return raw.replace(/[\u200B\uFEFF]/g, "").trim();
}
