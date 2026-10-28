export type Mode = "ab" | "rb" | "sb";
export type VehiclePerformanceStage = "stock" | "spaded" | "expert" | "ace";
export type VehicleReferenceStatus =
  | "available"
  | "none"
  | "not_provided"
  | "parse_failed"
  | "not_collected"
  | "not_applicable";
export interface WikiReferenceSource {
  schemaVersion: 1;
  vehicleId: string;
  source: string;
  checkedAt: string;
  htmlSha256: string;
  parserVersion: string;
  status: VehicleReferenceStatus;
}
export interface WikiPerformanceMetric {
  id: string;
  label: string;
  unit: string;
  altitudeM: number | null;
  crewDependent: boolean;
  weaponName?: string | null;
  direction?: "higher" | "lower" | null;
  modes: Partial<Record<"ab" | "rb", Record<VehiclePerformanceStage, number | null>>>;
  sourceBasis: Partial<Record<VehiclePerformanceStage, string | null>>;
}
export interface WikiPerformance extends WikiReferenceSource {
  metrics: WikiPerformanceMetric[];
}
export interface WikiWeaponParameter {
  id: string;
  label: string;
  value: string;
}
export interface WikiLoadoutOption {
  optionId: string;
  weaponId: string | null;
  name: string;
  count?: number | null;
  source?: string | null;
  imageUrl?: string | null;
  weightKg: number | null;
  stations: { hardpointId: string; count: number | null }[];
  parameters: WikiWeaponParameter[];
}
export interface WikiLoadouts extends WikiReferenceSource {
  limits: { id: string; label: string; value: number | null; unit: string }[];
  presets: {
    id: string;
    label: string;
    items: {
      name: string;
      count: number | null;
      weaponId: string | null;
      source?: string | null;
      imageUrl?: string | null;
      parameters?: WikiWeaponParameter[];
    }[];
  }[];
  hardpoints: { id: string; label: string; side?: "left" | "right" | "center" | null }[];
  compatibility: WikiLoadoutOption[];
}
export interface WikiVehicleDetails {
  performance?: WikiPerformance;
  loadouts?: WikiLoadouts;
  rewardStatus?: { state: "not_listed"; source: string; checkedAt: string; sha256: string };
  purchase?: {
    currency: "SL" | "GE";
    amount: number;
    source: string;
    checkedAt: string;
    sha256: string;
  };
  rewards?: {
    source: string;
    checkedAt: string;
    sha256: string;
    rp: {
      factor: number;
      basePercent: Partial<Record<Mode, number>>;
      percent: Partial<Record<Mode, number>>;
    };
    sl: {
      factor: number;
      basePercent: Partial<Record<Mode, number>>;
      percent: Partial<Record<Mode, number>>;
    };
  };
}
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
  wikiDetails?: WikiVehicleDetails;
  id: string;
  name: string;
  nameEn?: string;
  nameRu?: string | null;
  nameJa?: string | null;
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
  nameRu?: string | null;
  nameJa?: string | null;
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
  matchmakingSpreadSteps: number;
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
  imageUrl?: string;
  tier?: number;
  position?: { group: number; row: number; column: number };
  id: string;
  name: string;
  nameEn?: string;
  nameRu?: string | null;
  nameJa?: string | null;
  nameZhCN?: string | null;
  localizationKey?: string;
  rp: number | null;
}
export interface ModificationData {
  presentation?: { groups: { name: string; columns: number }[]; source: string; checkedAt: string };
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
  nameRu?: string | null;
  nameJa?: string | null;
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
  sources?: Catalog["sources"];
  trees: Record<string, Tree | null>;
  modifications: Modifications;
  lineupCodes: Record<string, string>;
}
export interface DataManifest {
  schemaVersion: 4;
  countries: Record<string, import("./data-loader").DataFile>;
}
