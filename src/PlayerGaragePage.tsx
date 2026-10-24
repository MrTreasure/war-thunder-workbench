import { localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useAccountWorkspace } from "./workspace-context";
import { LineupNavigation } from "./components/LineupNavigation";
import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { prepareStatsDevice, statsRequest } from "./player-stats-api";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { PlayerGarage, PlayerVehicleDetails } from "./PlayerGarage";

export function PlayerGaragePage() {
  useLocale();

  const { identityVersion, session, busy, login } = useWorkbenchAccount();
  const workspace = useAccountWorkspace();
  const search = useSearch({ from: "/_workbench/lineups_/garage" });
  if (!session?.user?.id)
    return (
      <main className="wt-record-page wt-garage-page">
        <LineupNavigation garage />
        <section className="wt-record-panel wt-garage-login">
          <h1>{t("我的车库")}</h1>
          <p>{t("登录后可查看关联游戏账号的完整车库。")}</p>
          <button disabled={busy} onClick={() => void login()}>
            {localize(busy ? t("正在读取账号…") : t("登录并查看车库"))}
          </button>
        </section>
      </main>
    );
  return (
    <GaragePageContent
      key={`${identityVersion}:${workspace?.binding?.uid || ""}:${search.uid}:${search.snapshot}`}
      {...search}
    />
  );
}
function GaragePageContent({ snapshot, uid }: { snapshot?: string; uid?: string }) {
  useLocale();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<PlayerVehicle | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void prepareStatsDevice(c.signal)
      .then(() =>
        snapshot && uid
          ? statsRequest<PlayerProfile>("players/restore", { snapshotId: snapshot, uid }, c.signal)
          : statsRequest<PlayerProfile>("account/game-binding/profile", undefined, c.signal),
      )
      .then((value) => {
        if (uid && value.uid !== uid) throw Error(t("玩家资料身份不一致，请返回战绩页重新查询。"));
        if (!c.signal.aborted) setProfile(value);
      })
      .catch((reason) => {
        if (!c.signal.aborted)
          setError(reason instanceof Error ? reason.message : t("车库读取失败，请稍后重试。"));
      });
    return () => c.abort();
  }, [snapshot, uid, attempt]);
  return (
    <main className="wt-record-page wt-garage-page">
      <LineupNavigation garage />
      <header className="wt-garage-page-heading">
        <div>
          <p className="wt-garage-eyebrow">{t("出击队列 / 我的车库")}</p>
          <h1>{profile ? t("{0} · 完整车库", [profile.nickname]) : t("完整车库")}</h1>
        </div>
        <Link className="wt-garage-back" to="/lineups">
          {t("← 返回出击队列")}
        </Link>
      </header>
      {localize(
        error ? (
          <div className="wt-rank-error" role="alert">
            <span>{localize(error)}</span>
            <button
              onClick={() => {
                setError("");
                setAttempt((v) => v + 1);
              }}
            >
              {t("重试")}
            </button>
            <Link to="/stats">{t("查询并关联游戏账号 ↗")}</Link>
          </div>
        ) : !profile ? (
          <output className="wt-rank-loading">{t("正在读取完整车库…")}</output>
        ) : (
          <div hidden={selected !== null}>
            <PlayerGarage profile={profile} selectVehicle={setSelected} />
          </div>
        ),
      )}
      {localize(
        profile && selected && (
          <PlayerVehicleDetails
            profile={profile}
            vehicle={selected}
            close={() => setSelected(null)}
            inline
          />
        ),
      )}
    </main>
  );
}
