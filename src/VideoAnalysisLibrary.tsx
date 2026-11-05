import { t, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Scroll regions need keyboard focus for horizontal scrolling. */
import { useEffect, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { statsRequest } from "./player-stats-api";
import {
  imageStatuses,
  parseVideoId,
  textStatuses,
  validateVideoLibrary,
  videoLibraryCsv,
} from "./video-analysis-library";
import type { VideoLibrary } from "./video-analysis-library";
import "./video-analysis-library.css";
const stamp = (v: string | null) =>
  v
    ? Number.isFinite(Date.parse(v))
      ? new Date(v).toLocaleString(getLocale())
      : t("未知")
    : t("未知");
const seconds = (v: number) =>
  `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
export function VideoAnalysisLibrary({ video }: { video?: string }) {
  useLocale();
  const [open, setOpen] = useState(!!video);
  const [query, setQuery] = useState(video ?? "");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [payload, setPayload] = useState<VideoLibrary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || payload) return;
    const controller = new AbortController();
    void statsRequest<unknown>("map-data-preview/video-analysis", undefined, controller.signal)
      .then(validateVideoLibrary)
      .then((v) => {
        if (!controller.signal.aborted) setPayload(v);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : t("视频清单加载失败"));
      });
    return () => controller.abort();
  }, [open, payload, attempt]);
  const bvid = parseVideoId(query);
  const trimmed = query.trim();
  const invalidLink = !bvid && (/^https?:\/\//i.test(trimmed) || /^BV/.test(trimmed));
  const duplicate = bvid && payload?.items.find((v) => v.bvid === bvid);
  const items =
    payload?.items.filter(
      (v) =>
        (!topic || v.topics.includes(topic as "weakpoints" | "maps")) &&
        (!status || v.textStatus === status) &&
        (bvid
          ? v.bvid === bvid
          : !invalidLink &&
            `${v.title} ${v.author ?? ""} ${v.adoptedVehicles.map((a) => a.name).join(" ")}`
              .toLocaleLowerCase()
              .includes(trimmed.toLocaleLowerCase())),
    ) ?? [];
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([videoLibraryCsv(items)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-analysis-library.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details
      className="wt-video-library"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{t("视频分析记录与查重")}</summary>
      {open && (
        <div className="wt-video-library-body">
          <p>
            {t(
              "查看已登记视频、文字与图片处理进度；未登记不代表视频没有相关内容。记录包含草稿；来源关联不代表完整图解或正式发布。",
            )}
          </p>
          <div className="wt-video-library-controls">
            <label>
              {t("视频查重 / 搜索")}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("粘贴 BV 或 B站视频链接，或搜索标题、作者、车型")}
              />
            </label>
            <GameSelect aria-label={t("视频主题")} value={topic} onValueChange={setTopic}>
              <option value="">{t("全部主题")}</option>
              <option value="weakpoints">{t("坦克弱点")}</option>
              <option value="maps">{t("地图走线")}</option>
            </GameSelect>
            <GameSelect aria-label={t("文字分析状态")} value={status} onValueChange={setStatus}>
              <option value="">{t("全部文字状态")}</option>
              {Object.entries(textStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </GameSelect>
            <button type="button" disabled={!payload} onClick={download}>
              {t("下载当前清单 CSV")}
            </button>
          </div>
          <output className="wt-video-library-status">
            {invalidLink
              ? t("请输入完整 BV（大小写敏感）或标准 HTTPS B站视频链接。")
              : payload && bvid
                ? duplicate
                  ? t("已登记：{0}；{1}。", [
                      t(textStatuses[duplicate.textStatus]),
                      t(imageStatuses[duplicate.imageStatus]),
                    ])
                  : t("未登记：当前清单没有此 BV。")
                : t("BV 查重区分大小写；链接追踪参数会忽略。")}
          </output>
          {!payload && !error && <output>{t("正在加载视频清单…")}</output>}
          {error && (
            <div role="alert">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setAttempt((v) => v + 1);
                }}
              >
                {t("重试加载")}
              </button>
            </div>
          )}
          {payload && (
            <>
              <p>
                {t("当前显示 {0} / {1} 条 · 清单更新：{2}", [
                  items.length,
                  payload.items.length,
                  stamp(payload.updatedAt),
                ])}
              </p>
              {/* Keyboard focus enables horizontal scrolling on narrow screens. */}
              <section
                className="wt-video-library-scroll"
                tabIndex={0}
                aria-label={t("视频分析清单，可横向滚动")}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{t("原视频")}</th>
                      <th>{t("分析进度")}</th>
                      <th>{t("已关联")}</th>
                      <th>{t("待补事项")}</th>
                      <th>{t("核对时间")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => (
                      <tr key={v.bvid}>
                        <td>
                          <a href={v.url} target="_blank" rel="noreferrer">
                            {v.title}
                            <br />
                            {v.bvid}
                          </a>
                          <p>{v.author ?? t("作者未知")}</p>
                          <details open={bvid === v.bvid ? true : undefined}>
                            <summary>{t("章节与分析摘要")}</summary>
                            <p>{v.summary || t("暂无摘要")}</p>
                            <p>
                              {t("时长：")}
                              {v.durationSeconds === null
                                ? t("未知")
                                : seconds(v.durationSeconds)}{" "}
                              ·{t("片段数：")}
                              {v.segmentCount ?? t("未知")}
                            </p>
                            <p>
                              {t("文字分析范围：")}
                              {v.analyzedRanges.length
                                ? v.analyzedRanges
                                    .map((r) => `${seconds(r.from)}–${seconds(r.to)}`)
                                    .join("、")
                                : t("未登记")}
                            </p>
                            {v.chapters.length ? (
                              <ul>
                                {v.chapters.map((c, i) => (
                                  <li key={i}>
                                    <a
                                      href={`${v.url}?t=${Math.floor(c.from)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {seconds(c.from)}–{seconds(c.to)} {c.title}
                                    </a>
                                    <p>{c.summary}</p>
                                    {c.vehicleId && (
                                      <a href={`#/weakpoints?vehicle=${c.vehicleId}`}>
                                        {t("查看车型弱点")}
                                      </a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>{t("暂无章节记录")}</p>
                            )}
                          </details>
                        </td>
                        <td>
                          {t(textStatuses[v.textStatus])}
                          <br />
                          {t(imageStatuses[v.imageStatus])}
                          <p>{t("证据 {0} 条", [v.evidenceCount])}</p>
                        </td>
                        <td>
                          {t("{0} 个车型 / {1} 条走线", [
                            v.adoptedVehicles.length,
                            v.usedGuideCount,
                          ])}
                          <ul>
                            {v.adoptedVehicles.map((a) => (
                              <li key={a.id}>
                                <a href={`#/weakpoints?vehicle=${a.id}`}>{a.name}</a>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          {v.gaps.length ? (
                            <ul>
                              {v.gaps.map((g, i) => (
                                <li key={i}>{g}</li>
                              ))}
                            </ul>
                          ) : (
                            t("未登记待补事项")
                          )}
                        </td>
                        <td>{stamp(v.lastAnalyzedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {!items.length && <p>{t("没有符合条件的视频。可清空搜索或调整筛选。")}</p>}
            </>
          )}
        </div>
      )}
    </details>
  );
}
