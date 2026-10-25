import { useEffect, useMemo, useState, useRef } from "react";
import { registerCountryVehicles } from "../../../src/vehicle-catalog";
import { matchesVehicleFilter } from "../../../src/vehicle-labels";
import { ModificationGrid } from "../../../src/ModificationGrid";
import { ResearchPoints } from "../../../src/ResearchPoints";
import { VehiclePresentation, useMiniappOwnedVehicles } from "./VehiclePresentation";
import { TreeCanvas } from "../../../src/TreeCanvas";
import { GameSelect } from "../../../src/components/GameSelect";
import { indexTree, calculate } from "../../../src/planner";
import { parseRate, quoteCents } from "../../../src/quotes";
import type {
  Catalog,
  CatalogIndex,
  CountryPayload,
  Mode,
  Profile,
  Tree,
  Vehicle,
} from "../../../src/models";
import bootstrap from "../../../src/generated/bootstrap.json";
import manifest from "../../../src/generated/manifest.json";
import { countryModules } from "../../../src/generated/country-modules";
import { MainSiteLink } from "./MainSiteLink";
import { validPlan } from "./plan";
import { sdk, account } from "./runtime";
import { useRuntime, type ResearchIntent } from "./context";
import { DetailPage, Icon, ErrorNote, num } from "./ui";
const index = bootstrap as CatalogIndex;
const entries = manifest.countries as Record<
  string,
  { key: string; sha256: string; bytes: number }
