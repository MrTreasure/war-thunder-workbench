import { vehicleDisplayName } from "./vehicle-display-name";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { defaultVehicleCardEra, vehicleCardBackgrounds } from "./player-vehicle-background";
import type { VehicleCardEra } from "./player-vehicle-background";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { copyVehicleCard, createVehicleCard, downloadVehicleCard } from "./player-vehicle-export";

export type VehicleShareJob = {
  era: VehicleCardEra;
  controller: AbortController;
  image: Promise<Blob>;
  clipboard: Promise<void>;
};
export function startVehicleShare(
  profile: PlayerProfile,
  vehicle: PlayerVehicle,
  era = defaultVehicleCardEra(vehicle),
): VehicleShareJob {
  const controller = new AbortController();
  const image = createVehicleCard(profile, vehicle, controller.signal, era);
  const clipboard = copyVehicleCard(image);
  // Permission failures can arrive before React mounts the preview.
  image.catch(() => {});
  clipboard.catch(() => {});
  return { era, controller, image, clipboard };
}
export function PlayerVehicleShare({
  profile,
  vehicle,
  job,
  close,
  back,
}: {
  profile: PlayerProfile;
  vehicle: PlayerVehicle;
  job: VehicleShareJob;
  close: () => void;
  back: () => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("生成后将尝试复制图片。");
  const [copying, setCopying] = useState(false);
  const [activeJob, setActiveJob] = useState(job);
  const alive = useRef(true);
  const currentJob = useRef(activeJob);
  useEffect(() => {
    let active = true,
      imageUrl = "";
    alive.current = true;
    currentJob.current = activeJob;
    activeJob.image
      .then((image) => {
        if (!active) return;
        imageUrl = URL.createObjectURL(image);
        setUrl(imageUrl);
        setBlob(image);
      })
      .catch((cause) => {
        if (active && !activeJob.controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "卡片生成失败，请返回详情重试。");
      });
    activeJob.clipboard
      .then(() => {
        if (active) setMessage("图片已复制，可直接粘贴分享。");
      })
      .catch(() => {
        if (active) setMessage("自动复制未完成，请点击复制图片，或下载 PNG。");
      });
    return () => {
      active = false;
      alive.current = false;
      // StrictMode replays setup immediately; only abort after a real unmount.
      queueMicrotask(() => {
        if (!alive.current || currentJob.current !== activeJob) activeJob.controller.abort();
      });
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [activeJob]);
  const changeEra = (era: string) => {
    if (!(era in vehicleCardBackgrounds) || era === activeJob.era) return;
    activeJob.controller.abort();
    setBlob(null);
    setUrl("");
    setError("");
    setMessage("生成后将尝试复制图片。");
    const next = startVehicleShare(profile, vehicle, era as VehicleCardEra);
    currentJob.current = next;
    setActiveJob(next);
  };
  const copy = async () => {
    if (!blob) return;
    setCopying(true);
    try {
      await copyVehicleCard(blob);
      if (alive.current) setMessage("图片已复制，可直接粘贴分享。");
    } catch {
      if (alive.current) setMessage("复制被浏览器阻止，请允许剪贴板权限或下载 PNG。");
    } finally {
      if (alive.current) setCopying(false);
    }
  };
  return (
    <Modal title="载具战绩卡片" close={close} className="wt-owned-garage wt-vehicle-share-dialog">
      <div className="wt-vehicle-share-background">
        <span>背景</span>
        <GameSelect aria-label="载具卡片背景" value={activeJob.era} onValueChange={changeEra}>
          {Object.entries(vehicleCardBackgrounds).map(([id, item]) => (
            <option value={id} key={id}>
              {item.label}
            </option>
          ))}
        </GameSelect>
        <small>可自由切换时代风格</small>
      </div>
      <div className="wt-vehicle-share-preview" aria-busy={!url && !error}>
        {url ? (
          <img
            src={url}
            alt={`${profile.nickname} · ${vehicleDisplayName(vehicle.name)} · ${vehicle.mode.toUpperCase()} 战绩卡片`}
          />
        ) : (
          <div className="wt-vehicle-share-loading" role={error ? "alert" : "status"}>
            <strong>{error ? "生成未完成" : "正在制作卡片"}</strong>
            <p>{error || "正在读取游戏原图与背景，请稍候…"}</p>
          </div>
        )}
      </div>
      <div className="wt-vehicle-share-actions">
        <output>{error ? "返回详情后可重新生成。" : message}</output>
        <div>
          <button onClick={back}>返回详情</button>
          <button disabled={!blob || copying} onClick={copy}>
            {copying ? "正在复制…" : "复制图片"}
          </button>
          <button
            className="wt-vehicle-share-primary"
            disabled={!blob}
            onClick={() => blob && downloadVehicleCard(blob, profile, vehicle)}
          >
            下载 PNG
          </button>
        </div>
      </div>
    </Modal>
  );
}
