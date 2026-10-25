/** Builds only browser acceptance pages, never a production miniapp release. */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const build = spawnSync(
  "pnpm",
  [
    "--dir",
    "apps/war-thunder-heybox",
    "exec",
    "vite",
    "build",
    "--config",
    "vite.preview.config.js",
  ],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) throw Error("Static preview build failed");
const out = new URL("../artifacts/heybox-static-preview/site/", import.meta.url);
const shots = new URL("../artifacts/heybox-complete-20261025/", import.meta.url);
await mkdir(new URL("heybox-preview/", out), { recursive: true });
const entry = await readFile(new URL("index.html", out), "utf8");
if (!entry.includes('src="/war-thunder-trees/assets/') || /(?:src|href)="\/assets\//.test(entry))
  throw Error("Preview entry must load assets from its existing application prefix");
await rename(new URL("index.html", out), new URL("heybox-preview/index.html", out));
await mkdir(new URL("heybox-review/", out), { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);
async function asset(name, body, ext) {
  const path = `assets/heybox-${name}.${hash(body)}.${ext}`;
  await writeFile(new URL(path, out), body);
  return "../" + path;
}
const records = [
  [
    "achievement-share-mobile",
    "单载具成就与原生分享",
    "浏览器 · 测试数据",
    "直接调用 PC createVehicleCard；底部延伸原背景，接缝柔化，预留 64px 平台水印空间。",
  ],
  [
    "career-report-pc-preview",
    "完整个人战报",
    "浏览器 · 测试数据",
    "PC 与小程序共用完整战报生成器；图片中的点评为明确验收示例，不是真实 AI 分析。",
  ],
  [
    "mock-tree-fullscreen",
    "全屏科技树",
    "浏览器交互验收",
    "双指缩放，隐藏应用导航，仅保留科技树和退出图标；未修改宿主系统全屏。",
  ],
  [
    "mock-history",
    "本地查询记录",
    "浏览器 · 测试数据",
    "本地只保存有界 UID／快照引用；重开后恢复，读取当前服务端审核资料，支持清除。",
  ],
  [
    "mock-valuation-basis",
    "估值依据",
    "浏览器 · 测试数据",
    "展示该次服务端返回的费率和金额口径，不在小程序重算。",
  ],
  [
    "mock-valuation-vehicles",
    "估值载具明细",
    "浏览器 · 测试数据",
    "复用最新载具卡；移除外部重复名称、类型、研发点及拥有文案。核验日期与来源紧邻卡片，筛选国家后省略卡片国家。使用明确测试数据。",
  ],
];
const pages = [];
for (const [name, title, device, note] of records) {
  pages.push({
    title,
    device,
    note,
    src: await asset("shot-" + name, await readFile(new URL(name + ".png", shots)), "png"),
  });
}
const source = new URL("../previews/heybox-review/", import.meta.url);
const css = await asset("review", await readFile(new URL("review.css", source)), "css");
const js = await asset("review", await readFile(new URL("review.js", source)), "js");
const options = pages
  .map((p, i) => `<option value="${i}">${p.device} · ${p.title}</option>`)
  .join("");
const buttons = pages
  .map(
    (p, i) =>
      `<button type="button" data-page="${i}" aria-pressed="${i === 0}"><span>${p.title}</span><small>${p.device}${p.title.includes("失败") ? " · 未通过" : ""}</small></button>`,
  )
  .join("");
const html = (await readFile(new URL("index.html", source), "utf8"))
  .replaceAll("{{CSS}}", css)
  .replaceAll("{{JS}}", js)
  .replace("{{BUTTONS}}", buttons)
  .replace("{{OPTIONS}}", options)
  .replaceAll("{{FIRST}}", pages[0].src)
  .replace("{{PAGES}}", JSON.stringify(pages).replaceAll("<", "\\u003c"));
if (/{{[A-Z]+}}/.test(html)) throw Error("Unresolved preview token");
await writeFile(new URL("heybox-review/index.html", out), html);
console.log(
  JSON.stringify({
    preview: "https://render.mrtreasure.cc/war-thunder-trees/heybox-preview/",
    review: "https://render.mrtreasure.cc/war-thunder-trees/heybox-review/",
    screenshots: pages.length,
  }),
);
