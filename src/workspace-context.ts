import { createContext, useContext } from "react";
export type WorkspaceDocument = { key: string; value: unknown; revision: number };
export type GameBinding = {
  uid: string;
  nickname: string;
  fetchedAt: string;
  linkedAt: string;
  unmatchedCount: number;
  vehicles: { id: string; country: string; category: string }[];
};
export const workspaceKey = (key: string) =>
  /^(wt-sale-watch-v1|wt-workbench-cart-v1|wt-planner-v1:(ground|aviation|helicopters|ships|boats):(usa|germany|ussr|britain|japan|italy|france|china|sweden|israel)|wt-lineups-v1:(usa|germany|ussr|britain|japan|italy|france|china|sweden|israel))$/.test(
    key,
  );
export type Workspace = {
  userId: string;
  ready: boolean;
  consented: boolean;
  documents: Record<string, WorkspaceDocument>;
  binding: GameBinding | null;
  ownedVehicleIds: ReadonlySet<string>;
  status: string;
  error: string;
  save: (key: string, value: unknown) => void;
  reload: () => Promise<void>;
  open: () => void;
};
/** One account's synchronization controller can restart without remounting pages. */
export function createWorkspaceStore(userId: string) {
  let snapshot: Workspace | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (next: Workspace) => {
      if (next.userId !== userId) throw Error("云端数据所属账号不一致。");
      if (snapshot === next) return;
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export const useAccountWorkspace = () => useContext(WorkspaceContext);
