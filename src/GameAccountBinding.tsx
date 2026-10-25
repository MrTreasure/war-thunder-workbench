import { statsAvailableRequests } from "./player-stats-api";
import { useEffect, useRef, useState } from "react";
import { useAccountWorkspace } from "./workspace-context";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { statsRequest, type PlayerProfile } from "./player-stats-api";
import { Modal } from "./Modal";

export function GameAccountBinding({ profile }: { profile: PlayerProfile }) {
  const workspace = useAccountWorkspace();
  const { session, refreshSession } = useWorkbenchAccount();
  const [open, setOpen] = useState(false),
    [uid, setUid] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(`bind_${crypto.randomUUID().replaceAll("-", "")}`);
  const current = workspace?.binding;
  const automaticRequest = useRef("");
  const [refreshError, setRefreshError] = useState("");
  const refreshBinding = workspace?.reload;
  useEffect(() => {
    if (
      !session?.user?.id ||
      !workspace?.ready ||
      !workspace.consented ||
      current?.uid !== profile.uid ||
      profile.localOnly
    )
      return;
    const key = `${session.user.id}:${profile.snapshotId}:${profile.fetchedAt}`;
    if (automaticRequest.current === key) return;
    automaticRequest.current = key;
    setRefreshError("");
    void statsRequest("account/game-binding/refresh", { snapshotId: profile.snapshotId })
      .then(() => refreshBinding?.())
      .catch(() => setRefreshError("车库更新暂不可用，已保留上次记录。"));
  }, [
    session?.user?.id,
    workspace?.ready,
    workspace?.consented,
    current?.uid,
    profile.uid,
    profile.snapshotId,
    profile.fetchedAt,
    profile.localOnly,
    refreshBinding,
  ]);
  if (!session?.user?.id || !workspace?.ready) return null;
  if (current)
    return current.uid === profile.uid && refreshError ? <output>{refreshError}</output> : null;
  const available = session ? statsAvailableRequests(session, "valuation") : 0;
  const remaining = !session ? "—" : available === null ? "不限次" : `${available} 次`;
  return (
    <>
      <button
        className="wt-record-link"
        disabled={profile.localOnly || busy}
        onClick={() => {
          if (!workspace.consented) {
            workspace.open();
            return;
          }
          setUid("");
          setError("");
          setOpen(true);
        }}
      >
        绑定游戏账号
      </button>
      {open && (
        <Modal
          title="绑定游戏账号"
          close={() => {
            if (!busy) setOpen(false);
          }}
          className="wt-account-dialog"
        >
          <form
            className="wt-account-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (uid !== profile.uid || busy) return;
              setBusy(true);
              setError("");
              try {
                await statsRequest("account/game-binding", {
                  uid: profile.uid,
                  ownerKey: "user:" + workspace.userId,
                  confirmedUid: uid,
                  snapshotId: profile.snapshotId,
                  requestId: request.current,
                });
                await workspace.reload();
                await refreshSession();
                setOpen(false);
                request.current = `bind_${crypto.randomUUID().replaceAll("-", "")}`;
              } catch (e) {
                setError(e instanceof Error ? e.message : "绑定失败，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              当前玩家：<strong>{profile.nickname}</strong>
              <br />
              UID：{profile.uid}
            </p>
            <p>
              请勿绑定他人游戏账号。绑定后将使用该账号的车库数据标记已拥有载具，并影响你的研发路线及研发点计算。此操作用于防止误绑，不代表官方身份认证。
            </p>
            <p>
              本次导入优先使用每日免费次数，用完后扣额外点数；同一请求重试不会重复扣次。可用次数：
              {remaining}
              。读取保存的关联车库不重复扣次。
            </p>
            <label>
              请重新输入当前玩家 UID 以确认
              <input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder={profile.uid}
                inputMode="numeric"
                autoComplete="off"
                maxLength={20}
                required
                disabled={busy}
              />
            </label>
            <small>
              黑桃在本站表示已拥有。公开车库以最近成功采集的时间为准，刷新失败会保留原数据。
            </small>
            {error && <p role="alert">{error}</p>}
            <div className="wt-account-actions">
              <button disabled={busy || uid !== profile.uid} type="submit">
                {busy ? "正在读取车库…" : "确认绑定"}
              </button>
              <button disabled={busy} type="button" onClick={() => setOpen(false)}>
                取消
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
const unlinkPhrase = "我再也不绑定别人的账号了";
export function UnlinkGameAccount({ close }: { close: () => void }) {
  const workspace = useAccountWorkspace();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  if (!workspace?.binding) return null;
  const binding = workspace.binding;
  return (
    <Modal
      title="解除游戏账号关联"
      close={() => {
        if (!busy) close();
      }}
      className="wt-account-dialog"
    >
      <form
        className="wt-account-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text !== unlinkPhrase || busy) return;
          setBusy(true);
          setError("");
          try {
            await statsRequest("account/game-binding/unlink", {
              uid: binding.uid,
              ownerKey: "user:" + workspace.userId,
              confirmation: text,
            });
            await workspace.reload();
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "解除失败，请重试。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          {binding.nickname} · UID {binding.uid}
        </p>
        <p>解除后，不再自动应用该账号的拥有载具。研发计划、购物车和出击队列会保留。</p>
        <label>
          请完整输入下方语句以确认：<strong>{unlinkPhrase}</strong>
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            placeholder={unlinkPhrase}
            required
            maxLength={40}
            disabled={busy}
          />
        </label>
        <small>必须逐字一致，不能省略或添加空格。提交后由服务端再次校验。</small>
        {error && <p role="alert">{error}</p>}
        <div className="wt-account-actions">
          <button type="submit" disabled={busy || text !== unlinkPhrase}>
            {busy ? "正在解除…" : "确认解除关联"}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  );
}
