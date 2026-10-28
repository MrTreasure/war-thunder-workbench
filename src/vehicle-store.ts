import bundledManifest from "./generated/manifest.json";
import bootstrap from "./generated/bootstrap.json";
import { CountryIndexedDB } from "./country-indexed-db";
import { loadCountryResource } from "./country-resource-loader";
import { restoreCountry } from "./country-csv.mjs";
import { readRemoteCatalog } from "./remote-catalog";
import type { DataFile } from "./data-loader";
import type { CountryPayload, Vehicle } from "./models";
export type VehicleFacts = Partial<Vehicle> & {
  id: string;
  name: string;
  country?: string;
  category?: string | null;
};
export type CountryState = {
  value: CountryPayload;
  entry: DataFile;
  saved: "indexedDB" | "memory";
  full: true;
  updating: boolean;
  error: string;
};
export function validCountry(value: unknown, country: string): value is CountryPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as CountryPayload;
  return (
    p.schemaVersion === 2 &&
    p.country === country &&
    typeof p.checkedAt === "string" &&
    !!p.modifications &&
    !!p.lineupCodes &&
    !!p.trees &&
    Object.keys(p.trees).length === Object.keys(bootstrap.categories).length &&
    Object.keys(bootstrap.categories).every((key) => {
      const tree = p.trees[key];
      return (
        tree === null ||
        (!!tree &&
          Array.isArray(tree.ranks) &&
          tree.ranks.every(
            (rank) =>
              Array.isArray(rank.research) &&
              Array.isArray(rank.special) &&
              [...rank.research, ...rank.special].every(
                (node) =>
                  Array.isArray(node.members) &&
                  node.members.every((unit) => typeof unit.id === "string"),
              ),
          ))
      );
    })
  );
}
/** One complete country snapshot, one shared vehicle index, no legacy data path. */
export class VehicleStore {
  private states = new Map<string, CountryState>();
  private facts: ReadonlyMap<string, VehicleFacts> = new Map();
  private listeners = new Set<() => void>();
  private initial = new Map<string, Promise<CountryState>>();
  private updates = new Map<string, Promise<CountryState>>();
  private checked = new Map<string, number>();
  private indexFlight: ReturnType<typeof readRemoteCatalog> | null = null;
  private writes = new Map<string, Promise<boolean>>();
  private intended = new Map<string, string>();
  constructor(
    private storage = new CountryIndexedDB(),
    private load = loadCountryResource,
    private remote = readRemoteCatalog,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getFacts = () => this.facts;
  getCountry = (country: string) => this.states.get(country) || null;
  private index() {
    if (!this.indexFlight)
      this.indexFlight = this.remote().finally(() => {
        this.indexFlight = null;
      });
    return this.indexFlight;
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  private activate(country: string, state: CountryState) {
    this.states.set(country, state);
    const next = new Map(this.facts);
    for (const [id, unit] of next) if (unit.country === country) next.delete(id);
    for (const [category, tree] of Object.entries(state.value.trees))
      for (const rank of tree?.ranks || [])
        for (const node of [...rank.research, ...rank.special])
          for (const unit of node.members) next.set(unit.id, { ...unit, country, category });
    this.facts = next;
    this.emit();
    return state;
  }
  private update(country: string, entry: DataFile): Promise<CountryState> {
    const key = country + ":" + entry.sha256;
    const existing = this.updates.get(key);
    if (existing) return existing;
    this.intended.set(country, entry.sha256);
    const promise = (async () => {
      const body = await this.load(entry),
        value = restoreCountry(body, entry);
      if (!validCountry(value, country)) throw Error("国家资料版本或内容不完整");
      if (this.intended.get(country) !== entry.sha256) {
        const active = this.states.get(country);
        if (active) return active;
        throw Error("国家资料正在切换新版本");
      }
      const previous = this.writes.get(country) || Promise.resolve(false);
      const write = previous
        .catch(() => false)
        .then(() =>
          this.intended.get(country) === entry.sha256
            ? this.storage.commit(country, entry, value)
            : false,
        )
        .catch(() => false);
      this.writes.set(country, write);
      const saved = await write;
      if (this.writes.get(country) === write) this.writes.delete(country);
      if (this.intended.get(country) !== entry.sha256) {
        const active = this.states.get(country);
        if (active) return active;
        throw Error("国家资料正在切换新版本");
      }
      return this.activate(country, {
        value,
        entry,
        saved: saved ? "indexedDB" : "memory",
        full: true,
        updating: false,
        error: "",
      });
    })().finally(() => this.updates.delete(key));
    this.updates.set(key, promise);
    return promise;
  }
  async ensure(country: string): Promise<CountryState> {
    if (!Object.hasOwn(bootstrap.countries, country)) throw Error("不支持的国家资料");
    let state = this.states.get(country);
    if (!state) {
      let pending = this.initial.get(country);
      if (!pending) {
        pending = (async () => {
          const stored = await this.storage.read(country).catch(() => null);
          if (stored && validCountry(stored.value, country))
            return this.activate(country, {
              entry: stored.entry,
              value: stored.value,
              saved: "indexedDB",
              full: true,
              updating: false,
              error: "",
            });
          let entry = bundledManifest.countries[
            country as keyof typeof bundledManifest.countries
          ] as DataFile;
          try {
            const manifest = await this.index();
            if (manifest?.countries[country]) entry = manifest.countries[country];
            this.checked.set(country, Date.now());
          } catch {
            /* Packaged CSV uses the same new format when the server is unavailable. */
          }
          return this.update(country, entry);
        })().finally(() => this.initial.delete(country));
        this.initial.set(country, pending);
      }
      state = await pending;
    }
    void this.revalidate(country).catch(() => {});
    return state;
  }
  async revalidate(country: string, force = false): Promise<void> {
    if (!force && (this.checked.get(country) || 0) > Date.now() - 60_000) return;
    this.checked.set(country, Date.now());
    const current = this.states.get(country);
    if (!current) return;
    this.states.set(country, { ...current, updating: true, error: "" });
    this.emit();
    try {
      const manifest = await this.index(),
        entry = manifest?.countries[country];
      if (entry && entry.sha256 !== this.states.get(country)!.entry.sha256)
        await this.update(country, entry);
    } catch (error) {
      const state = this.states.get(country);
      if (state)
        this.states.set(country, {
          ...state,
          error: error instanceof Error ? error.message : "国家资料更新失败",
        });
    } finally {
      const state = this.states.get(country);
      if (state) this.states.set(country, { ...state, updating: false });
      this.emit();
    }
  }
}
export const vehicleStore = new VehicleStore();
