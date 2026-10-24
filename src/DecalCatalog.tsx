import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { readDecals, type Decal, type DecalPage, type DecalDetail } from "./decal-api";
import "./decal-catalog.css";

const kinds = { configured: "配置贴花", localization: "仅语言记录", announcement: "官方活动记录" };
function Picture({ decal }: { decal: Decal }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="wt-decal-picture">
      {decal.imageUrl && !failed ? (
        <img
          src={decal.imageUrl}
          alt={decal.nameZh || decal.nameEn || decal.id}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{failed ? "官图暂不可用" : "暂无已确认官图"}</span>
      )}
    </div>
  );
}
function Acquisition({ decal }: { decal: Decal }) {
  if (decal.acquisitions.length) return <span>公告限时任务</span>;
  if (decal.unlockResolution === "linked_definition_found") return <span>已关联解锁条件</span>;
  return (
    <span className="wt-decal-muted">
      {decal.kind === "localization" ? "配置状态未确认" : "获取条件待确认"}
    </span>
  );
}
function Detail({ initial, close }: { initial: Decal; close: () => void }) {
  const [decal, setDecal] = useState(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    void readDecals<DecalDetail>("/" + encodeURIComponent(initial.id), c.signal, (value) =>
      setDecal(value.item),
    )
      .then((value) => setDecal(value.item))
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [initial.id]);
  return (
    <Modal
      title={decal.nameZh || decal.nameEn || decal.id}
      subtitle={decal.id}
      close={close}
      className="wt-decal-dialog"
    >
      <div className="wt-decal-detail">
        <div className="wt-decal-detail-identity">
          <Picture decal={decal} />
          <div>
            <span className="wt-decal-label">{kinds[decal.kind]}</span>
            <h3>{decal.nameEn || "英文名称未收录"}</h3>
            <p>
              {decal.categoryName}
              {decal.groupName ? ` / ${decal.groupName}` : ""}
            </p>
            <Acquisition decal={decal} />
            {decal.priceGold != null && (
              <p>
                配置金鹰价格：<b>{decal.priceGold.toLocaleString()} GE</b>
              </p>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="wt-decal-error">
            {error} 仍保留已读取的条目。
          </p>
        )}
        {loading && <output className="wt-decal-muted">正在补全详情…</output>}
        <section>
          <h3>背景说明</h3>
          <p>{decal.descriptionZh || "暂无中文背景说明。"}</p>
          {decal.descriptionEn && <p className="wt-decal-muted">{decal.descriptionEn}</p>}
        </section>
        <section>
          <h3>获取与解锁</h3>
          {decal.acquisitions.map((a) => (
            <div className="wt-decal-event" key={a.sourceUrl}>
              <b>公告任务 · {a.newOrReturning === "new" ? "新增" : "返场"}</b>
              <p>
                {a.conditionZh} 最低载具阶级：{a.minimumRank} 级。
              </p>
              <p>
                {new Date(a.startAt).toLocaleString("zh-CN", { hour12: false })} —{" "}
                {new Date(a.endAt).toLocaleString("zh-CN", { hour12: false })}（本地时间）
              </p>
              <p className="wt-decal-muted">原文：{a.conditionOriginal}</p>
              <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                查看官方活动公告 ↗
              </a>
            </div>
          ))}
          {decal.unlockSummary.length ? (
            <>
              <p className="wt-decal-muted">
                条件按本地配置整理，保留层级与进度倍率；不是游戏界面的逐字文案。
              </p>
              {decal.unlockSummary.map((rule, index) => (
                <div key={index}>
                  <small>解锁任务：{rule.unlock_id}</small>
                  <pre className="wt-decal-conditions">{rule.lines.join("\n")}</pre>
                </div>
              ))}
            </>
          ) : (
            !decal.acquisitions.length && (
              <p>尚无已确认的获取条件，不能据此认定免费、永久可得或无法获取。</p>
            )
          )}
          {decal.hideUntilUnlocked && <p>配置可见性：未解锁前隐藏。</p>}
          {!!decal.hiddenLanguages?.length && (
            <p>配置语言隐藏项：{decal.hiddenLanguages.join("、")}</p>
          )}
        </section>
        <section>
          <h3>资料来源</h3>
          <p>{decal.sourceLabel}</p>
          {decal.nameZhBasis && <p className="wt-decal-muted">{decal.nameZhBasis}</p>}
          <p className="wt-decal-muted">
            静态配置与历史公告不代表当前账号拥有状态、实时价格或当前可获取性。官图直接来自原始官方地址。
          </p>
          {decal.sourceUrls.map((url) => (
            <p key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                官方来源 ↗
              </a>
            </p>
          ))}
        </section>
        {!!decal.unlockRules?.length && (
          <details>
            <summary>查看原始条件结构</summary>
            <pre className="wt-decal-raw">{JSON.stringify(decal.unlockRules, null, 2)}</pre>
          </details>
        )}
      </div>
    </Modal>
  );
}
export function DecalCatalog() {
  const search = useSearch({ from: "/_workbench/decals" });
  const { session, busy, error, login, identityVersion } = useWorkbenchAccount();
  if (!session?.user?.id)
    return (
      <main className="wt-decal-page">
        <header className="wt-decal-heading">
          <div>
            <span className="wt-decal-label">CUSTOMIZATION ARCHIVE</span>
            <h2>贴花查询</h2>
            <p>登录后可查询贴花背景、分类与解锁条件，不消耗战绩查询额度。</p>
          </div>
        </header>
        <section className="wt-decal-login">
          <h3>登录后使用贴花查询</h3>
          <p>使用页面右上角的账号登录，或点击下方按钮继续。</p>
          <button className="quiet-button" disabled={busy} onClick={() => void login()}>
            {busy ? "正在登录…" : "登录并查询"}
          </button>
          {error && (
            <p role="alert" className="wt-decal-error">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  return (
    <DecalResults
      key={session.user.id + ":" + identityVersion + ":" + JSON.stringify(search)}
      search={search}
    />
  );
}
function DecalResults({
  search,
}: {
  search: {
    q: string;
    category: string;
    kind: string;
    unlock: string;
    image: string;
    page: number;
  };
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(search.q),
    [data, setData] = useState<DecalPage | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Decal | null>(null);
  const params = new URLSearchParams({
    q: search.q,
    category: search.category,
    kind: search.kind,
    unlock: search.unlock,
    image: search.image,
    offset: String((search.page - 1) * 24),
    limit: "24",
  }).toString();
  const change = (values: Partial<typeof search>) => {
    void navigate({ to: "/decals", search: { ...search, ...values, page: values.page ?? 1 } });
  };
  useEffect(() => {
    const c = new AbortController();
    void readDecals<DecalPage>("?" + params, c.signal, setData)
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [params, revision]);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 24));
  return (
    <main className="wt-decal-page">
      <header className="wt-decal-heading">
        <div>
          <span className="wt-decal-label">CUSTOMIZATION ARCHIVE</span>
          <h2>贴花查询</h2>
          <p>
            检索贴花名称、背景与解锁条件。资料范围为客户端配置及已核对的官方公告，不代表实时可获取全集。
          </p>
        </div>
        {data && (
          <div className="wt-decal-stat">
            <strong>{data.summary.configured.toLocaleString()}</strong>
            <span>配置贴花</span>
            <small>
              另有 {data.summary.localization} 条语言记录 · {data.summary.announcement} 条活动记录
            </small>
          </div>
        )}
      </header>
      <form
        className="wt-decal-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          change({ q: draft.trim() });
        }}
      >
        <label className="wt-decal-search">
          <span>名称 / ID / 背景</span>
          <div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={80}
              placeholder="例如：黑桃、back_03、酒鬼"
            />
            <button className="quiet-button" type="submit">
              查询
            </button>
          </div>
        </label>
        <label>
          <span>资料类型</span>
          <GameSelect value={search.kind} onValueChange={(kind) => change({ kind, category: "" })}>
            {Object.entries(kinds).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </GameSelect>
        </label>
        <label>
          <span>分类</span>
          <GameSelect value={search.category} onValueChange={(category) => change({ category })}>
            <option value="">全部分类</option>
            {data?.summary.categories
              .filter((c) =>
                search.kind === "configured"
                  ? !["announcement", "localization"].includes(c.id)
                  : c.id === search.kind,
              )
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name} · {c.count}
                </option>
              ))}
          </GameSelect>
        </label>
        <label>
          <span>解锁资料</span>
          <GameSelect value={search.unlock} onValueChange={(unlock) => change({ unlock })}>
            <option value="">全部</option>
            <option value="linked">已关联条件</option>
            <option value="unknown">未关联条件</option>
          </GameSelect>
        </label>
        <label>
          <span>图片</span>
          <GameSelect value={search.image} onValueChange={(image) => change({ image })}>
            <option value="">全部</option>
            <option value="yes">有已确认官图</option>
          </GameSelect>
        </label>
        <button
          className="quiet-button"
          type="button"
          onClick={() => change({ q: "", category: "", kind: "configured", unlock: "", image: "" })}
        >
          重置
        </button>
      </form>
      <div className="wt-decal-result-meta" aria-live="polite">
        <span>
          {data ? `共 ${data.total.toLocaleString()} 条结果` : "正在读取贴花目录…"}
          {loading && data ? " · 正在更新" : ""}
        </span>
        {data && (
          <span>
            配置归档：{new Date(data.summary.sourceExportedAt).toLocaleDateString("zh-CN")}
          </span>
        )}
      </div>
      {error && (
        <div className="wt-decal-error" role="alert">
          {error} {data && "已保留缓存资料。"}
          <button
            className="quiet-button"
            onClick={() => {
              setError("");
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            重试
          </button>
        </div>
      )}
      <div className="wt-decal-list" aria-busy={loading}>
        {data?.items.map((decal) => (
          <button className="wt-decal-row" key={decal.id} onClick={() => setSelected(decal)}>
            <Picture decal={decal} />
            <div className="wt-decal-row-name">
              <h3>{decal.nameZh || decal.nameEn || decal.id}</h3>
              <code>{decal.id}</code>
              <p>{decal.descriptionZh || decal.nameEn || "暂无背景说明"}</p>
            </div>
            <div className="wt-decal-row-category">
              <span>{decal.categoryName}</span>
              <small>{decal.groupName || kinds[decal.kind]}</small>
            </div>
            <div className="wt-decal-row-status">
              <Acquisition decal={decal} />
              <small>
                {decal.priceGold == null
                  ? "金鹰价格待确认"
                  : `配置价 ${decal.priceGold.toLocaleString()} GE`}
              </small>
            </div>
            <span className="wt-decal-open">详情 ↗</span>
          </button>
        ))}
        {!data && loading && <output className="wt-decal-empty">正在读取贴花资料…</output>}
        {data && !data.items.length && (
          <div className="wt-decal-empty">没有匹配的贴花，可尝试更短的关键词或调整筛选。</div>
        )}
      </div>
      {data && (
        <nav className="wt-decal-pagination" aria-label="贴花结果分页">
          <button
            className="quiet-button"
            disabled={search.page <= 1 || loading}
            onClick={() => change({ page: search.page - 1 })}
          >
            上一页
          </button>
          <span>
            {search.page} / {pages}
          </span>
          <button
            className="quiet-button"
            disabled={search.page >= pages || loading}
            onClick={() => change({ page: search.page + 1 })}
          >
            下一页
          </button>
        </nav>
      )}
      {selected && <Detail key={selected.id} initial={selected} close={() => setSelected(null)} />}
    </main>
  );
}
