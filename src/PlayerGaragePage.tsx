import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { prepareStatsDevice, statsRequest } from "./player-stats-api";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { PlayerGarage, PlayerVehicleDetails } from "./PlayerGarage";

export function PlayerGaragePage() {
  const { identityVersion } = useWorkbenchAccount();
  const search = useSearch({ from: "/_workbench/stats_/garage" });
  return (
    <GaragePageContent key={`${identityVersion}:${search.uid}:${search.snapshot}`} {...search} />
  );
}
function GaragePageContent({ snapshot, uid }: { snapshot?: string; uid?: string }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<PlayerVehicle | null>(null);
  useEffect(() => {
    if (!snapshot || !uid) return;
    const c = new AbortController();
    void prepareStatsDevice(c.signal)
      .then(() =>
        statsRequest<PlayerProfile>("players/restore", { snapshotId: snapshot, uid }, c.signal),
      )
      .then((value) => {
        if (value.uid !== uid) throw Error("玩家资料身份不一致，请返回战绩页重新查询。");
        if (!c.signal.aborted) setProfile(value);
      })
      .catch((reason) => {
        if (!c.signal.aborted)
          setError(reason instanceof Error ? reason.message : "车库读取失败，请稍后重试。");
      });
    return () => c.abort();
  }, [snapshot, uid, attempt]);
  return (
    <main className="wt-record-page wt-garage-page">
      <header className="wt-garage-page-heading">
        <div>
          <p className="wt-garage-eyebrow">玩家档案 / 车库</p>
          <h1>{profile ? `${profile.nickname} · 完整车库` : "完整车库"}</h1>
        </div>
        <Link
          className="wt-garage-back"
          to="/stats"
          search={profile ? { snapshot: profile.snapshotId, uid: profile.uid } : {}}
        >
          ← 返回战绩
        </Link>
      </header>
      {!snapshot || !uid ? (
        <p className="wt-record-empty">请先查询玩家，再从战绩页打开完整车库。</p>
      ) : error ? (
        <div className="wt-rank-error" role="alert">
          <span>{error}</span>
          <button
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            重试
          </button>
        </div>
      ) : !profile ? (
        <output className="wt-rank-loading">正在读取完整车库…</output>
      ) : (
        <PlayerGarage profile={profile} selectVehicle={setSelected} />
      )}
      {profile && selected && (
        <PlayerVehicleDetails
          profile={profile}
          vehicle={selected}
          close={() => setSelected(null)}
        />
      )}
    </main>
  );
}
