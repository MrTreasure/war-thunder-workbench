import { readFile, writeFile, rename } from "node:fs/promises";
import { parseHTML } from "linkedom";

const output = new URL("../data/player-leaderboards.json", import.meta.url);
const previous = await readFile(output, "utf8")
  .then(JSON.parse)
  .catch(() => ({ boards: [] }));
const boards = [];
let requests = 0;
for (const [mode, game] of Object.entries({ ab: "arcade", rb: "historical", sb: "simulation" })) {
  for (const [branch, sort] of Object.entries({ ground: "gtd", air: "atd" })) {
    try {
      const players = [];
      const sources = [];
      for (const page of [1, 2]) {
        if (requests++) await new Promise((resolve) => setTimeout(resolve, 7000));
        const url = `https://warthunder.com/en/community/leaderboard/?game=${game}&sort=${sort}&page=${page}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Official leaderboard HTTP ${response.status}`);
        const { document } = parseHTML(await response.text());
        const active = document.querySelector(".leaderboards-tabs__item.active")?.textContent || "";
        const expected = { ab: "Arcade", rb: "Realistic", sb: "Simulation" }[mode];
        if (!active.includes(expected)) throw new Error("Official mode mismatch");
        const selected = document.querySelector("th.select a")?.getAttribute("href") || "";
        if (!selected.includes(`sort=${sort}`)) throw new Error("Official sort mismatch");
        for (const row of document.querySelectorAll("table.leaderboards tr")) {
          const link = row.querySelector("a.player_on_lb");
          if (!link) continue;
          const rank = Number(row.querySelector("td")?.textContent.trim());
          const nickname = new URL(link.getAttribute("href")).searchParams.get("nick");
          if (!nickname || !Number.isInteger(rank)) throw new Error("Invalid player row");
          if (rank <= 25) players.push({ rank, nickname });
        }
        sources.push(url);
      }
      if (
        players.length !== 25 ||
        players.some((p, i) => p.rank !== i + 1) ||
        new Set(players.map((p) => p.nickname)).size !== 25
      )
        throw new Error("Incomplete official top 25");
      boards.push({
        mode,
        branch,
        period: "all-time",
        metric: branch === "ground" ? "ground-targets-destroyed" : "air-targets-destroyed",
        fetchedAt: new Date().toISOString(),
        sources,
        players,
      });
      console.log(`${mode}/${branch}: verified 25 players`);
    } catch (error) {
      const old = previous.boards.find((b) => b.mode === mode && b.branch === branch);
      if (old) boards.push(old);
      console.error(`${mode}/${branch}: ${error.message}; preserved prior snapshot`);
      process.exitCode = 1;
    }
  }
}
if (boards.length === 6) {
  await writeFile(
    new URL(output.href + ".next"),
    JSON.stringify({ schemaVersion: 1, boards }, null, 2) + "\n",
  );
  await rename(new URL(output.href + ".next"), output);
}
