import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerProfile, PlayerVehicle, StatsReport } from "../../../src/player-stats-api";
import { createVehicleCard } from "../../../src/player-vehicle-export";
import { createStatsReportImage } from "../../../src/player-report-export";
import { defaultReportTheme } from "../../../src/player-report-design";
import {
  defaultVehicleCardEra,
  vehicleCardBackgrounds,
  vehicleCardBackgroundUrls,
  type VehicleCardEra,
} from "../../../src/player-vehicle-background";
import reportAssets from "../../../data/player-report-assets.json";
import { GameSelect } from "../../../src/components/GameSelect";
import { DetailPage, ErrorNote } from "./ui";
import { shareReportPoster } from "./report-share";
import { sdk } from "./runtime";
export function AchievementShare({
  profile,
  vehicle,
  report,
  close,
}: {
  profile: PlayerProfile;
  vehicle?: PlayerVehicle;
  report?: StatsReport;
  close: () => void;
}) {
  const [era, setEra] = useState<VehicleCardEra>(
    vehicle ? defaultVehicleCardEra(vehicle) : "modern",
  );
  const [background, setBackground] = useState(reportAssets.backgrounds[0]?.id || "");
  const [busy, setBusy] = useState(false),
    [rendering, setRendering] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [image, setImage] = useState(""),
    [retry, setRetry] = useState(0),
    [aspect, setAspect] = useState(2 / 3);
  const [capturing, setCapturing] = useState(false);
  const capture = useRef<HTMLElement>(null);
  const poster = useRef<HTMLElement>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    let url = "";
    const terrain = reportAssets.backgrounds.find((v) => v.id === background);
    const result = vehicle
      ? createVehicleCard(profile, vehicle, c.signal, era)
      : report && terrain
        ? createStatsReportImage(report, terrain, defaultReportTheme, c.signal)
        : Promise.reject(Error("缺少战报数据，请返回后重试。"));
    void result
      .then((blob) => {
        if (c.signal.aborted) return;
        if (!blob) throw Error("战报图片生成未完成。");
        url = URL.createObjectURL(blob);
        setImage(url);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : "战报图片暂不可用。");
      })
      .finally(() => {
        if (!c.signal.aborted) setRendering(false);
      });
    return () => {
      c.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [profile, vehicle, report, era, background, retry]);
  function beginRendering() {
    setRendering(true);
    setImage("");
    setError("");
    setNotice("");
  }
  async function share() {
    if (busy || rendering || !image || !poster.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setCapturing(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!capture.current || !alive.current) throw Error("分享预览已关闭。");
      await shareReportPoster(sdk, capture.current, () => alive.current, { fullWindow: true });
      if (alive.current) setNotice("请在小黑盒分享面板确认保存或发布。");
    } catch (e) {
      if (alive.current)
        setError(
          (e as { code?: string })?.code === "METHOD_FORBIDDEN"
            ? "当前环境不支持原生截图分享，请在小黑盒手机 App 中打开。"
            : e instanceof Error
              ? e.message
              : "分享暂未完成，请重试。",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        setCapturing(false);
      }
    }
  }
  return (
    <DetailPage
      path={
        vehicle ? "#/stats/achievement/" + encodeURIComponent(vehicle.id) : "#/stats/report/share"
      }
      title={vehicle ? "载具成就" : "战报分享"}
      close={() => {
        alive.current = false;
        close();
      }}
    >
      <div className="hb-share-controls">
        <GameSelect
          disabled={busy || rendering}
          aria-label="战报背景"
          value={vehicle ? era : background}
          onValueChange={(v) => {
            if (v === (vehicle ? era : background)) return;
            beginRendering();
            if (vehicle) setEra(v as VehicleCardEra);
            else setBackground(v);
          }}
        >
          {vehicle
            ? Object.entries(vehicleCardBackgrounds).map(([id, v]) => (
                <option key={id} value={id}>
                  {v.label}
                </option>
              ))
            : reportAssets.backgrounds.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
        </GameSelect>
        <button
          className="hb-primary"
          disabled={busy || rendering || !image}
          onClick={() => void share()}
        >
          {busy ? "正在打开分享…" : "保存 / 分享战报"}
        </button>
      </div>
      <ErrorNote error={error} />
      {notice && <output>{notice}</output>}
      {rendering && <output>正在生成战报图片…</output>}
      {error && !image && (
        <button
          onClick={() => {
            beginRendering();
            setRetry((n) => n + 1);
          }}
        >
          重新生成
        </button>
      )}
      {image && (
        <div className="hb-share-preview">
          <article
            className="hb-achievement-poster"
            ref={poster}
            aria-label="战报图片预览"
            style={{ "--wt-poster-ratio": aspect } as React.CSSProperties}
          >
            <img
              className="hb-generated-report"
              src={image}
              alt={vehicle ? "载具成就卡" : "完整个人战报"}
              onLoad={(e) =>
                setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
              }
            />
            <div
              className="hb-achievement-watermark-reserve"
              aria-hidden="true"
              style={
                vehicle
                  ? { backgroundImage: `url("${vehicleCardBackgroundUrls[era]}")` }
                  : { backgroundColor: defaultReportTheme.base }
              }
            />
          </article>
        </div>
      )}
      {capturing &&
        image &&
        createPortal(
          <article
            className="hb-native-capture"
            ref={capture}
            aria-label="完整战报保存画布"
            style={{
              backgroundImage: `url("${vehicle ? vehicleCardBackgroundUrls[era] : reportAssets.backgrounds.find((v) => v.id === background)?.source || ""}")`,
            }}
          >
            <img src={image} alt={vehicle ? "完整载具成就卡" : "完整个人战报"} />
            <div
              className="hb-achievement-watermark-reserve"
              aria-hidden="true"
              style={{ background: "transparent" }}
            />
          </article>,
          document.body,
        )}
      <p className="hb-fine">保存及分享时，小黑盒会在底部空白处添加平台水印。</p>
    </DetailPage>
  );
}
