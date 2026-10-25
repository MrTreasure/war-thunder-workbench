import { registerCountryVehicles } from "./vehicle-catalog";
import { Chevron } from "./components/Chevron";
import { useAccountWorkspace } from "./workspace-context";
import { vehicleDisplayName } from "./vehicle-display-name";
import { updateSearchMetadata } from "./search-metadata";
import { GameSelect } from "./components/GameSelect";
import { Component, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CartItem, Catalog, CatalogIndex, DataManifest, CountryPayload, Mode } from "./models";
import { TreeCanvas, treeLayout, modes } from "./TreeCanvas";
import { indexTree } from "./planner";
import { VehicleCalculator } from "./VehicleCalculator";
import { ModificationCalculator } from "./Modifications";
import { Cart } from "./Cart";
import { Lineups } from "./Lineups";
import { VehicleImage } from "./VehicleImage";
import { VehicleDetails } from "./VehicleDetails";
import { Modal } from "./Modal";
import { WarThunderLoading } from "./Loading";
import { dataCache, cacheLabel } from "./data-cache";
import { readRemoteCatalog } from "./remote-catalog";
import type { CacheBackend } from "./data-cache";
import { initialSelection, rememberSelection } from "./selection";
import { object } from "./validation";
import { workbenchPage } from "./features";
import manifestData from "./generated/manifest.json";
const manifest: DataManifest = { ...manifestData, schemaVersion: 3 };
import { readJson, useStored } from "./storage";
import { validCart } from "./quotes";
import bootstrapData from "./generated/bootstrap.json";
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <WarThunderLoading
        title="界面暂时无法显示"
        progress={{ received: 0, total: 0 }}
        error="界面未能正常显示，请重新加载；本地购物车会保留。"
        retry={() => location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
const CART_KEY = "wt-workbench-cart-v1";
const WorkbenchPages = createContext<{ tree: ReactNode; lineups: ReactNode } | null>(null);
export function useWorkbenchPage(page: "tree" | "lineups") {
  const pages = useContext(WorkbenchPages);
  if (!pages) throw Error("工作台页面缺少共享状态。");
  return pages[page];
}
export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const workspace = useAccountWorkspace();
  const bootstrap = bootstrapData as CatalogIndex;
  const [initial] = useState(() =>
    initialSelection(bootstrap.countries, bootstrap.categories, location.search),
  );
  const [country, setCountry] = useState(initial.country);
  const [category, setCategory] = useState(initial.category);
  const [remembered, setRemembered] = useState(true);
  const page = useRouterState({
    select: (state) => workbenchPage(state.location.pathname),
  });
  const garagePage = useRouterState({
    select: (state) => state.location.pathname === "/lineups/garage",
  });
  useEffect(() => {
    updateSearchMetadata(page);
  }, [page]);
  const currentKey = country;
  const [remoteManifest, setRemoteManifest] = useState<DataManifest | null>(null);
  const countryEntry = remoteManifest?.countries[country] || manifest.countries[country] || null;
  useEffect(() => {
    if (
      import.meta.env.VITE_WT_CATALOG_SOURCE === "bundled" ||
      garagePage ||
      !country ||
      ["maps", "stats", "sales", "decals"].includes(page)
    )
      return;
    const controller = new AbortController();
    const refresh = () => {
      if (document.hidden) return;
      void readRemoteCatalog(controller.signal)
        .then((value) => {
          if (value && !controller.signal.aborted) setRemoteManifest(value);
        })
        .catch(() => {
          /* Keep the last verified index or bundled baseline. */
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [country, page, garagePage]);
  const [loadedCountry, setLoadedCountry] = useState<{
    key: string;
    value: CountryPayload;
    cache: CacheBackend;
  } | null>(null);
  const [countryProgress, setCountryProgress] = useState<{
    key: string;
    received: number;
    total: number;
  } | null>(null);
  const [countryError, setCountryError] = useState<{ key: string; message: string } | null>(null);
  const [countryRetry, setCountryRetry] = useState(0);
  const P = useMemo<Catalog>(
    () => ({
      ...bootstrap,
      checkedAt:
        loadedCountry?.key === currentKey ? loadedCountry.value.checkedAt : bootstrap.checkedAt,
      sources:
        loadedCountry?.key === currentKey
          ? loadedCountry.value.sources || bootstrap.sources
          : bootstrap.sources,
      trees: Object.fromEntries(
        Object.keys(bootstrap.categories).map((kind) => [
          kind,
          Object.fromEntries(
            Object.keys(bootstrap.countries).map((nation) => [
              nation,
              loadedCountry?.key === currentKey && nation === country
                ? loadedCountry.value.trees[kind]
                : null,
            ]),
          ),
        ]),
      ),
    }),
    [bootstrap, loadedCountry, currentKey, country],
  );
  useEffect(() => {
    if (
      garagePage ||
      page === "maps" ||
      page === "stats" ||
      page === "sales" ||
      page === "decals" ||
      !country ||
      !countryEntry
    )
      return;
    const controller = new AbortController();
    const valid = (value: unknown): value is CountryPayload => {
      if (
        !object(value) ||
        value.schemaVersion !== 2 ||
        value.country !== country ||
        typeof value.checkedAt !== "string" ||
        !object(value.trees) ||
        !object(value.modifications) ||
        !object(value.lineupCodes)
      )
        return false;
      const trees = value.trees;
      return (
        Object.keys(trees).length === Object.keys(bootstrap.categories).length &&
        Object.keys(bootstrap.categories).every((kind) => {
          const tree = trees[kind];
          return bootstrap.availability[kind][country]
            ? object(tree) && Array.isArray(tree.ranks)
            : tree === null;
        })
      );
    };
    dataCache
      .load<CountryPayload>(countryEntry, valid, controller.signal, (value) =>
        setCountryProgress({ ...value, key: currentKey }),
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          registerCountryVehicles(result.value);
          setLoadedCountry({ key: currentKey, value: result.value, cache: result.saved });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCountryError({
            key: currentKey,
            message: error instanceof Error ? error.message : "载具资料读取失败",
          });
      });
    return () => controller.abort();
  }, [country, currentKey, countryEntry, countryRetry, bootstrap, page, garagePage]);
  function chooseCountry(value: string) {
    if (value !== country) {
      setCountryError(null);
      setCountryProgress(null);
    }
    setRemembered(rememberSelection({ country: value, category }));
    setCountry(value);
  }
  function chooseCategory(value: string) {
    setRemembered(rememberSelection({ country, category: value }));
    setCategory(value);
  }
  const [mode, setMode] = useState<Mode>(initial.mode || "rb");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [query, setQuery] = useState(initial.query || "");
  const [showResults, setShowResults] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const mobileToolsToggle = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState(initial.filter || "all");
  const [zoomPreference] = useState(() =>
    readJson<{ zoom: number; autoZoom: boolean } | null>(
      "wt-planner-v1:tree-zoom",
      null,
      (value): value is { zoom: number; autoZoom: boolean } =>
        object(value) &&
        typeof value.zoom === "number" &&
        Number.isFinite(value.zoom) &&
        value.zoom >= 0.5 &&
        value.zoom <= 1.4 &&
        typeof value.autoZoom === "boolean",
    ),
  );
  const [zoom, setZoom] = useState(zoomPreference?.zoom ?? 1);
  const [autoZoom, setAutoZoom] = useState(zoomPreference?.autoZoom ?? true);
  useEffect(() => {
    try {
      localStorage.setItem("wt-planner-v1:tree-zoom", JSON.stringify({ zoom, autoZoom }));
    } catch {
      /* Keep the selected scale usable when browser storage is unavailable. */
    }
  }, [zoom, autoZoom]);
  const [locate, setLocate] = useState(0);
  const [modal, setModal] = useState<"parts" | "vehicle" | "cart" | "image" | null>(null);
  const preferenceSearch = useRef(location.search);
  useEffect(() => {
    function restoreRoute() {
      setModal(null);
      setMobileToolsOpen(false);
      const next = initialSelection(
        bootstrap.countries,
        bootstrap.categories,
        location.search,
        false,
      );
      setCountry(next.country);
      setCategory(next.category);
      setMode(next.mode || "rb");
    }
    const routeChange = () => {
      setModal(null);
      setMobileToolsOpen(false);
      if (location.search !== preferenceSearch.current) {
        preferenceSearch.current = location.search;
        restoreRoute();
      }
    };
    window.addEventListener("hashchange", routeChange);
    window.addEventListener("popstate", routeChange);
    return () => {
      window.removeEventListener("hashchange", routeChange);
      window.removeEventListener("popstate", routeChange);
    };
  }, [bootstrap]);
  const modifications =
    loadedCountry?.key === currentKey ? loadedCountry.value.modifications : null;
  function openParts() {
    setModal("parts");
  }
  const [cart, saveCart, cartStorageError] = useStored<CartItem[]>(
    CART_KEY,
    [],
    validCart,
    undefined,
    true,
  );
  const [pulse, setPulse] = useState(0);
  const [cartError, setCartError] = useState("");
  const [full, setFull] = useState(false);
  const [fallbackFull, setFallbackFull] = useState(false);
  const viewport = useRef<HTMLElement>(null),
    search = useRef<HTMLInputElement>(null),
    countryPicker = useRef<HTMLDetailsElement>(null),
    searchWrap = useRef<HTMLDivElement>(null);
  const tree = P.trees[category][country];
  useEffect(() => {
    const frame = viewport.current;
    if (!frame || !tree || !autoZoom) return;
    const fit = () =>
      setZoom(
        Math.max(0.5, Math.min(1, (frame.clientWidth - 24) / treeLayout(tree, expanded).width)),
      );
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [tree, expanded, autoZoom]);
  const indexed = useMemo(() => indexTree(tree), [tree]);
  const all =
    tree?.ranks
      .flatMap((rank) => [...rank.research, ...rank.special])
      .flatMap((node) => node.members) || [];
  const unit = all.find((unit) => unit.id === selected);
  const canonicalSelected = selected ? indexed.aliases.get(selected) || selected : null;
  const needle = query
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  const matches = all.filter((unit) =>
    (unit.name + (unit.nameEn || "") + unit.id)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "")
      .includes(needle),
  );
  useEffect(() => {
    rememberSelection({ country, category, mode, filter, query });
  }, [country, category, mode, filter, query]);
  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (country) next.set("country", country);
    else next.delete("country");
    next.set("category", category);
    next.set("mode", mode);
    preferenceSearch.current = `?${next}`;
    history.replaceState(history.state, "", `${location.pathname}?${next}${location.hash}`);
  }, [country, category, mode]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (modal || page !== "tree") return;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setMobileToolsOpen(true);
        requestAnimationFrame(() => search.current?.focus());
      }
      if (e.key === "Escape") {
        if (mobileToolsOpen && mobileToolsToggle.current?.offsetParent)
          mobileToolsToggle.current.focus();
        setMobileToolsOpen(false);
        setSelected(null);
        setShowResults(false);
        setFallbackFull(false);
      }
    };
    const click = (e: MouseEvent) => {
      if (!countryPicker.current?.contains(e.target as Node) && countryPicker.current)
        countryPicker.current.open = false;
      if (!searchWrap.current?.contains(e.target as Node)) setShowResults(false);
    };
    const fullscreen = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("keydown", key);
    document.addEventListener("click", click);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("click", click);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [modal, page, mobileToolsOpen]);
  const countryKeys = (event: import("react").KeyboardEvent) => {
    const picker = countryPicker.current;
    if (!picker) return;
    const items = [...picker.querySelectorAll<HTMLButtonElement>(".country-option")];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      picker.open = false;
      picker.querySelector("summary")?.focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      picker.open = true;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : current < 0
              ? 0
              : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };
  const reset = () => {
    setSelected(null);
    setExpanded(new Set());
    setQuery("");
    setShowResults(false);
    viewport.current?.scrollTo(0, 0);
  };
  const select = (id: string, find = false) => {
    setSelected(id);
    const node = tree?.ranks
      .flatMap((rank) => [...rank.research, ...rank.special])
      .find((node) => node.members.some((unit) => unit.id === id));
    if (node && node.members[0].id !== id)
      setExpanded((previous) => new Set([...previous, node.id]));
    setShowResults(false);
    if (find) {
      setMobileToolsOpen(false);
      setFilter("all");
      setLocate((previous) => previous + 1);
    }
  };
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  function add(item: CartItem) {
    if (cart.some((old) => old.fingerprint === item.fingerprint)) return "这份报价已经在购物车中。";
    if (cart.length >= 500) return "购物车已满，请导出备份并移除部分报价。";
    const replacing =
      item.kind === "modifications" &&
      cart.some((old) => old.kind === "modifications" && old.lines[0]?.key === item.lines[0]?.key);
    const next = [
      ...cart.filter(
        (old) =>
          !(
            item.kind === "modifications" &&
            old.kind === "modifications" &&
            old.lines[0]?.key === item.lines[0]?.key
          ),
      ),
      item,
    ];
    try {
      if (!saveCart(next)) return "保存失败：请检查云端同步状态。";
      setPulse((value) => value + 1);
      setCartError("");
      return replacing ? "已更新购物车中的配件报价 ✓" : "已加入购物车 ✓";
    } catch {
      return "保存失败：浏览器存储不可用或已满。请先导出购物车，报价尚未加入。";
    }
  }
  function remove(id: string) {
    const next = cart.filter((item) => item.id !== id);
    try {
      if (!saveCart(next)) {
        setCartError("移除未完成，请检查云端同步状态。");
        return;
      }
      setCartError("");
    } catch {
      setCartError("浏览器保存失败，条目尚未移除。");
    }
  }
  async function fullscreen() {
    if (full) {
      await document.exitFullscreen();
      return;
    }
    if (fallbackFull) {
      setFallbackFull(false);
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setFallbackFull(true);
    }
  }
  const path: string[] = [];
  let pathId = canonicalSelected;
  const seen = new Set<string>();
  while (pathId && !seen.has(pathId)) {
    seen.add(pathId);
    path.unshift(pathId);
    pathId = indexed.parents.get(pathId) || null;
  }
  const groups = tree?.ranks.flatMap((rank) => rank.research).filter((node) => node.group) || [];
  const allOpen = groups.length > 0 && groups.every((node) => expanded.has(node.id));
  const lineupsPage = (
    <Lineups
      catalog={bootstrap}
      defaultBattle={
        category === "aviation"
          ? "air"
          : category === "ground" || category === "helicopters"
            ? "ground"
            : "naval"
      }
      country={country}
      payload={loadedCountry?.key === currentKey ? loadedCountry.value : null}
      {...{ chooseCountry, mode, setMode }}
      progress={countryProgress?.key === currentKey ? countryProgress : { received: 0, total: 0 }}
      error={countryError?.key === currentKey ? countryError.message : undefined}
      retry={() => {
        setCountryError(null);
        setCountryProgress(null);
        setCountryRetry((value) => value + 1);
      }}
    />
  );
  const treePage = (
    <div className={`app-shell ${fallbackFull ? "fullscreen-fallback" : ""}`}>
      <section className="workbench-header" aria-label="科技树筛选与操作">
        <button
          ref={mobileToolsToggle}
          className="mobile-tools-toggle"
          aria-expanded={mobileToolsOpen}
          aria-controls="tree-tools"
          onClick={() => {
            setMobileToolsOpen(!mobileToolsOpen);
            setShowResults(false);
            if (countryPicker.current) countryPicker.current.open = false;
          }}
        >
          <span>
            <strong>筛选与操作</strong>
            <small>
              {P.countries[country] || "选择国家"} · {P.categories[category]} · {mode.toUpperCase()}
              {query ? ` · 搜索：${query}` : filter !== "all" ? " · 已筛选" : ""}
            </small>
          </span>
          <span className="mobile-tools-label">{mobileToolsOpen ? "收起" : "展开"}</span>
          <Chevron className="mobile-tools-chevron" />
        </button>
        <div className="tool-panel" id="tree-tools" data-expanded={mobileToolsOpen}>
          <nav className="control-row" aria-label="国家与军种">
            <div className="nation-picker">
              <details className="country-dropdown" ref={countryPicker}>
                <summary
                  onKeyDown={countryKeys}
                  className="country-trigger"
                  aria-label={`选择国家：${P.countries[country] || "未选择"}`}
                >
                  {country && <img className="country-flag" alt="" src={P.flags[country]} />}
                  <span>{P.countries[country] || "选择国家"}</span>
                  <Chevron className="country-chevron" />
                </summary>
                <div className="country-options">
                  {Object.entries(P.countries).map(([id, name]) => (
                    <button
                      className="country-option"
                      onKeyDown={countryKeys}
                      key={id}
                      aria-pressed={country === id}
                      onClick={() => {
                        reset();
                        chooseCountry(id);
                        if (countryPicker.current) {
                          countryPicker.current.open = false;
                          countryPicker.current.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <img className="country-flag" alt="" src={P.flags[id]} />
                      <span>{name}</span>
                      <span className="country-selected">{country === id ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <div className="control-divider" />
            <div className="category-tabs">
              {Object.entries(P.categories).map(([id, name]) => (
                <button
                  aria-pressed={category === id}
                  key={id}
                  onClick={() => {
                    reset();
                    chooseCategory(id);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </nav>
          <section className="controls">
            <div className="utility-row">
              <div className="search-wrap" ref={searchWrap}>
                <label className="search">
                  <input
                    aria-label="搜索载具"
                    ref={search}
                    type="search"
                    placeholder="搜索载具 / 定位路线"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(Boolean(query))}
                  />
                  <kbd>/</kbd>
                </label>
                {showResults && query && (
                  <div className="search-results">
                    {matches.slice(0, 9).map((unit) => (
                      <button key={unit.id} onClick={() => select(unit.id, true)}>
                        <span>{vehicleDisplayName(unit.name)}</span>
                        <small>Rank {unit.rank}</small>
                      </button>
                    ))}
                    <p>{matches.length} 个匹配；点击定位并高亮路线。</p>
                  </div>
                )}
              </div>
              <label className="compact-field">
                高亮权重
                <GameSelect value={mode} onValueChange={(value) => setMode(value as Mode)}>
                  {(Object.entries(modes) as [Mode, string][]).map(([id, name]) => (
                    <option value={id} key={id}>
                      {name} {id.toUpperCase()}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label className="compact-field">
                右侧载具
                <GameSelect value={filter} onValueChange={(value) => setFilter(value)}>
                  <option value="all">全部特殊载具</option>
                  <option value="premium">高级载具</option>
                  <option value="gold">金币车</option>
                  <option value="pack">礼包车</option>
                  <option value="squadron">联队载具</option>
                  <option value="other">活动 / 其他</option>
                </GameSelect>
              </label>
              <button className="quiet-button calc-open" disabled={!tree} onClick={openParts}>
                研发配件
              </button>
              <button
                className="quiet-button calc-open"
                disabled={!tree}
                onClick={() => setModal("vehicle")}
              >
                研发载具
              </button>
              <button className="quiet-button cart-button" onClick={() => setModal("cart")}>
                购物车{" "}
                <span className="cart-badge" key={pulse}>
                  {cart.length}
                </span>
              </button>
              <button
                className="quiet-button"
                disabled={!tree}
                onClick={() =>
                  setExpanded(allOpen ? new Set() : new Set(groups.map((node) => node.id)))
                }
              >
                {allOpen ? "收起折叠组" : "展开折叠组"}
              </button>
              <div className="zoom-control">
                <button
                  aria-label="缩小"
                  disabled={zoom <= 0.5}
                  onClick={() => {
                    setAutoZoom(false);
                    setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10));
                  }}
                >
                  −
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button
                  onClick={() => setAutoZoom(true)}
                  aria-pressed={autoZoom}
                  title="适应窗口"
                  aria-label="适应窗口"
                >
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M3 7V3h4m6 0h4v4M3 13v4h4m6 0h4v-4M7 7h6v6H7z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  aria-label="放大"
                  disabled={zoom >= 1.4}
                  onClick={() => {
                    setAutoZoom(false);
                    setZoom((value) => Math.min(1.4, Math.round((value + 0.1) * 10) / 10));
                  }}
                >
                  ＋
                </button>
              </div>
              <button className="quiet-button" onClick={() => void fullscreen()}>
                {full || fallbackFull ? "退出全屏" : "⛶ 全屏"}
              </button>
            </div>
          </section>
          <div className="mobile-tools-source">
            <span>资料更新 · {P.checkedAt.slice(0, 10)}</span>
            <a
              href={`${P.sources[category].url}?v=t&t_c=${country}`}
              target="_blank"
              rel="noreferrer"
            >
              官方原树 ↗
            </a>
          </div>
          <button
            className="quiet-button mobile-tools-done"
            onClick={() => {
              setMobileToolsOpen(false);
              setShowResults(false);
              if (countryPicker.current) countryPicker.current.open = false;
              mobileToolsToggle.current?.focus();
            }}
          >
            收起并查看科技树
          </button>
        </div>
      </section>
      <div className="tree-status">
        <div>
          <strong>
            {P.countries[country] || "选择国家"} / {P.categories[category]}
          </strong>
          <span>
            {tree
              ? `${tree.counts.research} 辆常规研发 · ${tree.counts.special} 辆独立获取`
              : !country
                ? "选定国家后读取资料"
                : countryEntry && loadedCountry?.key !== currentKey
                  ? "正在读取该国全部资料"
                  : "暂无官方研发树"}
          </span>
        </div>
        <div className="legend">
          <span>
            <i className="legend-line" />
            前置研发
          </span>
          <span>
            <i className="legend-folder" />
            折叠组
          </span>
          <span>
            <i className="legend-gold" />
            独立获取
          </span>
        </div>
      </div>
      <main className="viewport tree-viewport" ref={viewport} aria-label="可上下左右滚动的研发树">
        {!country ? (
          <section className="nation-landing">
            <div className="nation-landing-copy">
              <img
                src="https://warthunder.com/assets/img/svg/logo-wt.svg"
                width={167}
                height={80}
                alt="War Thunder"
              />
              <h2>选择你的研发国家</h2>
              <p>选定后一次读取该国所有军种与配件资料，下次自动恢复。</p>
            </div>
            <div className="nation-grid">
              {Object.entries(P.countries).map(([id, name]) => (
                <button
                  className="nation-choice"
                  key={id}
                  onClick={() => {
                    reset();
                    chooseCountry(id);
                  }}
                >
                  <img src={P.flags[id]} alt="" />
                  <span>{name}</span>
                  <small>查看研发树 →</small>
                </button>
              ))}
            </div>
          </section>
        ) : countryEntry && loadedCountry?.key !== currentKey ? (
          <WarThunderLoading
            compact
            title={`载入${P.countries[country]}全部载具资料`}
            progress={
              countryProgress?.key === currentKey ? countryProgress : { received: 0, total: 0 }
            }
            error={countryError?.key === currentKey ? countryError.message : undefined}
            retry={
              countryError?.key === currentKey
                ? () => {
                    setCountryError(null);
                    setCountryProgress(null);
                    setCountryRetry((value) => value + 1);
                  }
                : undefined
            }
          />
        ) : tree ? (
          <TreeCanvas
            {...{ tree, catalog: P, mode, selected, query, expanded, toggle, zoom, filter, locate }}
            onSelect={select}
          />
        ) : (
          <div className="empty-state">
            <span>暂无此军种</span>
            <h2>官方 Wiki 尚未列出这棵研发树</h2>
            <p>切换国家或军种继续查看。</p>
          </div>
        )}
        <footer className="footnote">
          <div className="footnote-intro">
            <p>
              从上往下沿箭头研发；折叠组可以展开。AB / RB / SB
              切换后显示当前模式权重。配件与载具分别计价，出击队列和购物车本地保存。
            </p>
            <span className="tree-source">
              官方 Wiki · {P.checkedAt.slice(0, 10)}
              <a
                href={`${P.sources[category].url}?v=t&t_c=${country}`}
                target="_blank"
                rel="noreferrer"
              >
                官方原树 ↗
              </a>
            </span>
          </div>
          <div>
            <span>{tree?.edges.length || 0} 条官方分支连线</span>
            {selected && <button onClick={() => setSelected(null)}>清除路线高亮</button>}
            <span>
              {loadedCountry?.key === currentKey
                ? cacheLabel(loadedCountry.cache)
                : "选定国家后读取资料"}
              {!remembered ? " · 无法记住选择" : ""} · 数据以游戏内为准
            </span>
          </div>
        </footer>
        {unit && (
          <Modal
            className="vehicle-detail-dialog"
            close={() => setSelected(null)}
            subtitle={unit.side === "research" ? "研发路线" : P.kinds[unit.kind]}
            title={
              <a
                className="detail-title-link"
                href={`https://wiki.warthunder.com/unit/${encodeURIComponent(unit.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {vehicleDisplayName(unit.name)} <span aria-hidden="true">↗</span>
              </a>
            }
          >
            <VehicleDetails
              unit={unit}
              catalog={P}
              country={country}
              category={category}
              mode={mode}
              path={path
                .map((id) => indexed.units.get(id))
                .filter((value): value is NonNullable<typeof value> => !!value)}
              onImage={() => setModal("image")}
              onVehicle={() => setModal("vehicle")}
              onParts={openParts}
              onSelect={setSelected}
            />
          </Modal>
        )}
      </main>
      {(cartError || cartStorageError) && (
        <p role="alert" className="cart-error">
          {cartError || cartStorageError}
        </p>
      )}
      {modal === "image" && unit && (
        <Modal
          className="vehicle-image-modal"
          title={vehicleDisplayName(unit.name)}
          subtitle="官方载具大图"
          close={() => setModal(null)}
        >
          <VehicleImage key={unit.id} unit={unit} />
        </Modal>
      )}
      {modal === "parts" && tree && modifications && (
        <ModificationCalculator
          {...{ catalog: P, modifications, tree, country, category, selected, add }}
          close={() => setModal(null)}
        />
      )}{" "}
      {modal === "vehicle" &&
        tree &&
        (workspace?.userId && !workspace.ready ? (
          <Modal title="正在读取云端研发计划" close={() => setModal(null)}>
            <p className="calc-note">
              请等待账号数据读取完成。如读取失败，可从用户名菜单打开云端数据重试。
            </p>
          </Modal>
        ) : (
          <VehicleCalculator
            {...{ catalog: P, tree, country, category, selected, add }}
            close={() => setModal(null)}
          />
        ))}{" "}
      {modal === "cart" && (
        <Cart
          items={cart}
          remove={remove}
          error={cartError || cartStorageError}
          close={() => setModal(null)}
        />
      )}
    </div>
  );
  return (
    <WorkbenchPages.Provider value={{ tree: treePage, lineups: lineupsPage }}>
      {children}
    </WorkbenchPages.Provider>
  );
}
