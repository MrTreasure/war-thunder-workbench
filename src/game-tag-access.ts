/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { communityRequest } from "./lineup-community-api";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { useAccountWorkspace } from "./workspace-context";
import { freeTagTones, type TagChoice } from "./components/TagSelector";
import { gameTagTones, type GameTagTone } from "./components/GameTag";
export type GameTagAccess = {
  policyVersion: string;
  bound: boolean;
  bindingUid?: string;
  level: number | null;
  rbBattles: number | null;
  profileUpdatedAt: string | null;
  allowedTones: GameTagTone[];
  tier: string | null;
};
const updated = "wt-game-tag-access-updated";
export const notifyGameTagAccess = () => window.dispatchEvent(new Event(updated));
export function useGameTagAccess() {
  const account = useWorkbenchAccount();
  const workspace = useAccountWorkspace();
  const key = `${account.session?.user?.id || "guest"}:${account.identityVersion}:${workspace?.binding?.uid || ""}:${workspace?.binding?.fetchedAt || ""}`;
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [state, setState] = useState<{
    key: string;
    access: GameTagAccess | null;
    error: string;
    loading: boolean;
  }>({ key: "", access: null, error: "", loading: true });
  useEffect(() => {
    const visible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener(updated, refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(updated, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, access: null, error: "", loading: true });
    void communityRequest<GameTagAccess>("tags/access", undefined, controller.signal)
      .then((access) => {
        if (!controller.signal.aborted) setState({ key, access, error: "", loading: false });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setState({
            key,
            access: null,
            error: cause instanceof Error ? cause.message : "资格读取失败",
            loading: false,
          });
      });
    return () => controller.abort();
  }, [key, revision]);
  const access = state.key === key ? state.access : null;
  return {
    access,
    allowedTones:
      access?.allowedTones.filter((id) => Object.hasOwn(gameTagTones, id)) || freeTagTones,
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : "",
    refresh,
  };
}
export async function approveGameTags(
  tags: TagChoice[],
  postId: string | undefined,
  signal: AbortSignal,
) {
  const result = await communityRequest<{ approved: boolean; policyVersion: string }>(
    "tags/check",
    { tags, ...(postId ? { postId } : {}) },
    signal,
  );
  if (!result.approved || !result.policyVersion)
    throw new Error("标签资格核验失败，请刷新后重试。");
}
