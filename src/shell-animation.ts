import registry from "../data/shell-animations.json";

export type AnimationShell = { type: string; tntKg: number | null };
export type ShellAnimationAsset = (typeof registry.assets)[keyof typeof registry.assets];

/** Illustrations follow verified ammunition type, never a guessed vehicle/name. */
export function shellAnimation(shell: AnimationShell): ShellAnimationAsset | null {
  const entry = (registry.types as Record<string, string>)[shell.type];
  if (!entry) return null;
  let id = entry;
  if (entry === "solid-or-explosive") {
    if (shell.tntKg === null || !Number.isFinite(shell.tntKg)) return null;
    id = shell.tntKg > 0 ? "aphe" : "ap";
  }
  return (registry.assets as Record<string, ShellAnimationAsset>)[id] || null;
}

export function shellAnimationURL(file: string, fallback = false) {
  if (!/^[a-z0-9_-]+\.[a-f0-9]{16}\.(avif|mp4|webp)$/.test(file))
    throw Error("弹药动画资源地址无效");
  const path = `${registry.directory}/${file}`;
  return fallback
    ? `https://raw.githubusercontent.com/${registry.repository}/${registry.commit}/${path}`
    : `https://cdn.jsdelivr.net/gh/${registry.repository}@${registry.commit}/${path}`;
}
