import { statsAvailableRequests } from "./player-stats-api";
import { useEffect, useRef, useState } from "react";
import { statsDate, statsRequest } from "./player-stats-api";
import type { PlayerCandidate, PlayerProfile } from "./player-stats-api";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import type { Profile } from "./models";

type ImportedGarage = {
  id: string;
  uid: string;
  nickname: string;
  fetchedAt: string;
  vehicles: { id: string; country: string; category: string }[];
  ownedCount: number;
  unmatchedCount: number;
};
export function OwnedVehicleImport({
  country,
  category,
  current,
  onImport,
  onClear,
}: {
  country: string;
  category: string;
  current: Profile["ownedImport"];
  onImport: (garage: ImportedGarage) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const { session, refreshSession, identityVersion } = useWorkbenchAccount();
  const previousIdentity = useRef(identityVersion);
  const [candidates, setCandidates] = useState<PlayerCandidate[]>([]);
  const [queryId, setQueryId] = useState("");
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<{ snapshotId: string; requestId: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (previousIdentity.current === identityVersion) return;
    previousIdentity.current = identityVersion;
    controller.current?.abort();
    setBusy(false);
    setPlayer(null);
    setCandidates([]);
    setPending(null);
    setQueryId("");
  }, [identityVersion]);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setNotice("");
    try {
      await action(c.signal);
    } catch (e) {
      if (!c.signal.aborted) setNotice(e instanceof Error ? e.message : "车库导入失败，请重试。");
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        void refreshSession().catch(() => {});
      }
    }
  }
  const available = session ? statsAvailableRequests(session, "valuation") : 0;
  const remaining = !session ? "—" : available === null ? "不限次" : `${available} 次`;
  return (
    <div className="vehicle-garage-import">
      <div className="vehicle-import-actions">
        <button
          className="quiet-button"
          type="button"
          disabled={busy}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            setOpen(true);
            void run(async () => {
              await refreshSession();
            });
          }}
        >
          导入玩家已有载具
        </button>
        {current && (
          <button className="quiet-button" type="button" disabled={busy} onClick={onClear}>
            清除导入
          </button>
        )}
      </div>
      {current && (
        <p className="calc-note">
          {current.nickname} · 本国本军种 {current.ids.length} 辆 · 核验{" "}
          {statsDate(current.fetchedAt)}。清除仅移除导入记录，保留手动勾选。
        </p>
      )}
      {open && (
        <div className="vehicle-import-panel">
          <p className="calc-note">
            优先使用账号估值每日免费次数，用完后扣额外点数。可用次数 {remaining}
            ；失败不扣。搜索使用战绩查询额度，命中查询缓存不扣次。仅应用于当前国别和军种，包含未出战载具；导入后恢复自动等级计算，目标已研进度归零。
          </p>
          <label className="calc-field">
            游戏昵称
            <input
              value={nickname}
              maxLength={64}
              disabled={busy}
              placeholder="输入完整昵称"
              onChange={(e) => {
                setNickname(e.target.value);
                setPlayer(null);
                setCandidates([]);
                setPending(null);
              }}
            />
          </label>
          <button
            type="button"
            className="quiet-button"
            disabled={busy || !session || nickname.trim().length < 2}
            onClick={() =>
              void run(async (signal) => {
                setPlayer(null);
                setPending(null);
                const result = await statsRequest<{ queryId: string; items: PlayerCandidate[] }>(
                  "players/search",
                  { nickname: nickname.trim(), requestId: "query_" + crypto.randomUUID() },
                  signal,
                );
                setQueryId(result.queryId);
                setCandidates(result.items);
                if (!result.items.length) setNotice("没有找到玩家，请检查完整昵称及平台后缀。");
              })
            }
          >
            搜索玩家
          </button>
          <div className="vehicle-import-candidates">
            {candidates.map((candidate) => (
              <button
                type="button"
                className="quiet-button"
                key={candidate.uid}
                disabled={busy}
                aria-pressed={player?.uid === candidate.uid}
                onClick={() =>
                  void run(async (signal) => {
                    setPlayer(null);
                    setCandidates([candidate]);
                    setPending(null);
                    setPlayer(
                      await statsRequest<PlayerProfile>(
                        "players/select",
                        { queryId, uid: candidate.uid },
                        signal,
                      ),
                    );
                  })
                }
              >
                {candidate.nickname} · UID {candidate.uid}
              </button>
            ))}
          </div>
          {player && (
            <button
              type="button"
              className="quiet-button vehicle-import-confirm"
              disabled={busy}
              onClick={() =>
                void run(async (signal) => {
                  const intent = pending || {
                    snapshotId: player.snapshotId,
                    requestId: "owned_" + crypto.randomUUID(),
                  };
                  setPending(intent);
                  const garage = await statsRequest<ImportedGarage>(
                    "owned-imports",
                    intent,
                    signal,
                  );
                  onImport(garage);
                  setPending(null);
                  const count = garage.vehicles.filter(
                    (v) => v.country === country && v.category === category,
                  ).length;
                  setNotice(
                    `已导入 ${garage.nickname}：当前国别与军种匹配 ${count} 辆。${garage.unmatchedCount ? `资料库暂未识别 ${garage.unmatchedCount} 辆，未计入。` : ""}`,
                  );
                })
              }
            >
              导入 {player.nickname} 的车库（消耗 1 次）
            </button>
          )}
          {busy && <output className="calc-note">正在读取官方资料…</output>}
          {notice && <output className="calc-note">{notice}</output>}
        </div>
      )}
    </div>
  );
}
