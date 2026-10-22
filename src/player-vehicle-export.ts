import { vehicleDisplayName } from "./vehicle-display-name";
import fontUrl from "./assets/RobotoCondensed-Bold.ttf?url";
import catalog from "../data/catalog-settings.json";
import layout from "../data/player-vehicle-card.json";
import { reportImage } from "./player-stats-api";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { drawVehicleShareCard, vehicleCardSize } from "./player-vehicle-card-design";
import type { CardImage } from "./player-vehicle-card-design";
import { stampExportWatermark } from "./export-watermark";
import { defaultVehicleCardEra, vehicleCardBackgroundUrls } from "./player-vehicle-background";
import type { VehicleCardEra } from "./player-vehicle-background";

let fontReady: Promise<void> | undefined;
async function loadFont() {
  fontReady ||= (async () => {
    const font = new FontFace("WTCard", `url("${fontUrl}")`, { weight: "700" });
    document.fonts.add(await font.load());
  })().catch((error) => {
    fontReady = undefined;
    throw error;
  });
  await fontReady;
}
async function readImage(
  url: string,
  signal: AbortSignal,
  expected?: { bytes: number; sha256: string },
) {
  const response = await fetch(url, {
    credentials: "omit",
    cache: "force-cache",
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok) throw new Error("卡片素材暂时无法读取，请重试保存。");
  const bytes = await response.arrayBuffer();
  if (expected) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    if (bytes.byteLength !== expected.bytes || hash !== expected.sha256)
      throw new Error("卡片背景校验失败，请刷新页面后重试。");
  }
  const objectUrl = URL.createObjectURL(
    new Blob([bytes], {
      type: response.headers.get("Content-Type")?.split(";")[0] || "image/png",
    }),
  );
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    signal.throwIfAborted();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
const asset = (image: HTMLImageElement): CardImage => ({
  source: image,
  width: image.naturalWidth,
  height: image.naturalHeight,
});
function vehicleAsset(image: HTMLImageElement): CardImage {
  // Trim only transparent source padding, preserving the official vehicle pixels.
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("浏览器无法读取载具图片。");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width,
    top = canvas.height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left || bottom < top) throw new Error("官方载具图片为空，请稍后重试。");
  return {
    ...asset(image),
    crop: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 },
  };
}
function lightLogo(image: HTMLImageElement): CardImage {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * 3;
  canvas.height = image.naturalHeight * 3;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法创建标志图层。");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#f0e5cf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { source: canvas, width: canvas.width, height: canvas.height };
}
export async function createVehicleCard(
  profile: PlayerProfile,
  vehicle: PlayerVehicle,
  signal: AbortSignal,
  era: VehicleCardEra = defaultVehicleCardEra(vehicle),
) {
  const [background, unit, logo, silver, flag] = await Promise.all([
    readImage(vehicleCardBackgroundUrls[era], signal, layout.backgrounds[era]),
    reportImage("vehicle", vehicle.id, signal),
    reportImage("logo", "wt", signal),
    reportImage("currency", "sl", signal),
    vehicle.country && vehicle.country in catalog.countries
      ? reportImage("flag", vehicle.country, signal)
      : Promise.resolve(null),
    loadFont(),
  ]);
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  canvas.width = vehicleCardSize.width;
  canvas.height = vehicleCardSize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法生成载具卡片，请更换浏览器后重试。");
  drawVehicleShareCard(ctx, profile, vehicle, {
    background: asset(background),
    vehicle: vehicleAsset(unit),
    logo: lightLogo(logo),
    silver: asset(silver),
    flag: flag ? asset(flag) : null,
  });
  await stampExportWatermark(canvas, signal);
  signal.throwIfAborted();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("图片编码失败，请重试。"))),
      "image/png",
    ),
  );
  signal.throwIfAborted();
  return blob;
}

export function copyVehicleCard(blob: Blob | Promise<Blob>) {
  if (
    !window.isSecureContext ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === "undefined"
  )
    return Promise.reject(new Error("当前浏览器不支持复制图片，请下载 PNG。"));
  try {
    // A promised Blob keeps the initiating click's activation in supported browsers.
    return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch (error) {
    return Promise.reject(error);
  }
}
export function downloadVehicleCard(blob: Blob, profile: PlayerProfile, vehicle: PlayerVehicle) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = Array.from(
    `${profile.nickname}-${vehicleDisplayName(vehicle.name)}-${vehicle.mode.toUpperCase()}.png`,
    (character) => (character.codePointAt(0)! < 32 ? "_" : character),
  )
    .join("")
    .replace(/[<>:"/\\|?*]/g, "_");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
