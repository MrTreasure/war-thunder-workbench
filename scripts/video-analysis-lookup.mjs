/** Offline lookup before opening a previously collected Bilibili source. */
import { readFile } from "node:fs/promises";
import { parseVideoId, validateVideoLibrary } from "../src/video-analysis-library.ts";

if (process.argv.length !== 3) throw Error("Usage: node scripts/video-analysis-lookup.mjs 'BV or Bilibili URL'");
const bvid = parseVideoId(process.argv[2]);
if (!bvid) throw Error("请输入完整、大小写正确的 BV 或标准 HTTPS B站视频链接");
const file = new URL("../artifacts/private-video-analysis/index.json", import.meta.url);
const library = validateVideoLibrary(JSON.parse(await readFile(file, "utf8")));
const record = library.items.find((item) => item.bvid === bvid);
console.log(JSON.stringify({ bvid, found: !!record, registryUpdatedAt: library.updatedAt, record: record ?? null }, null, 2));
