import { vehicleDisplayName } from "./vehicle-display-name";
import { reportStyle } from "./player-report-style";
import { stampExportWatermark } from "./export-watermark";
import {
  localReportImage,
  reportChartData,
  reportSummary,
  reportEfficiencyMaximum,
} from "./player-report-design";
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
  const efficiencyMaximum = reportEfficiencyMaximum(p);
  const voice = reportStyle(p.analysis?.style);
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
  canvas.height = 1900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法创建战报图片。");
  const gold = theme.accent,
    white = theme.ink,
    muted = theme.muted,
    ink = theme.base;
  const chart = reportChartData(p);
  const branches = p.career?.branches || p.branches;
  const vehicleStart = 790;
  const vehicleHeight = 118;
  const speechY = vehicleStart + p.top5.length * vehicleHeight + 42;
  const speech = report.review?.speech || "请生成战报后再保存。";
  ctx.font = "28px sans-serif";
  let measuredLine = "",
    lineCount = 1;
  for (const letter of Array.from(speech)) {
    if (letter === "\n" || ctx.measureText(measuredLine + letter).width > 952) {
      lineCount++;
      measuredLine = letter === "\n" ? "" : letter;
    } else measuredLine += letter;
  }
  canvas.height = Math.max(1300, speechY + 52 + lineCount * 43 + 165);
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
  function shorten(value: string, maxWidth: number, size: number, weight = 400) {
    ctx!.font = `${weight} ${size}px ${weight === 700 ? "WTReport," : ""} sans-serif`;
    if (ctx!.measureText(value).width <= maxWidth) return value;
    const letters = Array.from(value);
    while (letters.length && ctx!.measureText(letters.join("") + "…").width > maxWidth)
      letters.pop();
    return letters.join("") + "…";
  }
  ctx.globalAlpha = 0.65;
  cover(terrain, 0, 0, 1080, 560);
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, 0, 0, 590);
  fade.addColorStop(0, ink + "33");
  fade.addColorStop(0.7, ink + "dd");
  fade.addColorStop(1, ink);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 1080, 630);
  fit(logo, 64, 35, 180, 75);
  ctx.save();
  ctx.textAlign = "right";
  text(statsModeNames[p.mode] + " · " + voice.label, 1016, 83, 25, gold);
  ctx.restore();
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(113, 190, 49, 0, Math.PI * 2);
    ctx.clip();
    cover(avatar, 64, 141, 98, 98);
    ctx.restore();
  } else {
    ctx.fillStyle = theme.panel;
    ctx.fillRect(64, 141, 98, 98);
    text(Array.from(p.player.nickname)[0], 86, 212, 48, gold, 700);
  }
  text(shorten(p.player.nickname, 815, 49, 700), 188, 188, 49, white, 700);
  text(
    "等级 " + n(p.player.level) + (p.player.clanTag ? " · " + p.player.clanTag : ""),
    188,
    226,
    24,
    muted,
  );
  text(voice.kicker + " · " + statsReportScopeLabel(p), 64, 282, 22, gold);
  text(shorten(report.review?.title || "你的战地记录", 952, 43, 700), 64, 335, 43, white, 700);
  text(
    p.career ? "生涯总览 · 该模式全部国家与兵种" : "所列载具汇总 · 含同场多车，非总对局",
    64,
    377,
    22,
    muted,
  );
  line(392);
  reportSummary(p).forEach((item, i) => {
    text(item.value, 64 + i * 238, 447, 47, gold, 700);
    text(item.label, 64 + i * 238, 479, 22, muted);
  });
  branches.forEach((branch, i) => {
    const x = 64 + i * 317;
    fit(armies[i], x, 501, 26, 26);
    text(
      branch.label + statsBranchTarget(branch.id) + " K/D " + r(statsBranchKd(branch)),
      x + 34,
      522,
      21,
      muted,
    );
  });
  line(544);
  text("载具效率评分", 64, 580, 23, gold, 700);
  text("0–" + efficiencyMaximum, 505, 580, 18, muted);
  text("载具击毁构成", 666, 580, 23, gold, 700);
  ctx.save();
  ctx.textAlign = "right";
  text(chart.hasKnown ? n(chart.total) : "—", 1016, 580, 28, white, 700);
  ctx.restore();
  chart.values.forEach((v, i) => {
    const y = 619 + i * 26;
    text(shorten(v.label, 192, 20), 64, y, 20, muted);
    ctx.fillStyle = theme.line;
    ctx.fillRect(276, y - 8, 244, 5);
    if (v.value != null) {
      ctx.fillStyle = gold;
      ctx.fillRect(
        276,
        y - 8,
        (244 * Math.max(0, Math.min(efficiencyMaximum, v.value))) / efficiencyMaximum,
        5,
      );
    }
    ctx.save();
    ctx.textAlign = "right";
    text(n(v.value), 572, y, 22, white, 700);
    ctx.restore();
  });
  const colors = [theme.accent, theme.secondary, theme.tertiary];
  ctx.fillStyle = theme.line;
  ctx.fillRect(666, 613, 350, 10);
  let offset = 0;
  chart.segments.forEach((seg, i) => {
    const width = chart.total > 0 ? ((seg.value || 0) / chart.total) * 350 : 0;
    if (width > 0) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(666 + offset, 613, width, 10);
    }
    offset += width;
    const y = 655 + i * 29;
    ctx.fillStyle = colors[i];
    ctx.fillRect(666, y - 11, 8, 8);
    text(seg.label, 686, y, 21, muted);
    ctx.save();
    ctx.textAlign = "right";
    text(n(seg.value), 1016, y, 22, white);
    ctx.restore();
  });
  line(744);
  text("常用载具 · TOP " + p.top5.length, 64, 777, 25, gold, 700);
  p.top5.forEach((v, i) => {
    const y = vehicleStart + i * vehicleHeight;
    text(String(i + 1).padStart(2, "0"), 64, y + 48, 29, gold, 700);
    fit(vehicles[i], 107, y + 4, 160, 94);
    text(shorten(vehicleDisplayName(v.name), 485, 29, 700), 292, y + 27, 29, white, 700);
    ctx.save();
    ctx.textAlign = "right";
    text(n(v.efficiency) + " 效率" + (v.smallSample ? " · 场次不足" : ""), 1016, y + 27, 23, gold);
    ctx.restore();
    const stats =
      n(v.battles) +
      " 场 · " +
      (v.winRate == null ? "—" : v.winRate.toFixed(2) + "%") +
      " 胜率 · 空 " +
      r(v.airKd) +
      " / 地 " +
      r(v.groundKd) +
      (v.category !== "ground" &&
      (v.navalKd != null || v.category === "ships" || v.category === "boats")
        ? " / 海 " + r(v.navalKd)
        : "") +
      " K/D";
    text(shorten(stats, 724, 23), 292, y + 61, 23, muted);
    fit(silver, 292, y + 77, 24, 24);
    text("累计银狮  " + statsSilver(v.silverLions), 326, y + 97, 23, muted);
    line(y + vehicleHeight - 5);
  });
  text(voice.sectionTitle, 64, speechY, 25, gold, 700);
  wrap(speech, 64, speechY + 52, 952, 28, 43);
  const footer = canvas.height - 118;
  line(footer);
  text("资料采集 " + statsDate(p.fetchedAt), 64, footer + 34, 20, muted);
  text("效率为工作台统计评分 · 构成图仅含所列载具已知击毁", 64, footer + 66, 19, muted);
  text(
    p.previousEfficiencyVersion
      ? "历史点评保留原文，评分已更新 · 银狮为累计获得，非净收入"
      : "银狮为累计获得，非净收入 · AI 点评仅供参考",
    64,
    footer + 96,
    19,
    muted,
  );
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
    p.player.nickname.replace(/[^\p{L}\p{N}_-]/gu, "_") +
    "_" +
    p.mode +
    "_" +
    voice.label +
    "_战报.png";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
