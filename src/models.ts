export type Mode = "ab" | "rb" | "sb";
export interface PackPrice {
  productId: string;
  title: string | null;
  currency: "CNY";
  amountCents: number | null;
  regularAmountCents: number | null;
  status: "priced" | "unavailable";
  reason?: "not_listed" | "no_cny_price";
  source: string;
  finalUrl: string;
  checkedAt: string;
  sha256: string;
}
export interface Vehicle {
  id: string;
  name: string;
  nameEn?: string;
  nameZhCN?: string | null;
  localizationKey?: string;
  req: string | null;
  premium: boolean;
  kind: string;
  role: string | null;
  br: Partial<Record<Mode | "trb" | "tsb", number>>;
  imageUrl: string;
  thumbnailUrl: string;
  price: number | null;
  packPrice?: PackPrice;
  store: string | null;
  market: string | null;
  side: "research" | "special";
  rank: string;
  rp?: number;
  rpCheckedAt?: string;
}
export interface TreeNode {
  id: string;
  name: string;
  nameEn?: string;
  nameZhCN?: string | null;
  localizationKey?: string;
  group: boolean;
  variant: boolean;
  row: number;
  column: number;
  req: string | null;
  members: Vehicle[];
}
export interface Rank {
  rank: string;
  research: TreeNode[];
  special: TreeNode[];
  rows: number;
}
export interface Tree {
  ranks: Rank[];
  columns: number;
  specialColumns: number;
  edges: { from: string; to: string; sourceReq: string }[];
  counts: { total: number; research: number; special: number; groups: number };
}
export interface PlanningData {
  source: string;
  sourceLabel: string;
  checkedAt: string;
  gates: Record<string, Record<string, Record<string, number>>>;
}
export interface LineupRules {
  schemaVersion: number;
  maxSlots: number;
  alphabet: string;
  emptyCode: string;
  countryCodes: Record<string, string>;
  airArcadeGapSteps: number;
  airArcadeMaxReductionSteps: number;
  navalAircraftMaxExtraSteps: number;
  sources: { url: string; note?: string }[];
}
export interface Catalog {
  lineup: LineupRules;
  schemaVersion: number;
  countries: Record<string, string>;
  categories: Record<string, string>;
  flags: Record<string, string>;
  checkedAt: string;
  sources: Record<string, { url: string; sha256: string }>;
  trees: Record<string, Record<string, Tree | null>>;
  planning: PlanningData;
  roles: Record<string, string>;
  kinds: Record<string, string>;
  lineupKinds: Record<string, string>;
}
export interface Modification {
  id: string;
  name: string;
  nameEn?: string;
  nameZhCN?: string | null;
  localizationKey?: string;
  rp: number | null;
}
export interface ModificationData {
  allUnlockedByDefault: boolean;
  unitId: string;
  totalRp: number | null;
  items: Modification[];
  itemSumRp: number;
  itemCostsComplete: boolean;
  status: "verified" | "unavailable";
  source: string;
  checkedAt: string;
  sha256: string;
}
export type Modifications = Record<string, ModificationData>;
export interface Profile {
  target: string;
  owned: string[];
  ownedImport?: { ids: string[]; uid: string; nickname: string; fetchedAt: string };
  pins: string[];
  banned: string[];
  costs: Record<string, number>;
  gates: Record<string, number>;
  unlocked: number;
  progress: number;
  price: string;
}
export interface IndexedVehicle extends Vehicle {
  rankNumber: number;
  node: TreeNode;
}
export interface CartLine {
  key: string;
  unitId: string;
  name: string;
  nameEn?: string;
  nameZhCN?: string | null;
  localizationKey?: string;
  rp: number;
  rateCents: number;
  kind: "vehicle" | "modifications";
  country: string;
  category: string;
  remainingBefore: number;
  basis: string;
}
export interface CartItem {
  id: string;
  title: string;
  kind: "vehicle" | "modifications";
  createdAt: string;
  dataVersion: string;
  lines: CartLine[];
  details: string;
  fingerprint: string;
}

export interface CatalogIndex extends Omit<Catalog, "trees"> {
  availability: Record<string, Record<string, boolean>>;
}
export interface CountryPayload {
  schemaVersion: 2;
  country: string;
  checkedAt: string;
  trees: Record<string, Tree | null>;
  modifications: Modifications;
  lineupCodes: Record<string, string>;
}
export interface DataManifest {
  schemaVersion: 3;
  countries: Record<string, import("./data-loader").DataFile>;
}
