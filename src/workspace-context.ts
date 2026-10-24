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
  /^(wt-workbench-cart-v1|wt-planner-v1:(ground|aviation|helicopters|ships|boats):(usa|germany|ussr|britain|japan|italy|france|china|sweden|israel)|wt-lineups-v1:(usa|germany|ussr|britain|japan|italy|france|china|sweden|israel))$/.test(
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
export const WorkspaceContext = createContext<Workspace | null>(null);
export const useAccountWorkspace = () => useContext(WorkspaceContext);
