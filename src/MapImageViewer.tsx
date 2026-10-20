import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { loadMapImage } from "./map-image-cache";
import type { AtlasImage } from "./map-image-cache";

export function MapImageViewer({
  image,
  side,
  children,
  close,
}: {
  image: AtlasImage;
  side: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [url, setUrl] = useState(image.thumb);
  const [received, setReceived] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [bounds, setBounds] = useState({ width: 800, height: 600 });
  const [natural, setNatural] = useState({ width: 1600, height: 1200 });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    loadMapImage(image, controller.signal, setReceived)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoaded(true);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "高清图暂时无法读取");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image, retry]);
  const ratio = Math.min(bounds.width / natural.width, bounds.height / natural.height, 1) * zoom;
  return (
    <Modal
      className="atlas-image-dialog"
      title={`${image.name} · ${side}`}
      subtitle={image.kind === "原图" ? "地图底图，走线标注请对照原帖" : "作者走线标注图"}
      close={close}
    >
      <div className="atlas-viewer-toolbar">
        <div className="atlas-side-tabs">{children}</div>
        <div className="atlas-zoom-actions">
          <button
            onClick={() => setZoom((v) => Math.max(0.5, v / 1.5))}
            disabled={zoom <= 0.5}
            aria-label="缩小地图"
          >
            −
          </button>
          <button
            onClick={() => {
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            适应屏幕
          </button>
          <button
            onClick={() => setZoom((v) => Math.min(8, v * 1.5))}
            disabled={zoom >= 8}
            aria-label="放大地图"
          >
            ＋
          </button>
        </div>
      </div>
      <div
        className="atlas-image-viewport"
        ref={viewport}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
          event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="atlas-image-stage"
          style={{
            width: Math.ceil(natural.width * ratio),
            height: Math.ceil(natural.height * ratio),
          }}
        >
          <img
            src={url}
            alt={`${image.name} ${side}${image.kind}`}
            draggable={false}
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        </div>
      </div>
      <output className="atlas-viewer-status">
        <span>
          {error ||
            (loaded
              ? "高清图已就绪 · 放大后可拖动或滑动查看"
              : `正在读取高清图 ${(received / 1048576).toFixed(1)} / ${(image.size / 1048576).toFixed(1)} MB`)}
        </span>
        {error && (
          <button
            onClick={() => {
              setError("");
              setReceived(0);
              setLoaded(false);
              setRetry((v) => v + 1);
            }}
          >
            重试
          </button>
        )}
        <a href={image.image} target="_blank" rel="noreferrer">
          打开原图 ↗
        </a>
      </output>
    </Modal>
  );
}
