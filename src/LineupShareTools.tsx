// Fetch status and identity reset synchronize the current request/account with the UI.
/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import bootstrap from "./generated/bootstrap.json";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import { VehicleTile } from "./VehicleTile";
import { LineupTag } from "./LineupTag";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import {
  communityRequest,
  communityTags,
  communityMode,
  communityLink,
  approveLineupCaption,
} from "./lineup-community-api";
import type { CommunityPost } from "./lineup-community-api";
import { lineupCardRating, lineupRatings, lineupMatchmakingWindow } from "./lineups";
import type { Lineup, LineupVehicle } from "./lineups";
import type { Mode } from "./models";

export function LineupShareImage({
  post,
  units,
  text = "",
}: {
  post: CommunityPost;
  units: Map<string, LineupVehicle>;
  text?: string;
}) {
  const lineup: Lineup = {
    id: post.id,
    name: "",
    slots: post.slots,
    battleType: post.battle,
    activeAircraft: post.activeAircraft || null,
  };
  const country = bootstrap.countries[post.country as keyof typeof bootstrap.countries];
  const window = lineupMatchmakingWindow(post.step, post.mode, bootstrap.lineup);
  const gameMode = communityMode(post.battle, post.mode)
    .replace(/街机$/, " · 街机娱乐")
    .replace(/历史$/, " · 历史性能")
    .replace(/全真$/, " · 全真模拟");
  return (
    <article className="wt-share-image" aria-label="队列分享图片">
      <header className="wt-share-heading">
        <p>
          <span className="wt-share-heading-label">分房范围</span>
          <strong>{window ? `${window.minimum} – ${window.maximum}` : post.rating}</strong>
          {window && <small>队列 {post.rating}</small>}
        </p>
        <p>
          <span className="wt-share-heading-label">游戏模式</span>
          <strong>{gameMode}</strong>
        </p>
        <p>
          <span className="wt-share-heading-label">出击队列</span>
          <strong className="wt-share-nation">
            <img src={bootstrap.flags[post.country as keyof typeof bootstrap.flags]} alt="" />
            {country}
          </strong>
        </p>
      </header>
      <div className="wt-share-crew">
        {lineup.slots.flatMap((id) => {
          const unit = id ? units.get(id) : null;
          return unit
            ? [
                <VehicleTile
                  key={unit.id}
                  unit={unit}
                  mode={post.mode}
                  owned={true}
                  showRank={false}
                  showAcquisition={true}
                  showPackPrice={false}
                  modeRating={lineupCardRating(unit, post.battle, post.mode)}
                />,
              ]
            : [];
        })}
      </div>
      <div className="wt-share-labels">
        {post.tags.map((id) => (
          <LineupTag key={id} id={id} />
        ))}
      </div>
      {text.trim() && (
        <section className="wt-share-note">
          <p>{text}</p>
        </section>
      )}
      <footer className="wt-share-footer">
        <span className="wt-share-id">
          队列 ID <b>{post.id}</b>
        </span>
        <div className="wt-share-attribution">
          <span className="wt-share-code">
            分享码 <code>{post.code}</code>
          </span>
          <span className="wt-share-owner">
            分享者 <strong>{post.author}</strong>
          </span>
        </div>
      </footer>
    </article>
  );
}
export function LineupImageDialog({
  post,
  units,
  close,
}: {
  post: CommunityPost;
  units: Map<string, LineupVehicle>;
  close: () => void;
}) {
  const [text, setText] = useState("");
  const [approvedText, setApprovedText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function applyCaption() {
    const value = text.trim();
    if (!value) {
      setApprovedText("");
      return;
    }
    const signal = new AbortController();
    controller.current = signal;
    setReviewing(true);
    setError("");
    try {
      await approveLineupCaption(value, signal.signal);
      if (!signal.signal.aborted) setApprovedText(value);
    } catch (cause) {
      if (!signal.signal.aborted) {
        setApprovedText("");
        setError(cause instanceof Error ? cause.message : "文字说明检查失败，请重试。");
      }
    } finally {
      if (!signal.signal.aborted) setReviewing(false);
    }
  }
  const captionPending = !!text.trim() && text.trim() !== approvedText;
  const locked = busy || reviewing;
  async function exportImage(copy: boolean) {
    if (!preview.current?.firstElementChild) return;
    setBusy(true);
    setError("");
    const signal = new AbortController();
    controller.current = signal;
    try {
      const { exportLineupImage } = await import("./lineup-share-export");
      const blob = await exportLineupImage(
        preview.current.firstElementChild as HTMLElement,
        signal.signal,
      );
      if (signal.signal.aborted) return;
      if (copy) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setError("图片已复制。");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${post.id}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (cause) {
      if (!signal.signal.aborted)
        setError(cause instanceof Error ? cause.message : "图片导出失败，请重试。");
    } finally {
      if (!signal.signal.aborted) setBusy(false);
    }
  }
  return (
    <Modal
      title="生成队列分享图"
      subtitle="最多 8 辆，按游戏队列排列。文字说明通过安全检查后应用，不保存到大厅。"
      close={close}
      className="wt-community-dialog wt-image-dialog"
    >
      <div className="wt-share-preview-scroll">
        <div ref={preview}>
          <LineupShareImage post={post} units={units} text={approvedText} />
        </div>
      </div>
      <label className="calc-field">
        分享文字（可留空）
        <textarea
          rows={3}
          maxLength={160}
          value={text}
          disabled={locked}
          onChange={(e) => {
            setText(e.target.value);
            setApprovedText("");
            setError("");
          }}
          placeholder="补充你的打法或使用体验…"
        />
      </label>
      <p className="calc-note">
        提交原文和账号／设备标识会记录供管理员审查；图片在本机合成，不上传成品。
      </p>
      <div className="wt-community-actions">
        <small>{text.length}/160</small>
        <button
          className="quiet-button"
          disabled={locked || !text.trim()}
          onClick={() => void applyCaption()}
        >
          {reviewing ? "正在安全检查…" : "检查并应用说明"}
        </button>
        <button
          className="quiet-button"
          disabled={locked || captionPending}
          onClick={() => void exportImage(false)}
        >
          {busy ? "正在合成…" : "下载图片"}
        </button>
        {typeof ClipboardItem !== "undefined" && (
          <button
            className="quiet-button"
            disabled={locked || captionPending}
            onClick={() => void exportImage(true)}
          >
            复制图片
          </button>
        )}
      </div>
      {captionPending && <p className="calc-note">请先检查并应用文字说明，再导出图片。</p>}
      {error && <output className="lineup-feedback">{error}</output>}
    </Modal>
  );
}
export function LineupShareTools({
  lineup,
  code,
  country,
  units,
  defaultMode,
}: {
  lineup: Lineup;
  code: string;
  country: string;
  units: Map<string, LineupVehicle>;
  defaultMode: Mode;
}) {
  const account = useWorkbenchAccount();
  const userId = account.session?.user?.id;
  const [mode, setMode] = useState<Mode>(defaultMode === "ab" ? "ab" : "rb");
  const [tags, setTags] = useState<string[]>([]);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [identity, setIdentity] = useState({ author: "游客", authorId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState(false);
  useEffect(() => {
    setIdentity({ author: "游客", authorId: "" });
    if (!userId) return;
    const abort = new AbortController();
    void communityRequest<{ author: string; authorId: string }>("identity", undefined, abort.signal)
      .then(setIdentity)
      .catch(() => {
        if (!abort.signal.aborted) setIdentity({ author: "玩家", authorId: "" });
      });
    return () => abort.abort();
  }, [userId]);
  const rating = lineupRatings(lineup, units, bootstrap.lineup).find((r) => r.mode === mode)!;
  const selected = lineup.slots.flatMap((id) => (id && units.has(id) ? [units.get(id)!] : []));
  const composition = selected.every((u) => u.side === "research")
    ? "tech"
    : selected.every((u) => u.kind === "gold")
      ? "all-ge"
      : selected.some((u) => u.kind === "pack")
        ? "mixed-pack"
        : selected.some((u) => u.kind === "gold")
          ? "mixed-ge"
          : "mixed-event";
  const preview = useMemo<CommunityPost>(
    () =>
      post || {
        id: `本地-${lineup.id.slice(0, 8)}`,
        country,
        code,
        battle: lineup.battleType,
        mode,
        activeAircraft: lineup.activeAircraft || "",
        slots: lineup.slots,
        tags: [composition, ...tags],
        step: rating.step,
        rating: rating.label,
        ...identity,
        createdAt: "",
        up: 0,
        down: 0,
        vote: 0,
        mine: true,
      },
    [post, lineup, country, code, mode, composition, tags, rating.step, rating.label, identity],
  );
  const count = lineup.slots.filter(Boolean).length;
  const invalid =
    count < 1 ||
    count > 8 ||
    !code ||
    (mode !== "sb" && rating.step === null) ||
    (mode === "sb" && lineup.battleType === "naval");
  async function publish() {
    if (!account.session?.user) {
      await account.login();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const value = await communityRequest<CommunityPost>("posts", {
        code,
        battle: lineup.battleType,
        mode,
        activeAircraft: lineup.activeAircraft || "",
        tags,
      });
      setPost(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wt-share-settings">
      <div className="wt-community-section-title">
        <h3>分享你的队列方案</h3>
        <Link to="/lineups/lobby">浏览队列大厅 ↗</Link>
      </div>
      <p className="calc-note">
        大厅自动展示国家、模式和权重，不公开你的私人队列名称。每次发布保留当时的配置。
      </p>
      <label className="calc-field">
        分享模式
        <GameSelect
          value={mode}
          onValueChange={(value) => {
            setMode(value as Mode);
            setPost(null);
          }}
        >
          {(["ab", "rb"] as Mode[]).map((id) => (
            <option key={id} value={id} disabled={id === "sb" && lineup.battleType === "naval"}>
              {communityMode(lineup.battleType, id)}
            </option>
          ))}
        </GameSelect>
      </label>
      <div className="wt-community-section-title">
        <span>队列标签 · 最多选择 3 个</span>
        <small>{tags.length}/3</small>
      </div>
      <div className="wt-tag-picker">
        {[...new Set(communityTags.filter((t) => !t.system).map((t) => t.group))].map((group) => (
          <fieldset key={group}>
            <legend>{group}</legend>
            {communityTags
              .filter((t) => !t.system && t.group === group)
              .map((tag) => (
                <LineupTag
                  key={tag.id}
                  id={tag.id}
                  selected={tags.includes(tag.id)}
                  disabled={!tags.includes(tag.id) && tags.length >= 3}
                  onClick={() => {
                    setTags(
                      tags.includes(tag.id) ? tags.filter((t) => t !== tag.id) : [...tags, tag.id],
                    );
                    setPost(null);
                  }}
                />
              ))}
          </fieldset>
        ))}
      </div>
      <div className="wt-community-actions">
        <LineupTag id={composition} />
        <strong>
          {communityMode(lineup.battleType, mode)} · {rating.label}
        </strong>
        <span>{count}/8 辆</span>
      </div>
      {invalid && count <= 8 && (
        <p className="calc-note" role="alert">
          {count === 0
            ? "请先保存至少一辆载具。"
            : mode === "sb" && lineup.battleType === "naval"
              ? "海战无普通全真匹配，请改用街机或历史模式。"
              : rating.note}
        </p>
      )}
      {count > 8 && (
        <p role="alert" className="lineup-feedback is-error">
          分享最多 8 辆，请另存一个精简方案。个人队列与原分享码保持完整。
        </p>
      )}
      <div className="wt-community-actions">
        <button
          className="quiet-button calc-open"
          disabled={busy || invalid}
          onClick={() => void publish()}
        >
          {busy
            ? "正在发布…"
            : post
              ? "已发布 · 再次核对"
              : account.session?.user
                ? "发布到队列大厅"
                : "登录并发布"}
        </button>
        <button className="quiet-button" disabled={invalid} onClick={() => setImage(true)}>
          生成分享图片
        </button>
        {post && (
          <Link to="/lineups/lobby" search={{ post: post.id }}>
            查看已发布方案 ↗
          </Link>
        )}
      </div>
      {post && (
        <output className="lineup-feedback">
          已发布 {post.id} ·{" "}
          <button
            className="wt-vehicle-text-action"
            onClick={() =>
              void navigator.clipboard
                .writeText(communityLink(post.id))
                .then(() => setError("队列链接已复制。"))
                .catch(() => setError(communityLink(post.id)))
            }
          >
            复制队列链接
          </button>
        </output>
      )}
      {error && <output className="lineup-feedback">{error}</output>}
      {image && <LineupImageDialog post={preview} units={units} close={() => setImage(false)} />}
    </section>
  );
}
