// Public UI only. No vehicle payload or private evidence is read here.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { bootAppearance } from "../../src/boot-appearance.mjs";
export async function buildWeakpointShell(project, out) {
const assets = resolve(out, "assets");
await mkdir(assets, { recursive: true });
const hash = (body) => createHash("sha256").update(body).digest("hex");
const symbols = await readFile(resolve(project, "src/assets/WTSymbols.ttf"));
const fontFile = `weakpoints-symbols.${hash(symbols).slice(0, 16)}.ttf`;
await writeFile(resolve(assets, fontFile), symbols);
const supportFiles = [{ file: fontFile, bytes: symbols.length, sha256: hash(symbols), kind: "symbol-font" }];
const cardFont = await readFile(resolve(project, "src/assets/FiraSansCondensed-Regular.ttf"));
const cardFontFile = `weakpoints-card.${hash(cardFont).slice(0, 16)}.ttf`;
await writeFile(resolve(assets, cardFontFile), cardFont);
supportFiles.push({ file: cardFontFile, bytes: cardFont.length, sha256: hash(cardFont), kind: "card-font" });
const cardCss = (await readFile(resolve(project, "src/research-tree-game.css"), "utf8"))
  .replace('./assets/FiraSansCondensed-Regular.ttf', './' + cardFontFile)
  + "\n" + await readFile(resolve(project, "src/vehicle-tile.css"), "utf8");
const appearance = JSON.parse(await readFile(resolve(project, "data/workbench-appearance.json"), "utf8"));
const { apiBaseUrl } = JSON.parse(await readFile(resolve(project, "src/config/player-stats.json"), "utf8"));
const backgroundCss = await readFile(resolve(project, "src/workbench-background.css"), "utf8");
const backgroundDefaults = `:root{--wt-loading-background-image:url(${JSON.stringify(appearance.backgroundUrl)});--wt-loading-background-position:${appearance.positionX}% ${appearance.positionY}%}`;
const css = Buffer.from(backgroundDefaults + "\n" + cardCss + "\n" + (await readFile(new URL("preview.css", import.meta.url), "utf8")).replaceAll("__SYMBOL_FONT__", fontFile) + "\n" + backgroundCss);
const loader = `(async () => {
  if (window.parent === window || new URLSearchParams(location.search).get("embedded") !== "1" && document.documentElement.dataset.wtEmbedded !== "true") {
    const root = new URL("./", location.href);
    const vehicle = new URLSearchParams(location.hash.slice(1)).get("vehicle");
    root.hash = "/weakpoints" + (vehicle ? "?vehicle=" + encodeURIComponent(vehicle) : "");
    location.replace(root.href);
    return;
  }
  const parentOrigin = document.documentElement.dataset.wtParentOrigin || location.origin;
  document.body.dataset.embedded = "true";
  const SAMPLE = await new Promise((resolve) => {
    const receive = (event) => {
      if (event.origin !== parentOrigin || event.source !== window.parent || event.data?.type !== "wt-weakpoints-data") return;
      const value = event.data.payload;
      if (!value || !Array.isArray(value.models) || !value.models.length || value.models.length > 500 || !value.models.every((model) => typeof model.id === "string" && /^[a-z0-9_]+$/.test(model.id))) return;
      window.removeEventListener("message", receive);
      resolve(value);
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "wt-weakpoints-ready" }, parentOrigin);
  });
`;
const resize = `
  const resize = () => window.parent.postMessage({ type: "wt-weakpoints-height", height: Math.ceil(document.body.getBoundingClientRect().height) + 4 }, parentOrigin);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);
  window.addEventListener("load", resize);
  resize();
})().catch(() => { document.body.textContent = "弱点资料加载失败，请返回工作台重新登录。"; });`;
const js = Buffer.from(loader + `(${bootAppearance.toString()})(${JSON.stringify(appearance)},${JSON.stringify(apiBaseUrl)});\n` + await readFile(new URL("preview.js", import.meta.url), "utf8") + resize);
const cssFile = `weakpoints-preview.${hash(css).slice(0, 16)}.css`, jsFile = `weakpoints-workspace.${hash(js).slice(0, 16)}.js`;
await writeFile(resolve(assets, cssFile), css); await writeFile(resolve(assets, jsFile), js);
const html = (await readFile(new URL("preview.html", import.meta.url), "utf8")).replace("__STYLE__", "./assets/" + cssFile).replace("__SCRIPT__", "./assets/" + jsFile).replaceAll("__SYMBOL_FONT__", fontFile);
if (/__STYLE__|__SCRIPT__|__SYMBOL_FONT__|<script(?![^>]*src=)/.test(html)) throw Error("Unresolved or inline script");
await writeFile(resolve(out, "weakpoints-preview.html"), html);
const shell = resolve(project, "src/generated/weakpoint-shell");
await mkdir(shell, { recursive: true });
await Promise.all([
  writeFile(resolve(shell, "shell.html"), (await readFile(new URL("preview.html", import.meta.url), "utf8")).replace("__STYLE__", "./shell.css").replace("__SCRIPT__", "./shell.js").replace("./assets/__SYMBOL_FONT__", "../../assets/WTSymbols.ttf")),
  writeFile(resolve(shell, "shell.css"), css.toString().replaceAll("./" + fontFile, "../../assets/WTSymbols.ttf").replaceAll("./" + cardFontFile, "../../assets/FiraSansCondensed-Regular.ttf")),
  writeFile(resolve(shell, "shell.js"), js),
]);
return supportFiles;
}
