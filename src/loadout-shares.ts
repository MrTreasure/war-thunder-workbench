import type { WikiWeaponParameter } from "./models";
import type { VehicleTileUnit } from "./VehicleTile";
import { loadoutRequest } from "./loadout-api";
import { validLoadoutPlan, type LoadoutPlan } from "./loadouts";
import type { TagChoice } from "./components/TagSelector";
export type LoadoutPreviewItem = {
  station: string;
  label: string;
  name: string;
  imageUrl: string | null;
  count: number | null;
  weightKg: number | null;
  parameters: WikiWeaponParameter[];
  source: string | null;
};
export type LoadoutPreview = { sourceChanged: boolean; items: LoadoutPreviewItem[] };
export type LoadoutShare = {
  quality?: import("./hall-quality").HallQuality;
  id: string;
  plan: LoadoutPlan;
  listed: boolean;
  createdAt: string;
  tags: TagChoice[];
  vehicle?: LoadoutVehicle;
  preview?: LoadoutPreview;
  up?: number;
  down?: number;
  vote?: number;
  mine?: boolean;
};
export type LoadoutVehicle = VehicleTileUnit & { country: string };
export async function readRemoteLoadout(id: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) throw Error("推荐记录无效，请返回大厅重新打开。");
  const value = await loadoutRequest<LoadoutShare>(`shares/${id}`, undefined, signal);
  if (!validLoadoutPlan(value.plan)) throw Error("远程挂载方案格式不正确。");
  return value.plan;
}
