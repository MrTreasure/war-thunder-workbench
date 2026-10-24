import { localize } from "./i18n/core";
import type { Decal, DecalDetail, DecalPage } from "./decal-api";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { readDecals } from "./decal-api";
import "./decal-catalog.css";

const kinds = { configured: "配置贴花", localization: "仅语言记录", announcement: "官方活动记录" };
function Picture({ decal }: { decal: Decal }) {
  useLocale();

  const [failed, setFailed] = useState(false);
  return (
    <div className="wt-decal-picture">
      {localize(
        decal.imageUrl && !failed ? (
          <img
            src={decal.imageUrl}
            alt={decal.nameZh || decal.nameEn || decal.id}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span>{localize(failed ? t("官图暂不可用") : t("暂无已确认官图"))}</span>
        ),
      )}
    </div>
  );
}
function Acquisition({ decal }: { decal: Decal }) {
  useLocale();

  if (decal.acquisitions.length) return <span>{t("公告限时任务")}</span>;
  if (decal.unlockResolution === "linked_definition_found")
    return <span>{t("已关联解锁条件")}</span>;
  return (
    <span className="wt-decal-muted">
      {localize(decal.kind === "localization" ? t("配置状态未确认") : t("获取条件待确认"))}
    </span>
  );
}
function Detail({ initial, close }: { initial: Decal; close: () => void }) {
  useLocale();

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
            <span className="wt-decal-label">{localize(kinds[decal.kind])}</span>
            <h3>{localize(decal.nameEn || t("英文名称未收录"))}</h3>
            <p>
              {localize(decal.categoryName)}
              {localize(decal.groupName ? ` / ${decal.groupName}` : "")}
            </p>
            <Acquisition decal={decal} />
            {localize(
              decal.priceGold != null && (
                <p>
                  {t("配置金鹰价格：")}
                  <b>{localize(decal.priceGold.toLocaleString())} GE</b>
                </p>
              ),
            )}
          </div>
        </div>
        {localize(
          error && (
            <p role="alert" className="wt-decal-error">
              {localize(error)} {t("仍保留已读取的条目。")}
            </p>
          ),
        )}
        {localize(loading && <output className="wt-decal-muted">{t("正在补全详情…")}</output>)}
        <section>
          <h3>{t("背景说明")}</h3>
          <p>{localize(decal.descriptionZh || t("暂无中文背景说明。"))}</p>
          {localize(
            decal.descriptionEn && (
              <p className="wt-decal-muted">{localize(decal.descriptionEn)}</p>
            ),
          )}
        </section>
        <section>
          <h3>{t("获取与解锁")}</h3>
          {localize(
            decal.acquisitions.map((a) => (
              <div className="wt-decal-event" key={a.sourceUrl}>
                <b>
                  {t("公告任务 ·")}
                  {localize(a.newOrReturning === "new" ? t("新增") : t("返场"))}
                </b>
                <p>
                  {localize(a.conditionZh)} {t("最低载具阶级：")}
                  {localize(a.minimumRank)} {t("级。")}
                </p>
                <p>
                  {localize(new Date(a.startAt).toLocaleString("zh-CN", { hour12: false }))} —
                  {localize(" ")}
                  {localize(new Date(a.endAt).toLocaleString("zh-CN", { hour12: false }))}
                  {t("（本地时间）")}
                </p>
                <p className="wt-decal-muted">
                  {t("原文：")}
                  {localize(a.conditionOriginal)}
                </p>
                <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                  {t("查看官方活动公告 ↗")}
                </a>
              </div>
            )),
          )}
          {localize(
            decal.unlockSummary.length ? (
              <>
                <p className="wt-decal-muted">
                  {t("条件按本地配置整理，保留层级与进度倍率；不是游戏界面的逐字文案。")}
                </p>
                {localize(
                  decal.unlockSummary.map((rule, index) => (
                    <div key={index}>
                      <small>
                        {t("解锁任务：")}
                        {localize(rule.unlock_id)}
                      </small>
                      <pre className="wt-decal-conditions">{localize(rule.lines.join("\n"))}</pre>
                    </div>
                  )),
                )}
              </>
            ) : (
              !decal.acquisitions.length && (
                <p>{t("尚无已确认的获取条件，不能据此认定免费、永久可得或无法获取。")}</p>
              )
            ),
          )}
          {localize(decal.hideUntilUnlocked && <p>{t("配置可见性：未解锁前隐藏。")}</p>)}
          {localize(
            !!decal.hiddenLanguages?.length && (
              <p>
                {t("配置语言隐藏项：")}
                {localize(decal.hiddenLanguages.join("、"))}
              </p>
            ),
          )}
        </section>
        <section>
          <h3>{t("资料来源")}</h3>
          <p>{localize(decal.sourceLabel)}</p>
          {localize(
            decal.nameZhBasis && <p className="wt-decal-muted">{localize(decal.nameZhBasis)}</p>,
          )}
          <p className="wt-decal-muted">
            {t(
              "静态配置与历史公告不代表当前账号拥有状态、实时价格或当前可获取性。官图直接来自原始官方地址。",
            )}
          </p>
          {localize(
            decal.sourceUrls.map((url) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {t("官方来源 ↗")}
                </a>
              </p>
            )),
          )}
        </section>
        {localize(
          !!decal.unlockRules?.length && (
            <details>
              <summary>{t("查看原始条件结构")}</summary>
              <pre className="wt-decal-raw">
                {localize(JSON.stringify(decal.unlockRules, null, 2))}
              </pre>
            </details>
          ),
        )}
      </div>
    </Modal>
  );
}
export function DecalCatalog() {
  useLocale();

  const search = useSearch({ from: "/_workbench/decals" });
  const { session, busy, error, login, identityVersion } = useWorkbenchAccount();
  if (!session?.user?.id)
    return (
      <main className="wt-decal-page">
        <header className="wt-decal-heading">
          <div>
            <span className="wt-decal-label">CUSTOMIZATION ARCHIVE</span>
            <h2>{t("贴花查询")}</h2>
            <p>{t("登录后可查询贴花背景、分类与解锁条件，不消耗战绩查询额度。")}</p>
          </div>
        </header>
        <section className="wt-decal-login">
          <h3>{t("登录后使用贴花查询")}</h3>
          <p>{t("使用页面右上角的账号登录，或点击下方按钮继续。")}</p>
          <button className="quiet-button" disabled={busy} onClick={() => void login()}>
            {localize(busy ? t("正在登录…") : t("登录并查询"))}
          </button>
          {localize(
            error && (
              <p role="alert" className="wt-decal-error">
                {localize(error)}
              </p>
            ),
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
  useLocale();

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
          <h2>{t("贴花查询")}</h2>
          <p>
            {t(
              "检索贴花名称、背景与解锁条件。资料范围为客户端配置及已核对的官方公告，不代表实时可获取全集。",
            )}
          </p>
        </div>
        {localize(
          data && (
            <div className="wt-decal-stat">
              <strong>{localize(data.summary.configured.toLocaleString())}</strong>
              <span>{t("配置贴花")}</span>
              <small>
                {t("另有")}
                {localize(data.summary.localization)} {t("条语言记录 ·")}
                {localize(data.summary.announcement)} {t("条活动记录")}
              </small>
            </div>
          ),
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
          <span>{t("名称 / ID / 背景")}</span>
          <div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={80}
              placeholder={t("例如：黑桃、back_03、酒鬼")}
            />
            <button className="quiet-button" type="submit">
              {t("查询")}
            </button>
          </div>
        </label>
        <label>
          <span>{t("资料类型")}</span>
          <GameSelect value={search.kind} onValueChange={(kind) => change({ kind, category: "" })}>
            {localize(
              Object.entries(kinds).map(([id, name]) => (
                <option key={id} value={id}>
                  {localize(name)}
                </option>
              )),
            )}
          </GameSelect>
        </label>
        <label>
          <span>{t("分类")}</span>
          <GameSelect value={search.category} onValueChange={(category) => change({ category })}>
            <option value="">{t("全部分类")}</option>
            {data?.summary.categories
              .filter((c) =>
                search.kind === "configured"
                  ? !["announcement", "localization"].includes(c.id)
                  : c.id === search.kind,
              )
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name} · {localize(c.count)}
                </option>
              ))}
          </GameSelect>
        </label>
        <label>
          <span>{t("解锁资料")}</span>
          <GameSelect value={search.unlock} onValueChange={(unlock) => change({ unlock })}>
            <option value="">{t("全部")}</option>
            <option value="linked">{t("已关联条件")}</option>
            <option value="unknown">{t("未关联条件")}</option>
          </GameSelect>
        </label>
        <label>
          <span>{t("图片")}</span>
          <GameSelect value={search.image} onValueChange={(image) => change({ image })}>
            <option value="">{t("全部")}</option>
            <option value="yes">{t("有已确认官图")}</option>
          </GameSelect>
        </label>
        <button
          className="quiet-button"
          type="button"
          onClick={() => change({ q: "", category: "", kind: "configured", unlock: "", image: "" })}
        >
          {t("重置")}
        </button>
      </form>
      <div className="wt-decal-result-meta" aria-live="polite">
        <span>
          {localize(
            data ? t("共 {0} 条结果", [data.total.toLocaleString()]) : t("正在读取贴花目录…"),
          )}
          {localize(loading && data ? t(" · 正在更新") : "")}
        </span>
        {localize(
          data && (
            <span>
              {t("配置归档：")}
              {localize(new Date(data.summary.sourceExportedAt).toLocaleDateString("zh-CN"))}
            </span>
          ),
        )}
      </div>
      {localize(
        error && (
          <div className="wt-decal-error" role="alert">
            {localize(error)} {localize(data && t("已保留缓存资料。"))}
            <button
              className="quiet-button"
              onClick={() => {
                setError("");
                setLoading(true);
                setRevision((v) => v + 1);
              }}
            >
              {t("重试")}
            </button>
          </div>
        ),
      )}
      <div className="wt-decal-list" aria-busy={loading}>
        {localize(
          data?.items.map((decal) => (
            <button className="wt-decal-row" key={decal.id} onClick={() => setSelected(decal)}>
              <Picture decal={decal} />
              <div className="wt-decal-row-name">
                <h3>{localize(decal.nameZh || decal.nameEn || decal.id)}</h3>
                <code>{localize(decal.id)}</code>
                <p>{localize(decal.descriptionZh || decal.nameEn || t("暂无背景说明"))}</p>
              </div>
              <div className="wt-decal-row-category">
                <span>{localize(decal.categoryName)}</span>
                <small>{localize(decal.groupName || kinds[decal.kind])}</small>
              </div>
              <div className="wt-decal-row-status">
                <Acquisition decal={decal} />
                <small>
                  {localize(
                    decal.priceGold == null
                      ? t("金鹰价格待确认")
                      : t("配置价 {0} GE", [decal.priceGold.toLocaleString()]),
                  )}
                </small>
              </div>
              <span className="wt-decal-open">{t("详情 ↗")}</span>
            </button>
          )),
        )}
        {localize(
          !data && loading && <output className="wt-decal-empty">{t("正在读取贴花资料…")}</output>,
        )}
        {localize(
          data && !data.items.length && (
            <div className="wt-decal-empty">
              {t("没有匹配的贴花，可尝试更短的关键词或调整筛选。")}
            </div>
          ),
        )}
      </div>
      {localize(
        data && (
          <nav className="wt-decal-pagination" aria-label={t("贴花结果分页")}>
            <button
              className="quiet-button"
              disabled={search.page <= 1 || loading}
              onClick={() => change({ page: search.page - 1 })}
            >
              {t("上一页")}
            </button>
            <span>
              {localize(search.page)} / {localize(pages)}
            </span>
            <button
              className="quiet-button"
              disabled={search.page >= pages || loading}
              onClick={() => change({ page: search.page + 1 })}
            >
              {t("下一页")}
            </button>
          </nav>
        ),
      )}
      {localize(
        selected && <Detail key={selected.id} initial={selected} close={() => setSelected(null)} />,
      )}
    </main>
  );
}
