import { useState } from "react";
import type { ImgHTMLAttributes, SVGProps } from "react";
// Keep primary images in GitHub, with independent alternatives for failed connections.
export type GroundImageAsset = { url: string; rawUrl?: string; fallbackUrl?: string };
export const assetSources = (asset: GroundImageAsset) => [
  ...new Set([asset.url, asset.rawUrl, asset.fallbackUrl].filter((s): s is string => !!s)),
];
export function GroundThumbnail({
  asset,
  alt,
  ...props
}: { asset: GroundImageAsset } & ImgHTMLAttributes<HTMLImageElement>) {
  const [source, setSource] = useState(0);
  const sources = assetSources(asset);
  return (
    <img
      {...props}
      alt={alt ?? "地图点位缩略图"}
      src={sources[source]}
      onError={() => {
        if (source + 1 < sources.length) setSource(source + 1);
      }}
    />
  );
}
export function GroundSvgImage({
  asset,
  onFailure,
  ...props
}: { asset: GroundImageAsset; onFailure?: () => void } & SVGProps<SVGImageElement>) {
  const [source, setSource] = useState(0);
  const sources = assetSources(asset);
  return (
    <image
      {...props}
      href={sources[source]}
      onError={() => {
        if (source + 1 < sources.length) setSource(source + 1);
        else onFailure?.();
      }}
    />
  );
}

export function rotateAsset(asset: GroundImageAsset, choice: number): GroundImageAsset {
  const sources = assetSources(asset);
  return {
    url: sources[choice % sources.length],
    rawUrl: sources[(choice + 1) % sources.length],
    fallbackUrl: sources[(choice + 2) % sources.length],
  };
}
