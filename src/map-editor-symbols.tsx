import { useLocale } from "./i18n/react";
import { localize } from "./i18n/core";
import catalog from "../data/map-editor-symbols.json";
export const tacticalSymbols = catalog.symbols;
const symbols = new Map(tacticalSymbols.map((s) => [s.id, s]));
export const tacticalSymbolIds = new Set(symbols.keys());
export const tacticalSymbol = (id: string) => symbols.get(id);
export function TacticalSymbol({
  id,
  x = 0,
  y = 0,
  size = 32,
  color = "currentColor",
}: {
  id: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}) {
  useLocale();

  const symbol = symbols.get(id);
  if (!symbol) return null;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size / 32})`}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {localize(
        symbol.paths.map((p, i) => <path key={`p${i}`} d={p.d} fill={p.filled ? color : "none"} />),
      )}
      {localize(
        symbol.circles.map((c, i) => (
          <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.filled ? color : "none"} />
        )),
      )}
    </g>
  );
}
/** Same trusted geometry as the SVG preview; project files can select IDs only. */
export function drawTacticalSymbol(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  size: number,
  color: string,
): boolean {
  const symbol = symbols.get(id);
  if (!symbol) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of symbol.paths) {
    const path = new Path2D(p.d);
    if (p.filled) ctx.fill(path);
    ctx.stroke(path);
  }
  for (const c of symbol.circles) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    if (c.filled) ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
