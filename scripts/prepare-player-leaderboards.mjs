import { readFile, writeFile } from "node:fs/promises";
const body = await readFile(new URL("../data/player-leaderboards.json", import.meta.url), "utf8");
const data = JSON.parse(body);
if (data.schemaVersion !== 1 || data.boards?.length !== 6 || data.boards.some(b => b.players?.length !== 25)) throw Error("Official leaderboard snapshot is incomplete");
await writeFile(new URL("../../war-thunder-stats-service/data/player-leaderboards.json", import.meta.url), body);
console.log("Prepared six official leaderboard snapshots for the stats service; no publication performed.");
