import type { PlayerProfile, StatsSession } from "./player-stats-api.ts";

export function homeQueryQuota(session: StatsSession | null) {
  if (!session) return null;
  const limit = session.limits.queryLimit;
  const dailyRemaining =
    limit === null ? null : Math.max(0, limit - session.query.used - session.query.reserved);
  const credits = session.credits;
  const creditRemaining = !credits?.enabled ? 0 : credits.total === null ? null : credits.remaining;
  return {
    dailyRemaining,
    dailyLimit: limit,
    creditRemaining,
    creditsEnabled: !!credits?.enabled,
    queryCost: credits?.costs.query,
  };
}

/** Keep the existing browser history order; fetchedAt is collection time, not visit time. */
export function homeRecentQueries(profiles: PlayerProfile[]) {
  return profiles.slice(0, 4).map((profile) => ({
    uid: profile.uid,
    nickname: profile.nickname,
    avatar: profile.avatar || null,
    avatarFrameKey: profile.avatarFrameKey || null,
    collectedAt: Number.isFinite(Date.parse(profile.fetchedAt)) ? profile.fetchedAt : null,
    restore:
      /^snap_[A-Za-z0-9_-]{10,60}$/.test(profile.snapshotId) && /^[0-9]{1,20}$/.test(profile.uid)
        ? { snapshot: profile.snapshotId, uid: profile.uid }
        : undefined,
  }));
}
