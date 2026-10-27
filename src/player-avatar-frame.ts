import registry from "../data/player-avatar-frames.json";

const frames = new Map(registry.items.map((frame) => [frame.id, frame]));

/** Only verified original game assets from the fixed registry may be displayed. */
export function playerAvatarFrame(key?: string | null) {
  return key ? frames.get(key) || null : null;
}
