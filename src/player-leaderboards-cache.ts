import snapshot from "../data/player-leaderboard-navigation.json";
export type LeaderboardPlayer = { rank: number; nickname: string; uid?: string | null; uidVerifiedAt?: string | null };
export type LeaderboardData = { schemaVersion: number; contentSafetyVersion?: string; boards: (Omit<(typeof snapshot.boards)[number], "players"> & { players: LeaderboardPlayer[] })[] };
const KEY = "wt-stats-leaderboards-v1", TTL = 3600000;
export function validLeaderboards(value: unknown): value is LeaderboardData {
  if (!value || typeof value !== "object") return false;
  const data = value as LeaderboardData;
  return data.contentSafetyVersion === "content-safety-v3" && data.schemaVersion === 1 && Array.isArray(data.boards) && data.boards.length === 6 &&
    data.boards.every(b => b && typeof b === "object") &&
    new Set(data.boards.map(b => b.mode + "/" + b.branch)).size === 6 &&
    data.boards.every(b => b && ["ab", "rb", "sb"].includes(b.mode) && ["ground", "air"].includes(b.branch) &&
      Number.isFinite(Date.parse(b.fetchedAt)) && Array.isArray(b.sources) && b.sources.length === 2 &&
      b.sources.every(s => { try { const u = new URL(s); return u.origin === "https://warthunder.com" && u.pathname === "/en/community/leaderboard/"; } catch { return false; } }) &&
      Array.isArray(b.players) && b.players.length <= 25 && new Set(b.players.map(p => p?.nickname)).size === b.players.length &&
      b.players.every((p, i) => p && Number.isInteger(p.rank) && p.rank >= 1 && p.rank <= 25 && (i === 0 || p.rank > b.players[i - 1].rank) && typeof p.nickname === "string" && p.nickname.length >= 2 && p.nickname.length <= 64 &&
        (p.uid == null || typeof p.uid === "string" && /^[0-9]{1,20}$/.test(p.uid)) &&
        (p.uidVerifiedAt == null || typeof p.uidVerifiedAt === "string" && Number.isFinite(Date.parse(p.uidVerifiedAt)))));
}
export function cachedLeaderboards(): LeaderboardData {
  try {
    const text = localStorage.getItem(KEY);
    if (text && text.length <= 256000) {
      const saved = JSON.parse(text);
      const age = Date.now() - saved.savedAt;
      if (Number.isFinite(age) && age >= 0 && age < TTL && validLeaderboards(saved.value)) return saved.value;
    }
  } catch { /* Unreviewed snapshots are not displayed. */ }
  return { schemaVersion: 1, boards: snapshot.boards.map(b => ({ ...b, players: [] })) };
}
export function cacheLeaderboards(value: LeaderboardData) {
  if (!validLeaderboards(value)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), value })); } catch { /* Never evict user data for this cache. */ }
}
