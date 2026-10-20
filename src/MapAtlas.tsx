import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import atlas from "../data/map-atlas.json";
import { Route } from "./routes/_workbench.maps";
import { MapImageViewer } from "./MapImageViewer";
import { clearMapImages } from "./map-image-cache";

const images = new Map(atlas.images.map((image) => [image.id, image]));
const normal = (value: string) =>
  value.normalize("NFKC").toLowerCase().replaceAll("日耀", "日曜").trim();
export function MapAtlas() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/maps" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [cacheStatus, setCacheStatus] = useState("");
  const [clearing, setClearing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const guide = atlas.guides.find((g) => g.id === search.map) || atlas.guides[0];
  const variant = guide.variants.find((v) => v.id === search.side) || guide.variants[0];
  const image = images.get(variant.imageId || "");
  const annotated = (g: typeof guide) =>
    g.variants.some((v) => images.get(v.imageId || "")?.kind === "走线图");
  const matches = atlas.guides.filter(
    (g) =>
      normal(g.name + g.overview).includes(normal(query)) &&
      (filter === "all" || (filter === "routes" ? annotated(g) : !annotated(g))),
  );
  const updated = atlas.collection.entries.find((entry) => entry.id === guide.id)?.updatedAt;
  const chooseSide = (id: string) =>
    void navigate({ search: { map: guide.id, side: id }, replace: true, resetScroll: false });
  const sideTabs = () =>
    guide.variants.map((v) => (
      <button key={v.id} aria-pressed={v.id === variant.id} onClick={() => chooseSide(v.id)}>
        {v.side}
      </button>
    ));
  return (
    <main className="atlas-page" aria-label="走线攻略">
      <div className="atlas-heading">
        <div>
          <h1>走线攻略</h1>
          <p>选地图、分出生侧，先读开局，再看转点。</p>
        </div>
        <a
          className="atlas-source-link"
          href={atlas.collection.source}
          target="_blank"
          rel="noreferrer"
        >
          木炉合集 ↗
        </a>
      </div>
      <div className="atlas-layout">
        <aside className="atlas-directory" aria-label="地图目录" data-expanded={directoryOpen}>
          <div className="atlas-directory-heading">
            <strong>地图目录</strong>
            <span>{atlas.guides.length} 张</span>
          </div>
          <button
            className="atlas-directory-toggle"
            aria-expanded={directoryOpen}
            aria-controls="atlas-directory-content"
            onClick={() => setDirectoryOpen((v) => !v)}
          >
            <span>
              切换地图 <strong>{guide.name}</strong>
            </span>
            <span>{directoryOpen ? "收起 ∧" : "展开 ∨"}</span>
          </button>
          <div id="atlas-directory-content" className="atlas-directory-content">
            <label className="atlas-search">
              <span className="sr-only">搜索地图</span>
              <input
                type="search"
                placeholder="搜索地图"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <fieldset className="atlas-filter" aria-label="攻略类型">
              {[
                ["all", "全部"],
                ["routes", "走线图"],
                ["pending", "待补图"],
              ].map(([id, label]) => (
                <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </fieldset>
            <div className="atlas-map-list">
              {matches.map((g) => {
                const thumbnail = images.get(g.variants[0].imageId || "");
                return (
                  <button
                    key={g.id}
                    className="atlas-map-item"
                    aria-current={g.id === guide.id ? "true" : undefined}
                    onClick={() => {
                      setViewer(false);
                      setDirectoryOpen(false);
                      void navigate({ search: { map: g.id, side: undefined } });
                      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
                    }}
                  >
                    {thumbnail && (
                      <img src={thumbnail.thumb} alt="" loading="lazy" width={64} height={48} />
                    )}
                    <span>
                      <strong>{g.name}</strong>
                      <small>
                        {annotated(g)
                          ? `${g.variants.length} 个出生侧 · 走线图`
                          : "已整理摘要 · 待补标注图"}
                      </small>
                    </span>
                  </button>
                );
              })}
              {!matches.length && (
                <div className="atlas-empty">
                  <p>没有匹配的地图</p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        <div className="atlas-reading">
          <section className="atlas-briefing" aria-labelledby="atlas-map-title">
            <header className="atlas-briefing-heading">
              <div>
                <span className="atlas-map-type">
                  {image?.kind === "走线图" ? "走线标注图" : "攻略摘要 · 标注图待补"}
                </span>
                <h2 id="atlas-map-title" ref={heading} tabIndex={-1}>
                  {guide.name}
                </h2>
              </div>
              <a href={guide.source} className="atlas-source-link" target="_blank" rel="noreferrer">
                阅读原帖 ↗
              </a>
            </header>
            <p className="atlas-overview">{guide.overview}</p>
            <div className="atlas-side-bar">
              <span>出生侧</span>
              <fieldset className="atlas-side-tabs" aria-label="出生侧">
                {sideTabs()}
              </fieldset>
            </div>
            <div className="atlas-brief-grid">
              <div className="atlas-visual-column">
                {image ? (
                  <figure className="atlas-figure">
                    <button
                      className="atlas-map-preview"
                      onClick={() => setViewer(true)}
                      aria-label={`放大${guide.name}${variant.side}${image.kind}`}
                    >
                      <img
                        key={image.id}
                        src={image.thumb}
                        alt={`${guide.name} · ${variant.side}${image.kind}`}
                        width={800}
                        height={600}
                      />
                      <span>⛶ 打开高清{image.kind}</span>
                    </button>
                    <figcaption>
                      {image.kind === "原图"
                        ? "当前展示地图底图。走线编号和标注请在作者原帖查看。"
                        : `图上编号与下方说明对应 · ${variant.side}`}
                    </figcaption>
                  </figure>
                ) : (
                  <p className="atlas-empty">这张地图暂未收录图片，请阅读原帖。</p>
                )}
                {image?.kind === "走线图" && (
                  <ul className="atlas-legend" aria-label="走线图图例">
                    {[
                      ["red", "红", "走线路线"],
                      ["green", "绿", "对方路线 / 防线"],
                      ["yellow", "黄", "打击方向"],
                      ["white", "白", "高概率受击方向"],
                      ["blue", "蓝", "标记指示"],
                    ].map(([color, label, text]) => (
                      <li key={color}>
                        <i className={`atlas-key-${color}`} />
                        <span>
                          {label}：{text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <article className="atlas-notes" aria-label={`${variant.side}走线说明`}>
                <h3>{variant.side}怎么走</h3>
                <dl>
                  {variant.notes.map((note) => (
                    <div key={note.label}>
                      <dt>{note.label}</dt>
                      <dd>{note.text}</dd>
                    </div>
                  ))}
                </dl>
                <p className="atlas-scope">{guide.mode}</p>
              </article>
            </div>
            <div className="atlas-verified">
              <span>摘要核对 {guide.verifiedAt}</span>
              {updated && <span>原帖编辑 {updated.slice(0, 10)}</span>}
            </div>
          </section>
          <details className="atlas-details">
            <summary>
              合集更新核对{" "}
              <span>
                {atlas.collection.checkedAt.slice(0, 10)} · {atlas.collection.count} 篇
              </span>
            </summary>
            <div>
              <p>
                合集已完整核对，现有 {atlas.guides.length}{" "}
                篇地图攻略。编辑时间来自合集记录，摘要日期与原帖编辑日期分别展示。
              </p>
              {atlas.collection.newEntries.map((entry) => (
                <p key={entry.id}>
                  <a href={entry.source} target="_blank" rel="noreferrer">
                    {entry.title} ↗
                  </a>
                  <small> · {entry.publishedAt.slice(0, 10)} · 合集补充文章</small>
                </p>
              ))}
              <p>
                小突尼斯、莫兹多克已收录摘要，高清标注图仍待补充。未核实的点位和地图变体不补写。
              </p>
            </div>
          </details>
          <details className="atlas-details">
            <summary>
              总论与旧版资料 <span>按各自原图阅读</span>
            </summary>
            <div>
              {atlas.resources.map((resource) => (
                <section key={resource.source}>
                  <h3>
                    <a href={resource.source} target="_blank" rel="noreferrer">
                      {resource.title} ↗
                    </a>
                  </h3>
                  <p>{resource.context}</p>
                </section>
              ))}
            </div>
          </details>
          <footer className="atlas-footer">
            <p>{atlas.scope}</p>
            <p>{atlas.attribution}</p>
            <div>
              <span>高清图仅在点开时读取，可在本机保存以便下次查看。</span>
              <button
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  setCacheStatus("");
                  try {
                    await clearMapImages();
                    setCacheStatus("地图缓存已清理");
                  } catch {
                    setCacheStatus("暂时无法清理，请稍后重试");
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                {clearing ? "正在清理…" : "清理地图缓存"}
              </button>
            </div>
            <output>{cacheStatus}</output>
          </footer>
        </div>
      </div>
      {viewer && image && (
        <MapImageViewer
          key={image.id}
          image={image}
          side={variant.side}
          close={() => setViewer(false)}
        >
          {sideTabs()}
        </MapImageViewer>
      )}
    </main>
  );
}
