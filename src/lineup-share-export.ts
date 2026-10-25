import staticAssets from "../data/player-report-static-assets.json";
import fontUrl from "./assets/FiraSansCondensed-Regular.ttf?url";
import symbolUrl from "./assets/WTSymbols.ttf?url";
import { communityRules } from "./lineup-community-api";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片资源读取失败。"));
    reader.readAsDataURL(blob);
  });
}
/** Browser-only snapshot of the actual shared VehicleTile DOM, with embedded,
 * anonymous CORS assets and same-origin fonts. No upload or image persistence. */
export async function exportLineupImage(source: HTMLElement, signal: AbortSignal): Promise<Blob> {
  if (source.querySelector(".unit-art-unavailable"))
    throw new Error("有载具图片尚未读取成功，请等待图片恢复后导出。");
  await document.fonts.load("16px WTCard");
  await document.fonts.ready;
  signal.throwIfAborted();
  const width = Math.ceil(source.getBoundingClientRect().width),
    height = Math.ceil(source.getBoundingClientRect().height);
  if (width > 2200 || height > 1600 || !source.querySelector(".wt-game-card"))
    throw new Error("分享图片尺寸不正确。");
  const clone = source.cloneNode(true) as HTMLElement;
  const originals: Element[] = [source, ...source.querySelectorAll("*")];
  const copies: Element[] = [clone, ...clone.querySelectorAll("*")];
  const assets = new Map<string, Promise<string>>();
  const embed = (raw: string) => {
    const url = new URL(raw, location.href);
    if (url.protocol === "data:") return Promise.resolve(raw);
    if (
      url.origin !== location.origin &&
      ![
        "static.encyclopedia.warthunder.com",
        "staticfiles.warthunder.com",
        "wiki.warthunder.com",
        "cdn-live.warthunder.com",
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
      ].includes(url.hostname)
    )
      throw new Error("分享素材来源不受支持。");
    const key = url.href;
    let request = assets.get(key);
    if (!request) {
      request = (async () => {
        const flag = Object.values(staticAssets.assets.flag).find((entry) => entry.source === key);
        const expected =
          flag || (key === communityRules.officialTag.url ? communityRules.officialTag : null);
        const sources = flag ? [flag.url, flag.fallbackUrl] : [key];
        for (const asset of sources) {
          try {
            const response = await fetch(asset, {
              credentials: "omit",
              cache: "force-cache",
              signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
            });
            if (!response.ok) throw new Error("素材读取失败");
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length > 8 * 1024 * 1024) throw new Error("分享素材尺寸超出限制。");
            if (
              expected &&
              (bytes.length !== expected.bytes || bytesToHex(sha256(bytes)) !== expected.sha256)
            )
              throw new Error("素材校验失败");
            return dataURL(
              new Blob([bytes], {
                type:
                  response.headers.get("Content-Type")?.split(";")[0] || "application/octet-stream",
              }),
            );
          } catch (error) {
            if (signal.aborted) throw error;
          }
        }
        throw new Error(
          flag ? "国旗素材读取失败，请稍后重试。" : "官方分享素材读取失败，请稍后重试。",
        );
      })();
      assets.set(key, request);
    }
    return request;
  };
  async function embedStyle(element: HTMLElement) {
    const raw = element.getAttribute("style") || "";
    const matches = [...raw.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
    const urls = await Promise.all(matches.map((m) => embed(m[1])));
    let next = raw;
    matches.forEach((match, index) => {
      next = next.replace(match[0], `url("${urls[index]}")`);
    });
    element.setAttribute("style", next);
  }
  const pending: Promise<unknown>[] = [];
  originals.forEach((original, index) => {
    const target = copies[index] as HTMLElement;
    const computed = getComputedStyle(original);
    for (const key of computed) {
      if (!key.startsWith("--")) target.style.setProperty(key, computed.getPropertyValue(key));
    }
    target.style.setProperty("animation", "none");
    target.style.setProperty("transition", "none");
    target.removeAttribute("id");
    target.removeAttribute("title");
    for (const attribute of [...target.attributes])
      if (attribute.name.startsWith("on")) target.removeAttribute(attribute.name);
    if (original instanceof HTMLImageElement && target instanceof HTMLImageElement) {
      const url = original.currentSrc || original.src;
      target.removeAttribute("loading");
      target.removeAttribute("srcset");
      pending.push(
        embed(url).then((value) => {
          target.src = value;
        }),
      );
    }
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(original, pseudo);
      if (style.content === "none" || style.content === "normal" || style.display === "none")
        continue;
      const span = document.createElement("span");
      for (const key of style) {
        if (!key.startsWith("--")) span.style.setProperty(key, style.getPropertyValue(key));
      }
      span.style.removeProperty("content");
      const content = style.content;
      if (content.startsWith('"')) {
        try {
          span.textContent = JSON.parse(content);
        } catch {
          throw new Error("分享图标读取失败。");
        }
      }
      if (pseudo === "::before") target.prepend(span);
      else target.append(span);
      pending.push(embedStyle(span));
    }
    pending.push(embedStyle(target));
  });
  const [font, symbols] = await Promise.all([embed(fontUrl), embed(symbolUrl), ...pending]);
  signal.throwIfAborted();
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const body = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>@font-face{font-family:WTCard;src:url(${font});font-weight:400}@font-face{font-family:WTSymbols;src:url(${symbols});unicode-range:U+22E0,U+2417,U+2419,U+2420,U+2580,U+2582-2585,U+25C4,U+25CA-25CD,U+25D0,U+25D4,U+25D7-25D8,U+25E1-25E2,U+25E5,U+F059}</style><foreignObject width="100%" height="100%">${body}</foreignObject></svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片导出。");
  context.scale(2, 2);
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("图片合成失败。"))),
      "image/png",
    ),
  );
}
