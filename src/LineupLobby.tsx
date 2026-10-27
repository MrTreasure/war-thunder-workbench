import { t, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
// Fetch status and identity reset synchronize the current request/account with the UI.
/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Route } from "./routes/_workbench.lineups_.lobby";
import { LineupNavigation } from "./components/LineupNavigation";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { VehicleTile } from "./VehicleTile";
import { LineupTag } from "./LineupTag";
import { LineupImageDialog } from "./LineupShareTools";
import {
  communityRequest,
  communityTags,
  communityMode,
  communityLink,
} from "./lineup-community-api";
import type { CommunityPost, CommunityPage } from "./lineup-community-api";
import bootstrap from "./generated/bootstrap.json";
import { useVehicleCatalog } from "./vehicle-catalog";
import { lineupCardRating, validLineups } from "./lineups";
import type { Lineup, LineupVehicle } from "./lineups";
import { useStored } from "./storage";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { useAccountWorkspace } from "./workspace-context";

export function LineupLobby() {
  useLocale();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const account = useWorkbenchAccount();
  const userId = account.session?.user?.id;
  const [result, setResult] = useState<CommunityPage>({ items: [], page: 1, hasMore: false });
  const [detail, setDetail] = useState<CommunityPost | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [save, setSave] = useState<CommunityPost | null>(null);
  const [image, setImage] = useState<CommunityPost | null>(null);
  const [withdraw, setWithdraw] = useState<CommunityPost | null>(null);
  const [report, setReport] = useState<CommunityPost | null>(null);
  const [reason, setReason] = useState("misleading");
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = new URLSearchParams(
    Object.entries(search)
      .filter(([key, value]) => key !== "post" && value !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  useEffect(() => {
    if (search.mine && !userId) {
      setBusy(false);
      setResult({ items: [], page: 1, hasMore: false });
      return;
    }
    const abort = new AbortController();
    setBusy(true);
    setError("");
    setDetail(null);
    const request = search.post
      ? communityRequest<CommunityPost>(
          `posts/${encodeURIComponent(search.post)}`,
          undefined,
          abort.signal,
        ).then((value) => {
          if (!abort.signal.aborted) setDetail(value);
        })
      : communityRequest<CommunityPage>(`posts?${query}`, undefined, abort.signal).then((value) => {
          if (!abort.signal.aborted) setResult(value);
        });
    void request
      .catch((cause) => {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : t("载入失败"));
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [search.post, query, revision, userId, account.identityVersion, search.mine]);
  const posts = search.post ? (detail ? [detail] : []) : result.items;
  const facts = useVehicleCatalog(posts.map((p) => p.country));
  const units = useMemo(
    () => new Map([...facts].map(([id, value]) => [id, value as LineupVehicle])),
    [facts],
  );
  function filter(key: string, value: string) {
    void navigate({
      search: (previous: typeof search) => ({
        ...previous,
        [key]: value || undefined,
        post: undefined,
        page: undefined,
      }),
    });
  }
  function update(post: CommunityPost) {
    setResult((previous) => ({
      ...previous,
      items: previous.items.map((p) => (p.id === post.id ? post : p)),
    }));
    setDetail((previous) => (previous?.id === post.id ? post : previous));
  }
  async function vote(post: CommunityPost, value: number) {
    if (!account.session?.user) {
      await account.login();
      return;
    }
    setWorking(post.id);
    setMessage("");
    try {
      update(
        await communityRequest<CommunityPost>(`posts/${post.id}/vote`, {
          value: post.vote === value ? 0 : value,
        }),
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("评价失败，请重试。"));
    } finally {
      setWorking("");
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(t("已复制。"));
    } catch {
      setMessage(t("浏览器未允许复制，请手动选中：{0}", [value]));
    }
  }
  return (
    <main className="lineup-page wt-community-page">
      <div className="lineup-content">
        <header className="wt-lineup-pagebar">
          <LineupNavigation lobby />
          <Link className="quiet-button calc-open" to="/lineups" aria-label={t("分享我的队列 ↗")}>
            <span className="wt-community-share-long">{t("分享我的队列 ↗")}</span>
            <span className="wt-community-share-short" aria-hidden="true">
              {t("分享")}
            </span>
          </Link>
        </header>
        <h2 className="sr-only">{t("队列大厅")}</h2>
        {search.post ? (
          <Link
            className="wt-community-back"
            to="/lineups/lobby"
            search={{ ...search, post: undefined }}
          >
            {t("← 返回队列大厅")}
          </Link>
        ) : (
          <section className="wt-community-filter-panel" data-open={filtersOpen}>
            <button
              type="button"
              className="wt-community-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="lineup-lobby-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {t("筛选队列")}
              <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
            </button>
            <div
              id="lineup-lobby-filters"
              className="wt-community-filters"
              aria-label={t("筛选队列")}
            >
              <label className="calc-field">
                {t("国家")}
                <GameSelect
                  value={search.country || ""}
                  onValueChange={(value) => filter("country", value)}
                >
                  <option value="">{t("全部国家")}</option>
                  {Object.entries(bootstrap.countries).map(([id, label]) => (
                    <option key={id} value={id}>
                      {t(label)}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label className="calc-field">
                {t("战斗类型")}
                <GameSelect
                  value={search.battle || ""}
                  onValueChange={(value) => filter("battle", value)}
                >
                  <option value="">{t("全部类型")}</option>
                  <option value="ground">{t("陆战")}</option>
                  <option value="air">{t("空战")}</option>
                  <option value="naval">{t("海战")}</option>
                </GameSelect>
              </label>
              <label className="calc-field">
                {t("模式")}
                <GameSelect
                  value={search.mode || ""}
                  onValueChange={(value) => filter("mode", value)}
                >
                  <option value="">{t("全部模式")}</option>
                  <option value="ab">{t("街机")}</option>
                  <option value="rb">{t("历史")}</option>
                </GameSelect>
              </label>
              <label className="calc-field">
                {t("权重")}
                <GameSelect
                  value={search.step || ""}
                  onValueChange={(value) => filter("step", value)}
                >
                  <option value="">{t("全部权重")}</option>
                  {Array.from({ length: 43 }, (_, i) => (
                    <option key={i} value={String(i)}>
                      {(1 + i / 3).toFixed(1)}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label className="calc-field">
                {t("标签")}
                <GameSelect
                  value={search.tag || ""}
                  onValueChange={(value) => filter("tag", value)}
                >
                  <option value="">{t("全部标签")}</option>
                  {communityTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {t(tag.label)}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <label className="calc-field">
                {t("排序")}
                <GameSelect
                  value={search.sort || ""}
                  onValueChange={(value) => filter("sort", value)}
                >
                  <option value="">{t("最新发布")}</option>
                  <option value="popular">{t("最多推荐")}</option>
                </GameSelect>
              </label>
              <button
                className="quiet-button"
                aria-pressed={search.mine === "1"}
                onClick={() => {
                  if (!account.session?.user) void account.login();
                  else filter("mine", search.mine ? "" : "1");
                }}
              >
                {t("我的发布")}
              </button>
              {query && (
                <button
                  className="wt-vehicle-text-action"
                  onClick={() => void navigate({ search: {} })}
                >
                  {t("清除筛选")}
                </button>
              )}
            </div>
          </section>
        )}
        {message && <output className="lineup-feedback">{message}</output>}
        {error ? (
          <div className="lineup-empty">
            <h3>{t("暂时无法读取队列")}</h3>
            <p role="alert">{error}</p>
            <button className="quiet-button" onClick={() => setRevision((v) => v + 1)}>
              {t("重新加载")}
            </button>
          </div>
        ) : busy ? (
          <output className="lineup-feedback">{t("正在读取队列…")}</output>
        ) : posts.length ? (
          <div className={`wt-community-list ${search.post ? "is-detail" : ""}`}>
            {posts.map((post) => (
              <CommunityCard
                key={post.id}
                post={post}
                units={units}
                working={working === post.id}
                onVote={(value) => void vote(post, value)}
                onSave={() => setSave(post)}
                onImage={() => setImage(post)}
                onWithdraw={() => setWithdraw(post)}
                onReport={() => {
                  if (!account.session?.user) void account.login();
                  else setReport(post);
                }}
                onCopy={(value) => void copy(value)}
              />
            ))}
          </div>
        ) : (
          <div className="lineup-empty">
            <h3>
              {search.mine
                ? t("还没有分享过队列")
                : query
                  ? t("这个组合暂时没有队列")
                  : t("第一支队列，等你出击")}
            </h3>
            <p>
              {query
                ? t("调整国家、模式或权重，看看其他方案。")
                : t("在我的队列中选择一个方案，贴上标签后分享。")}
            </p>
            <Link className="quiet-button" to="/lineups">
              {t("前往我的队列")}
            </Link>
          </div>
        )}
        <details className="wt-community-rules">
          <summary>{t("权重规则与来源")}</summary>
          <p className="wt-community-notice">
            {t(
              "队列标签来自分享者的使用体验。权重按所选模式计算，可能分房范围为队列 BR ±1.0；单场房间跨度不超过 1.0。",
            )}
          </p>
        </details>
        {!search.post && !busy && !error && (result.hasMore || (search.page || 1) > 1) && (
          <nav className="wt-community-pagination" aria-label={t("队列分页")}>
            <button
              className="quiet-button"
              disabled={(search.page || 1) <= 1}
              onClick={() =>
                void navigate({
                  search: (previous: typeof search) => ({
                    ...previous,
                    page: (previous.page || 1) - 1,
                  }),
                })
              }
            >
              {t("上一页")}
            </button>
            <span>
              {t("第")}
              {search.page || 1}
              {t("页 · 每页 24 个")}
            </span>
            <button
              className="quiet-button"
              disabled={!result.hasMore}
              onClick={() =>
                void navigate({
                  search: (previous: typeof search) => ({
                    ...previous,
                    page: (previous.page || 1) + 1,
                  }),
                })
              }
            >
              {t("下一页")}
            </button>
          </nav>
        )}
        {save && <SaveCommunityLineup key={save.id} post={save} close={() => setSave(null)} />}
        {image && <LineupImageDialog post={image} units={units} close={() => setImage(null)} />}
        {withdraw && (
          <Modal
            title={t("下架队列")}
            subtitle={t("下架后大厅和公开链接将不再展示。你的私人队列不会删除。")}
            close={() => setWithdraw(null)}
            className="wt-community-dialog"
          >
            <button
              className="quiet-button"
              disabled={!!working}
              onClick={async () => {
                setWorking(withdraw.id);
                try {
                  await communityRequest(`posts/${withdraw.id}/withdraw`, {});
                  setWithdraw(null);
                  setRevision((v) => v + 1);
                  setMessage(t("队列已下架。"));
                  if (search.post) void navigate({ search: { mine: "1" } });
                } catch (cause) {
                  setMessage(cause instanceof Error ? cause.message : t("下架失败"));
                } finally {
                  setWorking("");
                }
              }}
            >
              {t("确认下架")}
            </button>
          </Modal>
        )}
        {report && (
          <Modal
            title={t("举报队列")}
            subtitle={t("请选择原因。举报不会扣除查询额度。")}
            close={() => setReport(null)}
            className="wt-community-dialog"
          >
            <label className="calc-field">
              {t("原因")}
              <GameSelect value={reason} onValueChange={setReason}>
                <option value="misleading">{t("标签或方案具有误导性")}</option>
                <option value="irrelevant">{t("与当前模式不符")}</option>
                <option value="abuse">{t("滥用分享功能")}</option>
              </GameSelect>
            </label>
            <button
              className="quiet-button"
              disabled={!!working}
              onClick={async () => {
                setWorking(report.id);
                try {
                  await communityRequest(`posts/${report.id}/report`, { reason });
                  setReport(null);
                  setMessage(t("已记录举报，感谢反馈。"));
                } catch (cause) {
                  setMessage(cause instanceof Error ? cause.message : t("提交失败"));
                } finally {
                  setWorking("");
                }
              }}
            >
              {t("提交举报")}
            </button>
          </Modal>
        )}
      </div>
    </main>
  );
}
// Horizontal rosters must be keyboard scrollable.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex */
function CommunityCard({
  post,
  units,
  working,
  onVote,
  onSave,
  onImage,
  onWithdraw,
  onReport,
  onCopy,
}: {
  post: CommunityPost;
  units: Map<string, LineupVehicle>;
  working: boolean;
  onVote: (value: number) => void;
  onSave: () => void;
  onImage: () => void;
  onWithdraw: () => void;
  onReport: () => void;
  onCopy: (value: string) => void;
}) {
  const workspace = useAccountWorkspace();
  const currentSearch = Route.useSearch();
  const ids = post.slots.filter((id): id is string => !!id);
  const owned = ids.filter((id) => workspace?.ownedVehicleIds.has(id)).length;
  const ready = ids.every((id) => units.has(id));
  return (
    <article className="wt-community-card">
      <header>
        <div className="wt-community-identity">
          <img
            src={bootstrap.flags[post.country as keyof typeof bootstrap.flags]}
            alt=""
            width={30}
            height={22}
          />
          <h3>
            <Link to="/lineups/lobby" search={{ ...currentSearch, post: post.id }}>
              {t(bootstrap.countries[post.country as keyof typeof bootstrap.countries])}{" "}
              <b>{post.rating}</b> <span>{communityMode(post.battle, post.mode)}</span>
            </Link>
          </h3>
        </div>
        <div className="wt-community-card-tags">
          {post.tags.map((id) => (
            <LineupTag key={id} id={id} tone={post.tagTones?.[id] || "red"} />
          ))}
        </div>
        <div className="wt-community-author">
          <strong>{post.author}</strong>
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleDateString(getLocale())}
          </time>
        </div>
      </header>
      <section className="wt-community-crew" aria-label={t("载具列表，可横向滚动")} tabIndex={0}>
        {ids.map((id) =>
          units.has(id) ? (
            <VehicleTile
              key={id}
              unit={units.get(id)!}
              mode={post.mode}
              showRank
              modeRating={lineupCardRating(units.get(id)!, post.battle, post.mode)}
              href={`https://wiki.warthunder.com/unit/${encodeURIComponent(id)}`}
            />
          ) : (
            <span className="wt-community-tile-loading" key={id}>
              {t("正在读取载具资料…")}
            </span>
          ),
        )}
      </section>
      <footer>
        <div className="wt-community-votes">
          <button
            disabled={working || post.mine}
            className="quiet-button"
            aria-pressed={post.vote === 1}
            onClick={() => onVote(1)}
          >
            {t("↑ 推荐")}
            {post.up}
          </button>
          <button
            disabled={working || post.mine}
            className="quiet-button"
            aria-pressed={post.vote === -1}
            onClick={() => onVote(-1)}
          >
            {t("↓ 不推荐")}
            {post.down}
          </button>
        </div>
        {workspace?.binding && (
          <small>
            {t("我的车库")}
            {owned}/{ids.length}
          </small>
        )}
        <div className="wt-community-actions">
          <button className="quiet-button" onClick={onSave}>
            {t("保存到我的队列")}
          </button>
          <button className="quiet-button" onClick={() => onCopy(post.code)}>
            {t("复制分享码")}
          </button>
          <button
            className="quiet-button"
            disabled={!ready || post.mode === "sb"}
            onClick={onImage}
          >
            {t("分享图片")}
          </button>
          <details className="wt-community-more">
            <summary>{t("更多")}</summary>
            <div>
              <button onClick={() => onCopy(communityLink(post.id))}>{t("复制队列链接")}</button>
              {post.mine ? (
                <button onClick={onWithdraw}>{t("下架队列")}</button>
              ) : (
                <button onClick={onReport}>{t("举报队列")}</button>
              )}
              <div className="wt-community-code">
                <span>{post.id}</span>
                <code>{post.code}</code>
              </div>
            </div>
          </details>
        </div>
      </footer>
    </article>
  );
}
function SaveCommunityLineup({ post, close }: { post: CommunityPost; close: () => void }) {
  const account = useWorkbenchAccount();
  const workspace = useAccountWorkspace();
  const [saved, save, error] = useStored<Lineup[]>(
    `wt-lineups-v1:${post.country}`,
    [],
    (v): v is Lineup[] => validLineups(v, bootstrap.lineup.maxSlots),
    undefined,
    true,
  );
  const [done, setDone] = useState(false);
  const [name, setName] = useState(
    `${t(bootstrap.countries[post.country as keyof typeof bootstrap.countries])} ${post.rating} ${communityMode(post.battle, post.mode)}`,
  );
  const blocked = !!account.session?.user && (!workspace?.ready || !workspace?.consented);
  return (
    <Modal
      title={done ? t("已保存到我的队列") : t("保存队列方案")}
      subtitle={
        account.session?.user
          ? t("保存为你账号中的新队列，不会覆盖已有方案。")
          : t("将保存到当前浏览器；登录后可使用账号云端队列。")
      }
      close={close}
      className="wt-community-dialog"
    >
      {done ? (
        <Link className="quiet-button calc-open" to="/lineups" search={{ country: post.country }}>
          {t("打开我的队列 ↗")}
        </Link>
      ) : (
        <>
          <label className="calc-field">
            {t("私人队列名称")}
            <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="calc-note">
            {post.slots.filter(Boolean).length}
            {t("辆 ·")}
            {communityMode(post.battle, post.mode)}
            {t("· 原始槽位和出击选择会保留。")}
          </p>
          {blocked && (
            <p className="calc-note">{t("请先在账号菜单中启用云端数据，再保存到账号。")}</p>
          )}
          <button
            className="quiet-button calc-open"
            disabled={blocked || !name.trim()}
            onClick={() => {
              if (
                save([
                  ...saved,
                  {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    slots: [...post.slots],
                    battleType: post.battle,
                    activeAircraft: post.activeAircraft || null,
                  },
                ])
              )
                setDone(true);
            }}
          >
            {t("确认保存")}
          </button>
          {error && (
            <p role="alert" className="lineup-feedback is-error">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
