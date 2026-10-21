/** Build the isolated design review. JSON stays canonical; delivery is JavaScript. */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const source = new URL("design-previews/player-stats/", root);
const output = new URL("public/design/player-stats/", root);
const data = JSON.parse(await readFile(new URL("data/player-stats-preview.json", root), "utf8"));
if (data.schemaVersion !== 1 || data.kind !== "static-design-preview" || !data.players.length)
  throw new Error("Invalid preview fixture");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
async function asset(prefix, suffix, body) {
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const name = `${prefix}.${hash}.${suffix}`;
  await writeFile(new URL(name, output), body);
  return name;
}
const dataName = await asset("data", "js", `export default ${JSON.stringify(data)};\n`);
const fontName = await asset(
  "numbers",
  "ttf",
  await readFile(new URL("src/assets/RobotoCondensed-Bold.ttf", root)),
);
const cssName = await asset(
  "style",
  "css",
  (await readFile(new URL("style.css", source), "utf8")).replace("./numbers.ttf", `./${fontName}`),
);
const appName = await asset(
  "app",
  "js",
  (await readFile(new URL("app.js", source), "utf8")).replace("./data.js", `./${dataName}`),
);
const html = (await readFile(new URL("preview.html", source), "utf8"))
  .replace("./style.css", `./${cssName}`)
  .replace("./app.js", `./${appName}`);
await writeFile(new URL("preview.html", output), html);
console.log(
  `Built standalone player stats preview: ${data.players.length} player(s), JSON transported as JS.`,
);
