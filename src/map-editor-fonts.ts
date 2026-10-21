export const mapFonts = [
  { id: "sans", name: "系统黑体", family: 'system-ui, "Microsoft YaHei", sans-serif' },
  { id: "serif", name: "宋体 / 衬线", family: '"Noto Serif CJK SC", "Songti SC", SimSun, serif' },
  { id: "kai", name: "楷体", family: 'KaiTi, STKaiti, "Kaiti SC", serif' },
  {
    id: "mono",
    name: "等宽",
    family: '"SFMono-Regular", Consolas, "Noto Sans Mono CJK SC", monospace',
  },
  { id: "condensed", name: "战术窄体", family: 'WTCondensed, "Microsoft YaHei", sans-serif' },
] as const;
export type MapFont = (typeof mapFonts)[number]["id"];
export const fontFamily = (font?: MapFont) =>
  mapFonts.find((entry) => entry.id === font)?.family || mapFonts[0].family;
export function canvasTextFont(
  text: { font?: MapFont; fontWeight?: 400 | 600 | 700; italic?: boolean },
  size: number,
) {
  return `${text.italic ? "italic " : ""}${text.fontWeight ?? 600} ${size}px ${fontFamily(text.font)}`;
}
