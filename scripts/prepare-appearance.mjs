import { readFile, writeFile } from "node:fs/promises";
import { bootAppearance } from "../src/boot-appearance.mjs";
export async function prepareAppearance(root) {
  const config = JSON.parse(await readFile(`${root}/data/workbench-appearance.json`, "utf8"));
  const api = JSON.parse(await readFile(`${root}/src/config/player-stats.json`, "utf8"));
  const code = `(${bootAppearance.toString()})(${JSON.stringify(config)}, ${JSON.stringify(api.apiBaseUrl)});`;
  const start = "<!-- wt-loading-appearance:start -->",
    end = "<!-- wt-loading-appearance:end -->";
  const block = `${start}<style>:root{--wt-loading-background-image:url(${JSON.stringify(config.backgroundUrl)});--wt-loading-background-position:${config.positionX}% ${config.positionY}%}</style><script>${code}</script>${end}`;
  const path = `${root}/index.html`;
  let html = await readFile(path, "utf8");
  const a = html.indexOf(start),
    b = html.indexOf(end);
  if (a >= 0 !== b >= 0 || (a >= 0 && b < a))
    throw new Error("Loading appearance markers are incomplete");
  html =
    a >= 0 && b > a
      ? html.slice(0, a) + block + html.slice(b + end.length)
      : html.replace('<meta name="description"', block + '<meta name="description"');
  await writeFile(path, html);
}
