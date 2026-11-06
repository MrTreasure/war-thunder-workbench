import { useRef, useState } from "react";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import { useWorkbenchAccount } from "./WorkbenchAccount";

export function LoadoutVoteButtons({
  item,
  onChange,
}: {
  item: LoadoutShare;
  onChange: (value: Partial<LoadoutShare>) => void;
}) {
  const account = useWorkbenchAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false);
  async function vote(value: number) {
    if (working.current || item.mine) return;
    if (!account.session?.user) {
      await account.login();
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await loadoutRequest<
        Pick<LoadoutShare, "id" | "up" | "down" | "vote" | "mine">
      >(`shares/${item.id}/vote`, { value: item.vote === value ? 0 : value });
      onChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "评价未保存，请重试。");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="wt-mount-voting" aria-busy={busy}>
      <fieldset className="wt-mount-vote-actions" aria-label="评价挂载方案">
        <button
          className="quiet-button"
          disabled={busy || item.mine}
          aria-pressed={item.vote === 1}
          title={item.mine ? "不能评价自己发布的方案" : "再次点击取消推荐"}
          onClick={() => void vote(1)}
        >
          ↑ 推荐 {item.up ?? 0}
        </button>
        <button
          className="quiet-button"
          disabled={busy || item.mine}
          aria-pressed={item.vote === -1}
          title={item.mine ? "不能评价自己发布的方案" : "再次点击取消不推荐"}
          onClick={() => void vote(-1)}
        >
          ↓ 不推荐 {item.down ?? 0}
        </button>
        {busy && <output>正在保存评价…</output>}
      </fieldset>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
