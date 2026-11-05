import { useEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { canUseTestFeatures } from "./application-access";
import { statsRequest } from "./player-stats-api";
import "./tank-weakpoints.css";
import { weakpointShellDocument, weakpointDisplayResources } from "./weakpoint-shell";
import { VideoAnalysisLibrary } from "./VideoAnalysisLibrary";

type Payload = { schema: number; models: { id: string }[] };
export function TankWeakpoints() {
  const account = useWorkbenchAccount();
  const allowed = canUseTestFeatures(account.session);
  const { vehicle, video } = useSearch({ from: "/_workbench/weakpoints" });
  const [loaded, setLoaded] = useState<{
    key: string;
    payload: Payload | null;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState(1000);
  const frame = useRef<HTMLIFrameElement>(null);
  const identity = account.session?.user?.id;
  const requestKey = `${identity || "guest"}:${account.identityVersion}:${attempt}`;
  const payload = loaded?.key === requestKey ? loaded.payload : null;
  const error = loaded?.key === requestKey ? loaded.error : "";
  useEffect(() => {
    if (!allowed || account.initializing) return;
    const controller = new AbortController();
    void statsRequest<Payload>("weakpoints/data", undefined, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(value.models) || value.models.length > 500)
          throw Error("弱点资料格式不正确");
        setLoaded({ key: requestKey, payload: weakpointDisplayResources(value), error: "" });
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({
            key: requestKey,
            payload: null,
            error: failure instanceof Error ? failure.message : "弱点资料加载失败",
          });
      });
    return () => controller.abort();
  }, [allowed, account.initializing, requestKey]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "wt-weakpoints-ready" && payload)
        frame.current?.contentWindow?.postMessage(
          { type: "wt-weakpoints-data", payload },
          location.origin,
        );
      if (event.data?.type === "wt-weakpoints-height" && Number.isFinite(event.data.height))
        setHeight(Math.max(500, Math.min(24000, event.data.height)));
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [payload]);
  if (account.initializing) return <output className="weakpoints-access">正在检查访问权限…</output>;
  if (!allowed)
    return (
      <section className="weakpoints-access">
        <h2>坦克弱点 · 测试功能</h2>
        <p>此功能面向测试用户、应用管理员及超级管理员开放。</p>
        {!account.session?.user && (
          <button type="button" disabled={account.busy} onClick={() => void account.login()}>
            登录账号
          </button>
        )}
      </section>
    );
  const library = (
    <VideoAnalysisLibrary
      key={`${identity}:${account.identityVersion}:${video ?? ""}`}
      video={video}
    />
  );
  if (error)
    return (
      <>
        {library}
        <section className="weakpoints-access" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            重试加载
          </button>
        </section>
      </>
    );
  if (!payload)
    return (
      <>
        {library}
        <output className="weakpoints-access">正在加载弱点资料…</output>
      </>
    );
  return (
    <>
      {library}
      <iframe
        key={requestKey}
        className="tank-weakpoints-frame"
        ref={frame}
        title="坦克弱点与绿色区域清单"
        srcDoc={weakpointShellDocument(vehicle)}
        style={{ height }}
        onLoad={() =>
          frame.current?.contentWindow?.postMessage(
            { type: "wt-weakpoints-data", payload },
            location.origin,
          )
        }
      />
    </>
  );
}
