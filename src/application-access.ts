import type { StatsSession } from "./player-stats-api";

/** Feature access follows the server-verified role for this application. */
export function canUseTestFeatures(session: StatsSession | null | undefined): boolean {
  const user = session?.user;
  return Boolean(
    user?.id &&
    (user.isSuperAdmin === true ||
      user.applicationRole === "tester" ||
      user.applicationRole === "admin"),
  );
}
