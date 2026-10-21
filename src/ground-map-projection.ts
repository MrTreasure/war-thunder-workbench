// Game world Z increases towards the top of the original map texture.
// Editor annotations already use image coordinates and must never be reflected.
export const CONTOUR_IMAGE_MATRIX = [1, 0, 0, -1, 0, 1000] as const;
export const CONTOUR_IMAGE_TRANSFORM = `matrix(${CONTOUR_IMAGE_MATRIX.join(" ")})`;

export function worldToMap(bounds: number[][], world: number[]) {
  const [[x0, z0], [x1, z1]] = bounds;
  return { x: (world[0] - x0) / (x1 - x0), y: (z1 - world[1]) / (z1 - z0) };
}

export function referenceGrid(
  bounds: number[][],
  reference: { origin_xz_m: number[]; step_xz_m: number[] },
) {
  const vertical: { position: number; label: string }[] = [];
  const horizontal: { position: number; label: string }[] = [];
  for (let i = 0; i < 100; i++) {
    const point = worldToMap(bounds, [
      reference.origin_xz_m[0] + i * reference.step_xz_m[0],
      reference.origin_xz_m[1] - i * reference.step_xz_m[1],
    ]);
    if (point.x >= 0 && point.x <= 1)
      vertical.push({ position: point.x * 1000, label: String(i + 1) });
    if (point.y >= 0 && point.y <= 1)
      horizontal.push({
        position: point.y * 1000,
        label:
          i < 26
            ? String.fromCharCode(65 + i)
            : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)),
      });
  }
  return { vertical, horizontal };
}
