import fontUrl from "./assets/RobotoCondensed-Bold.ttf?url";
import {
  reportImage,
  statsNumber as n,
  statsRatio as r,
  statsDate,
  statsModeNames,
  statsBranchKd,
  statsBranchTarget,
  statsArmyIcon,
} from "./player-stats-api";
import type { StatsReport, Background } from "./player-stats-api";
export async function downloadStatsReport(
  report: StatsReport,
  background: Background,
  armyBase: string,
  signal: AbortSignal,
) {
  const p = report.payload;
  const [terrain, logo, avatar, ...vehicles] = await Promise.all([
    reportImage("background", background.id, signal),
    reportImage("logo", "wt", signal),
    p.player.avatarKey ? reportImage("avatar", p.player.avatarKey, signal) : Promise.resolve(null),
    ...p.top5.map((v) => reportImage("vehicle", v.id, signal)),
  ]);
  const armies = await Promise.all(
    p.branches.map(async (branch) => {
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
  const gold = "#dfc589",
    white = "#eeeade",
    muted = "#bec6bb",
    ink = "#202924";
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
  canvas.height = Math.max(2280, 1765 + lineCount * 49 + 200);
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
    ctx!.strokeStyle = "#a4b49b55";
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
  fade.addColorStop(0, "#16231b33");
  fade.addColorStop(0.7, "#202924dd");
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
    ctx.fillStyle = "#35443a";
    ctx.fillRect(64, 204, 132, 132);
    text(Array.from(p.player.nickname)[0], 100, 295, 65, gold, 700);
  }
  text("战地嘉奖 · 个人出击档案", 225, 231, 25, gold);
  text(p.player.nickname, 225, 301, 64, white, 700);
  text(
    "等级 " + n(p.player.level) + (p.player.clanTag ? " · " + p.player.clanTag : ""),
    225,
    345,
    25,
    muted,
  );
  const columns = [
    { value: n(p.totals.efficiency), label: "Top 5 参考效率" },
    ...p.branches.map((b) => ({
      value: r(statsBranchKd(b)),
      label: b.label + statsBranchTarget(b.id) + " K/D",
    })),
  ];
  const cell = 952 / columns.length;
  columns.forEach((v, i) => {
    text(v.value, 64 + i * cell, 470, i === 0 ? 84 : 64, gold, 700);
    if (i > 0) fit(armies[i - 1], 64 + i * cell, 493, 26, 26);
    text(v.label, 64 + i * cell + (i > 0 ? 32 : 0), 515, 25, muted);
  });
  line(545);
  text("功勋载具 · 最常出击 TOP 5", 64, 598, 30, gold, 700);
  p.top5.forEach((v, i) => {
    const y = 640 + i * 190;
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
    text("累计获得银狮  " + n(v.silverLions), 365, y + 156, 27, gold);
    line(y + 180);
  });
  const speechY = 1645;
  text("司令授勋致辞", 64, speechY, 28, gold, 700);
  text(report.review?.title || "你的嘉奖，等待签发。", 64, speechY + 62, 40, white, 700);
  wrap(
    report.review?.speech ||
      "此预览尚未生成 AI 致辞。返回页面点击生成，即可根据以上五辆载具的真实战绩领取一份授勋致辞。",
    64,
    speechY + 120,
    952,
    31,
    49,
  );
  const footer = canvas.height - 130;
  line(footer);
  text("资料采集 " + statsDate(p.fetchedAt), 64, footer + 41, 22, muted);
  text("本工具参考指数 · 仅所列五车 · 未返回项目留空", 64, footer + 75, 21, muted);
  text("银狮为累计获得统计，非余额或净收入 · 虚构授勋情景", 64, footer + 106, 20, muted);
  if (signal.aborted) return;
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
