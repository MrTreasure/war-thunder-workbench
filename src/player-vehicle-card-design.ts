import { vehicleDisplayName } from "./vehicle-display-name";
import layout from "../data/player-vehicle-card.json";
import catalog from "../data/catalog-settings.json";
import { compactSilver } from "./player-number-format";
import type { PlayerProfile, PlayerVehicle, Ratio } from "./player-stats-api";

export type CardImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  crop?: { x: number; y: number; width: number; height: number };
};
export type VehicleCardAssets = {
  background: CardImage;
  vehicle: CardImage;
  logo: CardImage;
  silver: CardImage;
  flag: CardImage | null;
};
export const vehicleCardSize = { width: layout.width, height: layout.height };
const number = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("zh-CN");
const ratio = (value: Ratio) =>
  value === "∞" ? value : value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);

/** One deterministic layout for the browser export and offline rendering checks. */
export function drawVehicleShareCard(
  ctx: CanvasRenderingContext2D,
  profile: Pick<PlayerProfile, "nickname" | "fetchedAt">,
  vehicle: PlayerVehicle,
  assets: VehicleCardAssets,
) {
  const cream = "#f0e5cf",
    muted = "#cdbda8",
    gold = "#ebc571";
  const fit = (image: CardImage, x: number, y: number, width: number, height: number) => {
    const crop = image.crop || { x: 0, y: 0, width: image.width, height: image.height };
    const scale = Math.min(width / crop.width, height / crop.height);
    ctx.drawImage(
      image.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      x + (width - crop.width * scale) / 2,
      y + (height - crop.height * scale) / 2,
      crop.width * scale,
      crop.height * scale,
    );
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = cream,
    width = 936,
    align: CanvasTextAlign = "left",
  ) => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.shadowColor = "#250704";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.font = `700 ${size}px WTCard, "Arial Narrow", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;
    const measured = ctx.measureText(value).width;
    if (measured > width) {
      ctx.translate(x, y);
      ctx.scale(width / measured, 1);
      ctx.fillText(value, 0, 0);
    } else ctx.fillText(value, x, y);
    ctx.restore();
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#cab68b80";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.drawImage(assets.background.source, 0, 0, layout.width, layout.height);
  // Readability scrim for bright loading-screen skies; the artwork remains the GPT asset.
  const headerShade = ctx.createLinearGradient(0, 0, 0, 530);
  headerShade.addColorStop(0, "#11181ddd");
  headerShade.addColorStop(0.65, "#11181d70");
  headerShade.addColorStop(1, "#11181d00");
  ctx.fillStyle = headerShade;
  ctx.fillRect(0, 0, layout.width, 530);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  text(profile.nickname, 76, 105, 50, cream, 928);
  const modes: Record<string, string> = { ab: "街机", rb: "历史", sb: "全真" };
  const categories: Record<string, string> = {
    ground: "陆战",
    aviation: "空战",
    helicopters: "直升机",
    ships: "远洋海战",
    boats: "近岸海战",
  };
  text(
    `${categories[vehicle.category || ""] || "载具"}${modes[vehicle.mode] || ""} · ${vehicle.mode.toUpperCase()}`,
    76,
    163,
    34,
    cream,
    810,
  );
  line(76, 195, 1004, 195);

  // Long localized names occupy up to two lines without truncating their identity.
  const title = vehicleDisplayName(vehicle.name);
  ctx.font =
    '700 128px WTCard, "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
  const wideTitle = ctx.measureText(title).width > 1580;
  if (wideTitle) {
    const chars = Array.from(title);
    let split = Math.ceil(chars.length / 2);
    const breakAt = title.lastIndexOf(" ", split);
    if (breakAt > chars.length / 3) split = breakAt;
    text(chars.slice(0, split).join("").trim(), 74, 283, 70, cream, 930);
    text(chars.slice(split).join("").trim(), 74, 365, 70, cream, 930);
  } else text(title, 74, 353, 128, cream, 930);
  if (assets.flag) fit(assets.flag, 78, 389, 64, 42);
  const country =
    catalog.countries[vehicle.country as keyof typeof catalog.countries] || "国家待匹配";
  text(
    `${country}${vehicle.rank ? ` · ${vehicle.rank} 级` : ""}`,
    assets.flag ? 162 : 78,
    423,
    29,
    muted,
    830,
  );

  fit(assets.vehicle, 56, 446, 968, 420);

  // Keep the statistics separate from the scene; all labels and numbers are live data.
  const columns = [215, 540, 865];
  const primary = [
    ["综合 K/D", ratio(vehicle.kd)],
    ["效率评分", number(vehicle.efficiency)],
    [
      "胜率",
      vehicle.winRate == null || !Number.isFinite(vehicle.winRate)
        ? "—"
        : `${vehicle.winRate.toFixed(2)}%`,
    ],
  ];
  primary.forEach(([label, value], i) => {
    text(label, columns[i], 928, 31, muted, 280, "center");
    text(value, columns[i], 1020, 100, i === 1 ? gold : cream, 278, "center");
  });
  line(378, 910, 378, 1035);
  line(702, 910, 702, 1035);
  line(76, 1070, 1004, 1070);
  const naval = vehicle.category === "ships" || vehicle.category === "boats";
  const secondary = [
    ["战斗场次", number(vehicle.battles)],
    [naval ? "对海 K/D" : "对地 K/D", ratio(naval ? vehicle.navalKd : vehicle.groundKd)],
    ["对空 K/D", ratio(vehicle.airKd)],
  ];
  secondary.forEach(([label, value], i) => {
    text(label, columns[i], 1124, 29, muted, 280, "center");
    text(value, columns[i], 1201, 74, cream, 278, "center");
  });
  line(378, 1101, 378, 1213);
  line(702, 1101, 702, 1213);
  line(76, 1236, 1004, 1236);

  fit(assets.silver, 82, 1272, 72, 72);
  text("累计获得银狮", 174, 1324, 30, muted, 282);
  line(492, 1268, 492, 1347);
  text(compactSilver(vehicle.silverLions), 986, 1333, 87, cream, 460, "right");
  line(76, 1370, 1004, 1370);
  fit(assets.logo, 360, 1396, 360, 169);
  const date = new Date(profile.fetchedAt);
  if (!Number.isNaN(date.getTime())) {
    const day = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(date)
      .replaceAll("/", ".");
    text(`数据采集 ${day}`, 76, 1580, 21, muted, 410);
  }
  text(layout.siteLabel, 1004, 1580, 27, cream, 440, "right");
}
