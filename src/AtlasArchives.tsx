import { useState } from "react";
import library from "../data/map-collections.json";

type Collection = (typeof library.collections)[number];
type Entry = Collection["entries"][number];
const categoryName = (category: string) =>
  library.categoryLabels[category as keyof typeof library.categoryLabels] || "其他资料";
const dateLabel = (value: string) =>
  new Date(value)
    .toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replaceAll("/", "-");
function ArchiveEntry({ entry, collection }: { entry: Entry; collection: Collection }) {
  const check = collection.articleChecks[entry.id as keyof typeof collection.articleChecks];
  const checked = check?.updatedAt === entry.updatedAt;
  return (
    <li className="atlas-archive-entry">
      <a href={entry.source} target="_blank" rel="noreferrer">
        {entry.title}
        <span aria-hidden="true"> ↗</span>
      </a>
      <div>
        <span>{categoryName(entry.category)}</span>
        <time dateTime={entry.publishedAt}>{dateLabel(entry.publishedAt)}</time>
        {checked && <span>正文已核对</span>}
      </div>
    </li>
  );
}
export function RelatedArchiveGuides({ guideId }: { guideId: string }) {
  const related = library.collections.flatMap((collection) =>
    collection.entries
      .filter((entry) => entry.category === "routes" && entry.relatedGuideIds.includes(guideId))
      .map((entry) => ({ collection, entry })),
  );
  if (!related.length) return null;
  return (
    <details className="atlas-details">
      <summary>
        这张地图的旧版攻略 <span>{related.length} 篇 · 点位编号独立参考</span>
      </summary>
      <div>
        <p>同名地图的旧版文章，不与上方新版编号或路线合并。请先核对原帖地图变体。</p>
        <ul className="atlas-archive-list">
          {related.map(({ collection, entry }) => (
            <ArchiveEntry
              key={`${collection.id}/${entry.id}`}
              entry={entry}
              collection={collection}
            />
          ))}
        </ul>
        <p className="atlas-archive-note">
          目录已完整收录；“正文已核对”仅标记已读取的文章，其余请以原帖为准。
        </p>
      </div>
    </details>
  );
}
function ArchiveCollection({ collection }: { collection: Collection }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("routes");
  const normalized = query.normalize("NFKC").toLowerCase().trim();
  const entries = collection.entries.filter(
    (entry) =>
      (category === "all" || entry.category === category) &&
      entry.title.normalize("NFKC").toLowerCase().includes(normalized),
  );
  return (
    <details className="atlas-details atlas-archive-collection">
      <summary>
        {collection.title} <span>旧版合集 · {collection.count} 篇</span>
      </summary>
      <div>
        <div className="atlas-archive-intro">
          <p>{collection.description}</p>
          <a
            className="atlas-source-link"
            href={collection.source}
            target="_blank"
            rel="noreferrer"
          >
            打开合集 ↗
          </a>
        </div>
        <div className="atlas-archive-controls">
          <label>
            <span className="sr-only">搜索旧版合集</span>
            <input
              type="search"
              placeholder="搜索旧版地图或文章"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">旧版文章类型</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">全部文章</option>
              {Object.entries(library.categoryLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="atlas-archive-count">
          <output>{entries.length} 篇匹配</output>
          <span>目录核对 {dateLabel(collection.checkedAt)}</span>
        </div>
        <ul className="atlas-archive-list">
          {entries.map((entry) => (
            <ArchiveEntry key={entry.id} entry={entry} collection={collection} />
          ))}
        </ul>
        <p className="atlas-archive-note">
          目录已完整收录；“正文已核对”仅标记已读取的文章，其余请以原帖为准。
        </p>
        {!entries.length && (
          <div className="atlas-empty">
            <p>没有匹配的文章</p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              清除筛选
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
export function AtlasArchives() {
  return (
    <section className="atlas-archives" aria-label="更多攻略合集">
      <h2>更多攻略</h2>
      <p>旧版图解与经验文章，按原帖年份和版本分别查阅。</p>
      {library.collections.map((collection) => (
        <ArchiveCollection key={collection.id} collection={collection} />
      ))}
    </section>
  );
}