>;
export default function Research({ initial }: { initial?: ResearchIntent }) {
  const ownedVehicleIds = useMiniappOwnedVehicles();
  const [country, setCountry] = useState(initial?.country || ""),
    [category, setCategory] = useState(initial?.category || "ground"),
    [mode, setMode] = useState<Mode>("rb");
  const [data, setData] = useState<CountryPayload | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!initial?.country),
    [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [filters, setFilters] = useState(false),
    [display, setDisplay] = useState<"tree" | "list">("tree"),
    [zoom, setZoom] = useState(0.65);
  const [expanded, setExpanded] = useState(new Set<string>()),
    [selected, setSelected] = useState<string | null>(initial?.target || null),
    [sheet, setSheet] = useState<"vehicle" | "mods" | null>(initial?.target ? "vehicle" : null);
  function changeCountry(next: string) {
    if (next === country) return;
    setCountry(next);
    setLoading(!!next);
    setError("");
    setData(null);
    setSelected(null);
    setExpanded(new Set());
    setSheet(null);
  }
  useEffect(() => {
    if (!country) return;
    let active = true;
    void (async () => {
      const entry = entries[country];
      const { default: text } = await countryModules[entry.key]();
      const bytes = new TextEncoder().encode(text);
      const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      if (bytes.byteLength !== entry.bytes || sha !== entry.sha256)
        throw Error("国家资料校验失败，请重试");
      const parsed = JSON.parse(text) as CountryPayload;
      if (
        parsed.schemaVersion !== 2 ||
        parsed.country !== country ||
        !parsed.trees ||
        !parsed.modifications
      )
        throw Error("国家资料格式无效");
      if (active) {
        registerCountryVehicles(parsed);
        setData(parsed);
      }
    })()
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "资料暂不可用");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [country, retry]);
  const catalog = useMemo(
    () =>
      ({
        ...index,
        trees: Object.fromEntries(
          Object.keys(index.categories).map((c) => [c, { [country]: data?.trees[c] || null }]),
        ),
      }) as Catalog,
    [country, data],
  );
  const tree = data?.trees[category] ?? null;
  const units = useMemo(() => [...indexTree(tree).units.values()], [tree]);
  const visibleUnits = units.filter(
    (item) =>
      (!search ||
        [item.name, item.nameEn, item.id].some((value) =>
          value?.toLowerCase().includes(search.toLowerCase()),
        )) &&
      matchesVehicleFilter(item, filter),
  );
  const choose = (id: string) => {
    setSelected(id);
    setSheet("vehicle");
  };
  const unit = units.find((u) => u.id === selected);
  return (
    <section className="hb-research">
      <div className="hb-research-toolbar">
        <div className="hb-selects">
          <GameSelect
            aria-label="国家"
            value={country}
            onValueChange={(v) => {
              changeCountry(v);
              setSheet(null);
            }}
          >
            <option value="">选择国家</option>
            {Object.entries(index.countries).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </GameSelect>
          <GameSelect
            aria-label="军种"
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setSheet(null);
              setSelected(null);
            }}
          >
            {Object.entries(index.categories).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </GameSelect>
          <button className="hb-icon" onClick={() => setFilters(true)} aria-label="研发筛选">
            <Icon name="filter" />
          </button>
        </div>
        <input
          className="hb-search"
          aria-label="搜索载具"
          placeholder="搜索载具 / 定位路线"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {country && (
          <div className="hb-view-controls">
            <div className="hb-segment">
              <button aria-pressed={display === "tree"} onClick={() => setDisplay("tree")}>
                科技树
              </button>
              <button aria-pressed={display === "list"} onClick={() => setDisplay("list")}>
                载具列表
              </button>
            </div>
            {display === "tree" && (
              <label>
                缩放{" "}
                <input
                  type="range"
                  aria-label="科技树缩放"
                  min=".6"
                  max="1"
                  step=".05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
            )}
          </div>
        )}
        {selected && (
          <div className="hb-selection-bar">
            <span>{unit?.name || "已选择目标载具"}</span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setSheet(null);
              }}
            >
              清除选择
            </button>
          </div>
        )}
      </div>
      {!country ? (
        <div className="hb-country-entry">
          <h2>选择你的研发阵营</h2>
          <p>载具与配件资料按国家载入。</p>
          <div className="hb-country-grid">
            {Object.entries(index.countries).map(([id, name]) => (
              <button key={id} onClick={() => changeCountry(id)}>
                <img src={index.flags[id]} alt="" width="40" height="26" />
                <span>{name}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
          <MainSiteLink />
        </div>
      ) : loading ? (
        <div className="hb-empty" aria-live="polite">
          <h2>正在载入{index.countries[country]}资料</h2>
          <p>正在校验载具与配件资料…</p>
        </div>
      ) : error ? (
        <div className="hb-empty">
          <ErrorNote error={error} />
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            重新载入
          </button>
        </div>
      ) : tree ? (
        <div className={"hb-tree-scroll " + (display === "list" ? "is-list" : "")}>
          {display === "tree" ? (
            <TreeCanvas
              tree={tree}
              catalog={catalog}
              mode={mode}
              selected={selected}
              query={search}
              expanded={expanded}
              toggle={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(id)) next.add(id);
                  return next;
                })
              }
              zoom={zoom}
              filter={filter}
              onSelect={choose}
              locate={0}
              ownedVehicleIds={ownedVehicleIds}
            />
          ) : (
            <div className="hb-unit-list">
              {!visibleUnits.length && (
                <div className="hb-empty">
                  <h2>没有符合条件的载具</h2>
                  <p>调整获取方式或搜索条件后再试。</p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    重置筛选
                  </button>
                </div>
              )}
              {visibleUnits.map((u) => (
                <VehiclePresentation
                  key={u.id}
                  unit={u}
                  country={country}
                  category={category}
                  mode={mode}
                  owned={ownedVehicleIds.has(u.id)}
                  onSelect={() => choose(u.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="hb-empty">该国家暂无此军种科技树，试试其他军种。</div>
      )}
      {filters && (
        <DetailPage path="#/research/filters" title="研发筛选" close={() => setFilters(false)}>
          <label>
            战斗模式
            <GameSelect value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <option value="ab">街机战斗</option>
              <option value="rb">历史战斗</option>
              <option value="sb">全真战斗</option>
            </GameSelect>
          </label>
          <label>
            获取方式
            <GameSelect value={filter} onValueChange={setFilter}>
              <option value="all">全部载具</option>
              <option value="research">常规研发</option>
              <option value="gold">金鹰载具</option>
              <option value="pack">礼包载具</option>
              <option value="premium">全部高级载具</option>
              <option value="squadron">联队载具</option>
              <option value="special">特殊载具</option>
            </GameSelect>
          </label>
          <button className="hb-primary" onClick={() => setFilters(false)}>
            应用筛选
          </button>
        </DetailPage>
      )}
      {sheet && unit && tree && data && (
        <Calculator
          key={`${country}:${category}:${unit.id}`}
          {...{ unit, tree, country, category, catalog, data, mode }}
          kind={sheet}
          switchKind={() => setSheet(sheet === "vehicle" ? "mods" : "vehicle")}
          close={() => {
            setSheet(null);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
type CalculatorProps = {
  unit: Vehicle;
  tree: Tree;
  country: string;
  category: string;
  catalog: Catalog;
  data: CountryPayload;
  kind: "vehicle" | "mods";
  mode: Mode;
  switchKind: () => void;
  close: () => void;
};
function Calculator(props: CalculatorProps) {
  return (
    <DetailPage
      path={"#/research/vehicle/" + encodeURIComponent(props.unit.id)}
      title="载具与配件研发"
      close={props.close}
    >
      <CalculatorContent key={props.kind} {...props} />
    </DetailPage>
  );
}
function CalculatorContent({
  unit,
  tree,
  country,
  category,
  catalog,
  data,
  kind,
  mode,
  switchKind,
  close,
}: CalculatorProps) {
  const { view, cloud, reloadCloud } = useRuntime();
  const key = `wt-planner-v1:${category}:${country}`;
  const existing = cloud?.documents.find((d) => d.key === key);
  const [localProfile, setLocalProfile] = useState<Partial<Profile> | null>(null);
  const stored = validPlan(existing?.value) ? existing.value : localProfile;
  const [progress, setProgress] = useState(() =>
    kind === "vehicle" && stored?.target === unit.id ? String(stored.progress || 0) : "0",
  );
  const [price, setPrice] = useState(stored?.price || ""),
    [completed, setCompleted] = useState(new Set<string>());
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const [manualOwned, setManualOwned] = useState(!!stored?.owned?.includes(unit.id));
  const dirty = useRef(false);
  useEffect(() => {
    if (view.status === "authenticated") return;
    let active = true;
    void sdk.storage
      .getStorage<Partial<Profile>>({ key: `wt_plan_${category}_${country}` })
      .then(({ data: value }) => {
        if (!active || !value) return;
        if (!validPlan(value)) {
          setError("本地计划格式无效，原记录保留，可重新计算。");
          return;
        }
        setLocalProfile(value);
        if (!dirty.current) {
          if (kind === "vehicle" && value.target === unit.id)
            setProgress(String(value.progress || 0));
          setPrice(typeof value.price === "string" ? value.price : "");
          setManualOwned(Array.isArray(value.owned) && value.owned.includes(unit.id));
        }
      })
      .catch(() => {
        /* New local plans work even when storage is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [view.status, country, category, unit.id, kind]);
  const owned = useMemo(
    () => [
      ...new Set([
        ...(Array.isArray(stored?.owned)
          ? stored.owned.filter((id) => typeof id === "string" && id !== unit.id)
          : []),
        ...(cloud?.binding?.vehicles.map((v) => v.id) || []),
        ...(manualOwned ? [unit.id] : []),
      ]),
    ],
    [stored, cloud?.binding, manualOwned, unit.id],
  );
  const plan = useMemo(
    () =>
      calculate(tree, {
        ...stored,
        target: unit.id,
        owned,
        progress: /^\d+$/.test(progress) ? Number(progress) : 0,
        gates: { ...catalog.planning.gates[category][country], ...stored?.gates },
      }),
    [tree, unit.id, owned, progress, catalog, category, country, stored],
  );
  const mods = data.modifications[unit.id];
  const premium = unit.premium || mods?.allUnlockedByDefault;
  const modsTotal = premium ? 0 : (mods?.totalRp ?? null);
  const completedRp = mods?.itemCostsComplete
    ? mods.items.filter((m) => completed.has(m.id)).reduce((s, m) => s + (m.rp ?? 0), 0)
    : 0;
  const validProgress =
    /^\d+$/.test(progress) &&
    Number.isSafeInteger(Number(progress)) &&
    Number(progress) <= 10000000;
  const remaining = !validProgress
    ? null
    : kind === "vehicle"
      ? plan.total
      : modsTotal === null
        ? null
        : Math.max(0, modsTotal - completedRp - Number(progress));
  const rate = parseRate(price);
  const cents =
    remaining !== null && rate !== null
      ? quoteCents([{ rp: remaining, rateCents: rate } as never])
      : null;
  async function save() {
    setError("");
    setSaving(true);
    try {
      const value: Profile = {
        target: unit.id,
        owned: [],
        pins: [],
        banned: [],
        unlocked: 0,
        progress: Number(progress),
        price,
        costs: {},
        ...stored,
        gates: { ...catalog.planning.gates[category][country], ...stored?.gates },
      };
      value.target = unit.id;
      value.progress = Number(progress);
      value.price = price;
      value.owned = [
        ...new Set([
          ...(Array.isArray(stored?.owned) ? stored.owned.filter((id) => id !== unit.id) : []),
          ...(manualOwned ? [unit.id] : []),
        ]),
      ];
      if (view.status === "authenticated") {
        if (!cloud) throw Error("账号计划正在加载，请稍后再试");
        await account.request("account/workspace", {
          ownerKey: cloud.ownerKey,
          key,
          revision: existing?.revision || 0,
          value,
        });
        await reloadCloud();
      } else await sdk.storage.setStorage({ key: `wt_plan_${category}_${country}`, data: value });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "计划未能保存");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <VehiclePresentation
        unit={unit}
        country={country}
        category={category}
        mode={mode}
        owned={owned.includes(unit.id)}
      />
      <div className="hb-segment">
        <button
          aria-pressed={kind === "vehicle"}
          onClick={kind === "vehicle" ? undefined : switchKind}
        >
          载具研发
        </button>
        <button aria-pressed={kind === "mods"} onClick={kind === "mods" ? undefined : switchKind}>
          配件研发
        </button>
      </div>
      <div className="hb-result">
        <small>剩余研发点</small>
        <strong>
          <ResearchPoints>{remaining === null ? "待核对" : num(remaining)}</ResearchPoints>
        </strong>
        {kind === "vehicle" && <small>含必要前置及等级补研，跳过已拥有载具</small>}
        {kind === "mods" && premium && <small>高级载具配件默认已解锁</small>}
      </div>
      <label>
        当前已投入 RP
        <input
          inputMode="numeric"
          value={progress}
          onChange={(e) => {
            dirty.current = true;
            setProgress(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      {kind === "vehicle" && (
        <label className="hb-checkbox">
          <input
            type="checkbox"
            checked={owned.includes(unit.id)}
            disabled={cloud?.binding?.vehicles.some((v) => v.id === unit.id)}
            onChange={(e) => {
              dirty.current = true;
              setManualOwned(e.target.checked);
            }}
          />
          此目标载具已拥有
        </label>
      )}
      {kind === "mods" && mods && (
        <details className="hb-modification-picker">
          <summary>{premium ? "查看已解锁配件" : "勾选已完成配件"}</summary>
          {!mods.itemCostsComplete && (
            <p className="hb-fine">配件费用尚未完整核验，暂不可按单项扣除研发点。</p>
          )}
          <div className="hb-modification-scroll">
            <ModificationGrid
              data={mods}
              included={!!premium}
              allUnlockedByDefault={!!premium}
              completed={[...completed]}
              onChange={(id, checked) =>
                setCompleted((previous) => {
                  const next = new Set(previous);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
            />
          </div>
        </details>
      )}
      <label>
        每万 RP 参考单价（元）
        <input
          inputMode="decimal"
          placeholder="选填"
          value={price}
          onChange={(e) => {
            dirty.current = true;
            setPrice(e.target.value);
          }}
        />
      </label>
      {price && (
        <p className="hb-total">
          参考费用 <strong>{cents === null ? "待核对" : `¥ ${(cents / 100).toFixed(2)}`}</strong>
        </p>
      )}
      {kind === "vehicle" && (
        <details>
          <summary>查看研发路线 · {plan.rows.length} 辆</summary>
          {plan.rows.map((row) => (
            <div className="hb-route-step" key={row.unit.id}>
              <VehiclePresentation
                unit={row.unit}
                country={country}
                category={category}
                mode={mode}
                owned={owned.includes(row.unit.id)}
              />
              <div className="hb-route-step-note">
                <span>{row.reason}</span>
                <ResearchPoints>{num(row.rp)}</ResearchPoints>
              </div>
            </div>
          ))}
        </details>
      )}
      <ErrorNote
        error={
          error ||
          (!validProgress ? "请输入有效的研发点" : kind === "vehicle" ? plan.errors.join("；") : "")
        }
      />
      {kind === "vehicle" && (
        <button
          className="hb-primary"
          onClick={() => void save()}
          disabled={saving || !validProgress}
        >
          {saving ? "正在保存…" : saved ? "已保存计划" : "保存研发计划"}
        </button>
      )}
      <button type="button" onClick={close}>
        清除选择，返回科技树
      </button>
      <MainSiteLink />
      <p className="hb-fine">未知成本保留待核对。估算不含银狮、购车或配件以外的支出。</p>
    </>
  );
}
