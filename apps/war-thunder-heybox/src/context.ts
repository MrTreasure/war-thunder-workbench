import { createContext, useContext } from "react";
import type { AccountView } from "./account";
import type { GameBinding, WorkspaceDocument } from "../../../src/workspace-context";
export type Cloud = {
  ownerKey: string;
  version: string;
  consented: boolean;
  notice: string;
  documents: WorkspaceDocument[];
  binding: GameBinding | null;
};
export const RuntimeContext = createContext<{
  view: AccountView;
  ready: boolean;
  cloud: Cloud | null;
  reloadCloud: () => Promise<void>;
  openAccount: () => void;
} | null>(null);
export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw Error("Missing runtime");
  return value;
}

export type ResearchIntent = { country: string; category: string; target: string; serial: number };
