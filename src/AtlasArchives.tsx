import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import { GameSelect } from "./components/GameSelect";
import { useState } from "react";
import library from "../data/map-collections.json";

type Collection = (typeof library.collections)[number];
type Entry = Collection["entries"][number];
const categoryName = (category: string) =>
  library.categoryLabels[category as keyof typeof library.categoryLabels] || "其他资料";
const dateLabel = (value: string) =>
  new Date(value)
    .toLocaleDateString(getLocale(), {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replaceAll("/", "-");
function ArchiveEntry({ entry, collection }: { entry: Entry; collection: Collection }) {
  useLocale();

  const check = collection.articleChecks[entry.id as keyof typeof collection.articleChecks];
  const checked = check?.updatedAt === entry.updatedAt;
  return (
    <li className="atlas-archive-entry">
      <a href={entry.source} target="_blank" rel="noopener noreferrer">
        {localize(entry.title)}
        <span aria-hidden="true"> ↗</span>
      </a>
      <div>
        <span>{localize(categoryName(entry.category))}</span>
        <time dateTime={entry.publishedAt}>{localize(dateLabel(entry.publishedAt))}</time>
        {localize(checked && <span>{t("正文已核对")}</span>)}
      </div>
    </li>
  );
}
export function RelatedArchiveGuides({ guideId }: { guideId: string }) {
  useLocale();

  const related = library.collections.flatMap((collection) =>
    collection.entries
      .filter((entry) => entry.category === "routes" && entry.relatedGuideIds.includes(guideId))
      .map((entry) => ({ collection, entry })),
  );
  if (!related.length) return null;
  return (
    <details className="atlas-details">
      <summary>
        {t("这张地图的旧版攻略")}
        <span>
          {localize(related.length)} {t("篇 · 点位编号独立参考")}
        </span>
      </summary>
      <div>
        <p>{t("同名地图的旧版文章，不与上方新版编号或路线合并。请先核对原帖地图变体。")}</p>
        <ul className="atlas-archive-list">
          {localize(
            related.map(({ collection, entry }) => (
              <ArchiveEntry
                key={`${collection.id}/${entry.id}`}
                entry={entry}
                collection={collection}
              />
            )),
          )}
        </ul>
        <p className="atlas-archive-note">
          {t("目录已完整收录；“正文已核对”仅标记已读取的文章，其余请以原帖为准。")}
        </p>
      </div>
    </details>
  );
}
function ArchiveCollection({ collection }: { collection: Collection }) {
  useLocale();

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
        {localize(collection.title)}{" "}
        <span>
          {t("旧版合集 ·")}
          {localize(collection.count)} {t("篇")}
        </span>
      </summary>
      <div>
        <div className="atlas-archive-intro">
          <p>{localize(collection.description)}</p>
          <a
            className="atlas-source-link"
            href={collection.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("打开合集 ↗")}
          </a>
        </div>
        <div className="atlas-archive-controls">
          <label>
            <span className="sr-only">{t("搜索旧版合集")}</span>
            <input
              type="search"
              placeholder={t("搜索旧版地图或文章")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">{t("旧版文章类型")}</span>
            <GameSelect value={category} onValueChange={(value) => setCategory(value)}>
              <option value="all">{t("全部文章")}</option>
              {localize(
                Object.entries(library.categoryLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {localize(label)}
                  </option>
                )),
              )}
            </GameSelect>
          </label>
        </div>
        <div className="atlas-archive-count">
          <output>
            {localize(entries.length)} {t("篇匹配")}
          </output>
          <span>
            {t("目录核对")}
            {localize(dateLabel(collection.checkedAt))}
          </span>
        </div>
        <ul className="atlas-archive-list">
          {localize(
            entries.map((entry) => (
              <ArchiveEntry key={entry.id} entry={entry} collection={collection} />
            )),
          )}
        </ul>
        <p className="atlas-archive-note">
          {t("目录已完整收录；“正文已核对”仅标记已读取的文章，其余请以原帖为准。")}
        </p>
        {localize(
          !entries.length && (
            <div className="atlas-empty">
              <p>{t("没有匹配的文章")}</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                {t("清除筛选")}
              </button>
            </div>
          ),
        )}
      </div>
    </details>
  );
}
export function AtlasArchives() {
  useLocale();

  return (
    <section className="atlas-archives" aria-label={t("更多攻略合集")}>
      <h2>{t("更多攻略")}</h2>
      <p>{t("旧版图解与经验文章，按原帖年份和版本分别查阅。")}</p>
      {localize(
        library.collections.map((collection) => (
          <ArchiveCollection key={collection.id} collection={collection} />
        )),
      )}
    </section>
  );
}
