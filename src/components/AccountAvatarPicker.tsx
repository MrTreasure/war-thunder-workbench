import { useEffect, useState } from "react";
import catalog from "../../data/account-avatars.json";
import "../account-avatar.css";
import { GameSelect } from "./GameSelect";
export type AvatarOption = {
  id: string;
  label: string;
  url: string;
  fallbackUrl?: string;
  source?: string;
};
function ChoiceImage({ item }: { item: AvatarOption }) {
  const [fallback, setFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded || fallback || !item.fallbackUrl) return;
    const timer = window.setTimeout(() => setFallback(true), 8000);
    return () => window.clearTimeout(timer);
  }, [loaded, fallback, item.fallbackUrl]);
  return (
    <img
      src={fallback && item.fallbackUrl ? item.fallbackUrl : item.url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (item.fallbackUrl && !fallback) setFallback(true);
      }}
    />
  );
}
export default function AccountAvatarPicker({
  currentId,
  linked = [],
  authenticated,
  onSelect,
}: {
  currentId?: string | null;
  linked?: AvatarOption[];
  authenticated: boolean;
  onSelect: (id: string) => Promise<void>;
}) {
  const [group, setGroup] = useState<"official" | "heybox">("official");
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(currentId || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [country, setCountry] = useState("all"),
    [branch, setBranch] = useState("all"),
    [search, setSearch] = useState("");
  const official = catalog.avatars.filter(
    (item) =>
      (country === "all" ||
        (country === "unknown"
          ? item.countryIds.length === 0
          : item.countryIds.includes(country))) &&
      (branch === "all" ||
        (branch === "unknown" ? item.branchIds.length === 0 : item.branchIds.includes(branch))) &&
      (!search.trim() ||
        (item.id + " " + item.label + " " + ("nameEn" in item ? item.nameEn : ""))
          .toLowerCase()
          .includes(search.trim().toLowerCase())),
  );
  const options: AvatarOption[] = group === "official" ? official : linked;
  const pages = Math.max(1, Math.ceil(options.length / 24));
  const activePage = Math.min(page, pages);
  const visible = options.slice((activePage - 1) * 24, activePage * 24);
  return (
    <section className="wt-avatar-picker" aria-label="头像选择">
      <p>创建账号时随机分配战雷头像。可选择官方头像或已关联的小黑盒头像，不支持上传图片。</p>
      <div className="wt-avatar-groups">
        <button
          type="button"
          aria-pressed={group === "official"}
          onClick={() => {
            setGroup("official");
            setPage(1);
          }}
        >
          战雷官方头像
        </button>
        <button
          type="button"
          aria-pressed={group === "heybox"}
          onClick={() => {
            setGroup("heybox");
            setPage(1);
          }}
        >
          小黑盒头像
        </button>
      </div>
      {group === "official" && (
        <div className="wt-avatar-filters">
          <GameSelect
            aria-label="头像国家"
            value={country}
            onValueChange={(value) => {
              setCountry(value);
              setPage(1);
            }}
          >
            <option value="all">全部国家</option>
            {catalog.countryFilters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value="unknown">国家未分类</option>
          </GameSelect>
          <GameSelect
            aria-label="头像军种"
            value={branch}
            onValueChange={(value) => {
              setBranch(value);
              setPage(1);
            }}
          >
            <option value="all">全部军种</option>
            {catalog.branchFilters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value="unknown">军种未分类</option>
          </GameSelect>
          <input
            aria-label="搜索头像"
            placeholder="搜索头像名称或编号"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      <div className="wt-avatar-grid">
        {visible.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selected === item.id ? "is-selected" : ""}
            aria-pressed={selected === item.id}
            aria-label={"选择" + item.label}
            onClick={() => setSelected(item.id)}
            disabled={busy}
          >
            <ChoiceImage key={item.id} item={item} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {!visible.length && (
        <p className="wt-avatar-empty">
          {group === "heybox"
            ? "关联小黑盒后，可在这里选择该账号的头像。"
            : "暂无符合筛选条件的头像。"}
        </p>
      )}
      <div className="wt-avatar-pagination">
        <button
          type="button"
          disabled={activePage <= 1 || busy}
          onClick={() => setPage(activePage - 1)}
        >
          上一页
        </button>
        <span>
          第 {activePage} / {pages} 页 · 共 {options.length} 个
        </span>
        <button
          type="button"
          disabled={activePage >= pages || busy}
          onClick={() => setPage(activePage + 1)}
        >
          下一页
        </button>
      </div>
      {error && (
        <p role="alert" className="wt-avatar-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="wt-avatar-save"
        disabled={!authenticated || !selected || busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void onSelect(selected)
            .catch((error) => setError(error instanceof Error ? error.message : "头像暂未保存"))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "保存中…" : authenticated ? "使用选中头像" : "登录后可设置头像"}
      </button>
    </section>
  );
}
