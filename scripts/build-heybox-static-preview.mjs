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
const shots = new URL("../artifacts/heybox-mobile-fixes-20261025/", import.meta.url);
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
  ["android-02-tree", "研发科技树", "Android", "按国家读取，保留原版游戏卡片与科技树布局。"],
  ["android-03-research-detail", "载具与配件研发", "Android", "独立详情页；返回清除载具选择。"],
  ["android-04-filters", "研发筛选", "Android", "筛选作为独立页面，保留来源页状态。"],
  ["android-05-vehicle-list", "载具列表", "Android", "共用 228×76 载具卡片，右下等级页脚。"],
  ["android-06-account", "我的工作台", "Android", "保留关联入口和主站完整能力入口。"],
  [
    "android-07-link-account",
    "关联网页账号",
    "Android",
    "输入关联码；真实授权与确认需在小黑盒 APP 内进行。",
  ],
  ["android-08-main-site", "体验完整工作台", "Android", "前往既有 QMuse 主站，提供真实地址。"],
  ["android-09-query", "真实玩家搜索", "Android", "匿名查询返回真实候选；未注入接口响应。"],
  ["query-profile", "真实战绩成功记录", "iPhone", "该次查询成功；重复流程仍出现连接失败。"],
  ["iphone-01-account", "我的工作台", "iPhone", "安全区域检查通过，图标成功解码。"],
  ["iphone-02-link-account", "关联网页账号", "iPhone", "使用独立详情页，未模拟登录。"],
  ["failure", "复测连接失败", "Android", "保留失败记录：REQUEST_FAILED。查询稳定性尚未通过。"],
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
