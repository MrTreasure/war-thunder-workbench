/** Pixel watermark v1: repeated luminance QIM plus a lossless blue-channel display layer. */
export const WATERMARK_TEXT = "mrtreasure.cc";
const STEP = 64;
const STRIDE = 16;
const HEADER = "WT1:";
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function hamming(n: number) {
  const a = (n >>> 3) & 1,
    b = (n >>> 2) & 1,
    c = (n >>> 1) & 1,
    d = n & 1;
  return [a ^ b ^ d, a ^ c ^ d, a, b ^ c ^ d, b, c, d];
}
// A registered 32-bit source signature with Hamming redundancy; the channel layer carries the literal text.
const signature = crc32(new TextEncoder().encode(HEADER + WATERMARK_TEXT));
const frame = [
  signature >>> 24,
  (signature >>> 16) & 255,
  (signature >>> 8) & 255,
  signature & 255,
];
const bits = frame.flatMap((byte) => [...hamming(byte >>> 4), ...hamming(byte & 15)]);
const basisA = new Float64Array(64),
  basisB = new Float64Array(64);
for (let y = 0; y < 8; y++)
  for (let x = 0; x < 8; x++) {
    basisA[y * 8 + x] =
      0.25 * Math.cos(((2 * x + 1) * Math.PI) / 16) * Math.cos(((2 * y + 1) * 2 * Math.PI) / 16);
    basisB[y * 8 + x] =
      0.25 * Math.cos(((2 * x + 1) * 2 * Math.PI) / 16) * Math.cos(((2 * y + 1) * Math.PI) / 16);
  }
function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
}
/** Also callable by the offline producer; no browser or network required. */
export async function embedWatermarkPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  signal?: AbortSignal,
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 64 ||
    height < 64 ||
    data.length !== width * height * 4
  )
    throw new Error("图片尺寸不适合写入暗水印。");
  const columns = Math.floor(width / STRIDE),
    rows = Math.floor(height / STRIDE),
    luma = new Float64Array(64);
  let embedded = 0;
  for (let by = 0; by < rows; by++) {
    if (by % 24 === 0) {
      aborted(signal);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    for (let bx = 0; bx < columns; bx++) {
      const ox = bx * STRIDE + 4,
        oy = by * STRIDE + 4;
      let sum = 0,
        square = 0,
        a = 0,
        b = 0,
        opaque = true;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const i = ((oy + y) * width + ox + x) * 4,
            j = y * 8 + x;
          if (data[i + 3] < 250) opaque = false;
          const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          luma[j] = value;
          sum += value;
          square += value * value;
          a += value * basisA[j];
          b += value * basisB[j];
        }
      if (!opaque || square / 64 - (sum / 64) ** 2 < 64) continue;
      const index = by * columns + bx,
        bitIndex = ((Math.imul(index + 1, 0x45d9f3b) ^ (index >>> 16)) >>> 0) % bits.length;
      const difference = a - b;
      let quant = Math.round(difference / STEP);
      if ((quant & 1) !== bits[bitIndex])
        quant =
          Math.abs(difference - (quant - 1) * STEP) < Math.abs(difference - (quant + 1) * STEP)
            ? quant - 1
            : quant + 1;
      const delta = (quant * STEP - difference) / 2;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const i = ((oy + y) * width + ox + x) * 4,
            j = y * 8 + x,
            change = delta * (basisA[j] - basisB[j]);
          for (let channel = 0; channel < 3; channel++)
            data[i + channel] = Math.round(Math.max(0, Math.min(255, data[i + channel] + change)));
        }
      embedded++;
    }
  }
  aborted(signal);
  return { version: 1, text: WATERMARK_TEXT, embeddedBlocks: embedded };
}
export async function stampExportWatermark(canvas: HTMLCanvasElement, signal?: AbortSignal) {
  aborted(signal);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法写入图片暗水印。");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = await embedWatermarkPixels(image.data, canvas.width, canvas.height, signal);
  if (result.embeddedBlocks < 200)
    throw new Error("图片细节不足以写入可靠暗水印，请提高导出分辨率。");
  const mask = document.createElement("canvas"),
    scale = Math.min(1, 1024 / canvas.width);
  mask.width = Math.round(canvas.width * scale);
  mask.height = Math.round(canvas.height * scale);
  const m = mask.getContext("2d");
  if (!m) throw new Error("无法写入图片暗水印。");
  const size = Math.max(18, Math.round(mask.width / 27));
  m.fillStyle = "#fff";
  m.font = "700 " + size + "px sans-serif";
  m.translate(mask.width / 2, mask.height / 2);
  m.rotate(-Math.PI / 9);
  for (let y = -mask.height; y < mask.height; y += size * 5)
    for (let x = -mask.width; x < mask.width; x += size * 10) m.fillText(WATERMARK_TEXT, x, y);
  const alpha = m.getImageData(0, 0, mask.width, mask.height).data;
  for (let y = 0; y < canvas.height; y++) {
    if (y % 256 === 0) {
      aborted(signal);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const my = Math.min(mask.height - 1, Math.floor(y * scale));
    for (let x = 0; x < canvas.width; x++) {
      const mx = Math.min(mask.width - 1, Math.floor(x * scale)),
        i = (y * canvas.width + x) * 4;
      image.data[i + 2] =
        (image.data[i + 2] & 253) | (alpha[(my * mask.width + mx) * 4 + 3] >= 128 ? 2 : 0);
    }
  }
  aborted(signal);
  ctx.putImageData(image, 0, 0);
}
