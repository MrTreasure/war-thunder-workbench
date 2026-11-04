import { useEffect, useRef, useState } from "react";
import { shellAnimation, shellAnimationURL } from "./shell-animation";
import type { AnimationShell, ShellAnimationAsset } from "./shell-animation";
import "./shell-animation.css";

/** Only mounted in the selected ammunition's detail; no gallery or list previews. */
export function ShellAnimation({ shell }: { shell: AnimationShell }) {
  const asset = shellAnimation(shell);
  return asset ? <Animation key={asset.avif.sha256} asset={asset} type={shell.type} /> : null;
}

function Animation({ asset, type }: { asset: ShellAnimationAsset; type: string }) {
  const host = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [foreground, setForeground] = useState(!document.hidden);
  const [videoFallback, setVideoFallback] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [settled, setSettled] = useState<{ key: string; state: "ready" | "error" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const active = !reducedMotion && visible && foreground;
  const file = !active ? asset.poster.file : videoFallback ? asset.mp4.file : asset.avif.file;
  const url = shellAnimationURL(file, fallback);
  const mediaKey = `${url}:${attempt}`;
  const status = settled?.key === mediaKey ? settled.state : "loading";
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", change);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => setReducedMotion(motion.matches);
    motion.addEventListener("change", reduce);
    return () => {
      document.removeEventListener("visibilitychange", change);
      motion.removeEventListener("change", reduce);
    };
  }, []);
  function failed() {
    if (!fallback) {
      setFallback(true);
    } else if (active && !videoFallback) {
      setVideoFallback(true);
      setFallback(false);
    } else setSettled({ key: mediaKey, state: "error" });
  }
  function retry() {
    setSettled(null);
    setFallback(false);
    setAttempt((value) => value + 1);
  }
  return (
    <section ref={host} className="wt-shell-animation" aria-label={`${type} 弹药作用原理`}>
      <h4 className="wt-shell-animation-heading">{type} · 作用原理</h4>
      <div
        className="wt-shell-animation-frame"
        style={{ aspectRatio: `${asset.width}/${asset.height}` }}
      >
        {status === "error" ? (
          <output className="wt-shell-animation-message">
            <span>动图暂时无法加载</span>
            <button type="button" onClick={retry}>
              重试
            </button>
          </output>
        ) : active && videoFallback ? (
          <video
            key={mediaKey}
            src={url}
            width={asset.width}
            height={asset.height}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label={`${type} 弹药作用原理动画`}
            onLoadedData={() => setSettled({ key: mediaKey, state: "ready" })}
            onError={failed}
          />
        ) : (
          <img
            key={mediaKey}
            src={url}
            width={asset.width}
            height={asset.height}
            alt={`${type} 弹药作用原理示意`}
            loading="lazy"
            decoding="async"
            onLoad={() => setSettled({ key: mediaKey, state: "ready" })}
            onError={failed}
          />
        )}
        {status === "loading" && (
          <output className="wt-shell-animation-loading">正在加载原理图…</output>
        )}
      </div>
    </section>
  );
}
