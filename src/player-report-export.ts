import { stampExportWatermark } from "./export-watermark";
import { localReportImage, reportChartData, reportSummary } from "./player-report-design";
import type { ReportTheme } from "./player-report-design";
import fontUrl from "./assets/RobotoCondensed-Bold.ttf?url";
import {
  reportImage,
  statsNumber as n,
  statsSilver,
  statsRatio as r,
  statsDate,
  statsModeNames,
  statsBranchKd,
  statsBranchTarget,
  statsArmyIcon,
  statsReportScopeLabel,
} from "./player-stats-api";
import type { StatsReport, Background } from "./player-stats-api";
export async function downloadStatsReport(
  report: StatsReport,
  background: Background,
  armyBase: string,
  theme: ReportTheme,
  signal: AbortSignal,
) {
  const p = report.payload;
  const silver = await reportImage("currency", "sl", signal);
  const [terrain, logo, avatar, ...vehicles] = await Promise.all([
    background.local
      ? localReportImage(background.source, signal)
      : reportImage("background", background.id, signal),
    reportImage("logo", "wt", signal),
    p.player.avatarKey ? reportImage("avatar", p.player.avatarKey, signal) : Promise.resolve(null),
    ...p.top5.map((v) => reportImage("vehicle", v.id, signal)),
  ]);
  const armies = await Promise.all(
    (p.career?.branches || p.branches).map(async (branch) => {
      const response = await fetch(statsArmyIcon(armyBase, branch.id), {
        credentials: "omit",
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
      if (!response.ok) throw new Error("军种图标暂时无法读取，请稍后保存。");
      const url = URL.createObjectURL(await response.blob());
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    }),
  );
  const font = new FontFace("WTReport", `url("${fontUrl}")`, { weight: "700" });
  document.fonts.add(await font.load());
  await document.fonts.ready;
  if (signal.aborted) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 2280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法创建战报图片。");
  const gold = theme.accent,
    white = theme.ink,
    muted = theme.muted,
    ink = theme.base;
  const chart = reportChartData(p);
  const branches = p.career?.branches || p.branches;
  const vehicleStart = 1180;
  const speechY = vehicleStart + p.top5.length * 190 + 72;
  const speech =
    report.review?.speech ||
    "此预览尚未生成 AI 致辞。返回页面点击生成，即可根据以上五辆载具的真实战绩领取一份授勋致辞。";
  ctx.font = "31px sans-serif";
  let measuredLine = "",
    lineCount = 1;
  for (const letter of Array.from(speech)) {
    if (letter === "\n" || ctx.measureText(measuredLine + letter).width > 952) {
      lineCount++;
      measuredLine = letter === "\n" ? "" : letter;
    } else measuredLine += letter;
  }
  canvas.height = Math.max(2280, speechY + 90 + lineCount * 49 + 220);
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, 1080, canvas.height);
  function cover(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    ctx!.save();
    ctx!.beginPath();
    ctx!.rect(x, y, w, h);
    ctx!.clip();
    ctx!.drawImage(
      img,
      x + (w - img.naturalWidth * scale) / 2,
      y + (h - img.naturalHeight * scale) / 2,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );
    ctx!.restore();
  }
  function fit(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    ctx!.drawImage(
      img,
      x + (w - img.naturalWidth * scale) / 2,
      y + (h - img.naturalHeight * scale) / 2,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );
  }
  function text(value: string, x: number, y: number, size = 30, color = white, weight = 400) {
    ctx!.font = `${weight} ${size}px ${weight === 700 ? "WTReport," : ""} sans-serif`;
    ctx!.fillStyle = color;
    ctx!.fillText(value, x, y);
  }
  function line(y: number) {
    ctx!.strokeStyle = theme.line;
    ctx!.lineWidth = 1.5;
    ctx!.beginPath();
    ctx!.moveTo(64, y);
    ctx!.lineTo(1016, y);
    ctx!.stroke();
  }
  function wrap(value: string, x: number, y: number, width: number, size = 33, height = 53) {
    ctx!.font = `${size}px sans-serif`;
    let current = "";
    for (const letter of Array.from(value)) {
      if (letter === "\n" || ctx!.measureText(current + letter).width > width) {
        text(current, x, y, size);
        y += height;
        current = letter === "\n" ? "" : letter;
      } else current += letter;
    }
    if (current) {
      text(current, x, y, size);
      y += height;
    }
    return y;
  }
  ctx.globalAlpha = 0.65;
  cover(terrain, 0, 0, 1080, 700);
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, 0, 0, 720);
  fade.addColorStop(0, ink + "33");
  fade.addColorStop(0.7, ink + "dd");
  fade.addColorStop(1, ink);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 1080, 760);
  fit(logo, 64, 52, 220, 100);
  text(statsModeNames[p.mode] + " · TOP 5", 680, 115, 27, gold);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 270, 66, 0, Math.PI * 2);
    ctx.clip();
    cover(avatar, 64, 204, 132, 132);
    ctx.restore();
  } else {
    ctx.fillStyle = theme.panel;
    ctx.fillRect(64, 204, 132, 132);
    text(Array.from(p.player.nickname)[0], 100, 295, 65, gold, 700);
  }
  text("战地嘉奖 · " + statsReportScopeLabel(p), 225, 219, 23, gold);
  text(p.player.nickname, 225, 283, 58, white, 700);
  text(
    "等级 " + n(p.player.level) + (p.player.clanTag ? " · " + p.player.clanTag : ""),
    225,
    323,
    25,
    muted,
  );
  ctx.font = "700 45px WTReport,sans-serif";
  const heading = report.review?.title || "向你的坚持致敬";
  text(
    heading,
    64,
    416,
    Math.min(45, (45 * 952) / Math.max(952, ctx.measureText(heading).width)),
    white,
    700,
  );
  text(
    p.career ? "生涯总览 · 该模式全部国家与兵种" : "所列载具汇总 · 含同场多车，非总对局",
    64,
    470,
    23,
    muted,
  );
  line(492);
  reportSummary(p).forEach((item, i) => {
    text(item.value, 64 + i * 238, 562, 55, gold, 700);
    text(item.label, 64 + i * 238, 599, 24, muted);
  });
  branches.forEach((branch, i) => {
    const x = 64 + i * 317;
    fit(armies[i], x, 626, 28, 28);
    text(
      branch.label + statsBranchTarget(branch.id) + " K/D " + r(statsBranchKd(branch)),
      x + 36,
      649,
      22,
      muted,
    );
  });
  ctx.fillStyle = theme.panel;
  ctx.fillRect(64, 690, 952, 366);
  text("载具参考效率", 88, 734, 25, gold, 700);
  text("载具击毁构成", 668, 734, 25, gold, 700);
  chart.values.forEach((v, i) => {
    const y = 778 + i * 47;
    text(
      v.rank + " " + (v.label.length > 16 ? v.label.slice(0, 15) + "…" : v.label),
      88,
      y,
      21,
      muted,
    );
    ctx.fillStyle = theme.line;
    ctx.fillRect(88, y + 10, 450, 5);
    if (v.value != null) {
      ctx.fillStyle = gold;
      ctx.fillRect(88, y + 10, (450 * Math.max(0, Math.min(1000, v.value))) / 1000, 5);
    }
    text(n(v.value), 554, y + 15, 22, white, 700);
  });
  text("0", 88, 1040, 18, muted);
  text("500", 296, 1040, 18, muted);
  text("1000", 504, 1040, 18, muted);
  const colors = [theme.accent, theme.secondary, theme.tertiary];
  ctx.lineWidth = 17;
  ctx.strokeStyle = theme.line;
  ctx.beginPath();
  ctx.arc(825, 837, 76, 0, Math.PI * 2);
  ctx.stroke();
  chart.segments.forEach((seg, i) => {
    if (seg.value != null && seg.value > 0) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(825, 837, 76, seg.start, seg.end);
      ctx.stroke();
    }
  });
  ctx.save();
  ctx.textAlign = "center";
  text(chart.hasKnown ? n(chart.total) : "—", 825, 838, 35, white, 700);
  text("已知击毁", 825, 869, 20, muted);
  ctx.restore();
  chart.segments.forEach((seg, i) => {
    const y = 963 + i * 30;
    ctx.fillStyle = colors[i];
    ctx.fillRect(680, y - 11, 10, 10);
    text(seg.label, 702, y, 20, muted);
    ctx.save();
    ctx.textAlign = "right";
    text(n(seg.value), 990, y, 21, white);
    ctx.restore();
  });
  text("功勋载具 · TOP " + p.top5.length, 64, 1137, 30, gold, 700);
  p.top5.forEach((v, i) => {
    const y = vehicleStart + i * 190;
    text(String(i + 1).padStart(2, "0"), 64, y + 65, 36, gold, 700);
    fit(vehicles[i], 115, y, 220, 145);
    ctx.font = "700 35px WTReport, sans-serif";
    const nameSize = Math.min(35, (35 * 640) / Math.max(640, ctx.measureText(v.name).width));
    text(v.name, 365, y + 36, nameSize, white, 700);
    text(
      n(v.battles) +
        " 场     " +
        (v.winRate == null ? "—" : v.winRate.toFixed(2) + "%") +
        " 胜率     " +
        n(v.efficiency) +
        " 效率",
      365,
      y + 78,
      27,
      muted,
    );
    text(
      "空 " +
        r(v.airKd) +
        " / 地 " +
        r(v.groundKd) +
        (v.navalKd != null || v.category === "ships" || v.category === "boats"
          ? " / 海 " + r(v.navalKd)
          : "") +
        " K/D",
      365,
      y + 118,
      26,
      muted,
    );
    text("累计获得银狮", 365, y + 156, 27, gold);
    fit(silver, 545, y + 131, 30, 30);
    text(statsSilver(v.silverLions), 586, y + 156, 27, gold);
    line(y + 180);
  });
  text("司令的话", 64, speechY, 28, gold, 700);
  wrap(report.review?.speech || "", 64, speechY + 65, 952, 31, 49);
  const footer = canvas.height - 130;
  line(footer);
  text("资料采集 " + statsDate(p.fetchedAt), 64, footer + 41, 22, muted);
  text("效率为本工具参考指数 · 构成图仅含所列载具已知击毁", 64, footer + 75, 21, muted);
  text("银狮为累计获得统计，非余额或净收入 · 虚构授勋情景", 64, footer + 106, 20, muted);
  if (signal.aborted) return;
  await stampExportWatermark(canvas, signal);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("战报图片生成失败。"))),
      "image/png",
    ),
  );
  if (signal.aborted) return;
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    p.player.nickname.replace(/[^\p{L}\p{N}_-]/gu, "_") + "_" + p.mode + "_授勋战报.png";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
