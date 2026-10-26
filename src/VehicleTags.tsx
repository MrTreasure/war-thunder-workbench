/* oxlint-disable react/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { communityRequest } from "./lineup-community-api";
import { GameTag, type GameTagTone } from "./components/GameTag";
import { GameSelect } from "./components/GameSelect";
import { TagSelector, type TagChoice } from "./components/TagSelector";
import { useTagCatalog, tagLabel } from "./game-tag-catalog";
import { useGameTagAccess } from "./game-tag-access";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { Modal } from "./Modal";
import "./vehicle-tags.css";
export type VehicleTagPage = {
  vehicleId: string;
  version: string;
  currentVersion: string;
  versions: { id: string; label: string; sourceUrl: string }[];
  tags: { id: string; tone: GameTagTone; count: number }[];
  quota: {
    canTag: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    pointCost: number;
    preview?: boolean;
    credits?: { enabled: boolean; remaining: number | null };
  };
};
function VehicleTagDialog({
  page,
  vehicleId,
  close,
  applied,
}: {
  page: VehicleTagPage;
  vehicleId: string;
  close: () => void;
  applied: (page: VehicleTagPage) => void;
}) {
  const access = useGameTagAccess();
  const tagCatalog = useTagCatalog("vehicle");
  const [value, setValue] = useState<TagChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const { quota } = page;
  const credits = quota.credits;
  const hasPoints = credits?.enabled && (credits.remaining === null || credits.remaining > 0);
  const canUsePoints =
    credits?.enabled && (credits.remaining === null || credits.remaining >= quota.pointCost);
  const exhausted = quota.remaining !== null && quota.remaining <= 0 && !canUsePoints;
  async function submit() {
    if (value.length !== 1 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await communityRequest<VehicleTagPage>(
        `vehicles/${encodeURIComponent(vehicleId)}/tags`,
        { tag: value[0], version: page.currentVersion, requestId: requestId.current },
      );
      applied(result);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "打标未完成，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="为载具打标"
      subtitle={page.versions.find((version) => version.id === page.currentVersion)?.label}
      className="wt-vehicle-tag-dialog"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="wt-vehicle-tag-dialog-body">
        <p className="calc-note">选择一个文案和样式。同一载具可重复打标，每次消耗 1 次打标额度。</p>
        <p>
          今日免费剩余 {quota.remaining === null ? "不限" : quota.remaining} 次
          {hasPoints
            ? ` · 额外点数 ${credits.remaining === null ? "不限" : credits.remaining}`
            : ""}
        </p>
        <details className="calc-note">
          <summary>额度与展示规则</summary>
          <p>
            当前身份每日免费 {quota.limit === null ? "不限" : quota.limit}{" "}
            次，按北京时间自然日恢复。免费次数优先使用
            {hasPoints ? `，用完后每次消耗 ${quota.pointCost} 点额外查询点` : ""}
            。同文案累计次数；普通样式采用最后一次，材质样式采用最高档。标签按游戏大版本分别统计。
          </p>
        </details>
        {quota.preview && <p className="calc-note">预览额度独立记录，不扣正式账号点数。</p>}
        {access.error && (
          <p role="alert">
            {access.error}
            <button type="button" onClick={access.refresh}>
              重试
            </button>
          </p>
        )}
        <TagSelector
          options={tagCatalog.options}
          loading={tagCatalog.loading}
          error={tagCatalog.error}
          onRetry={tagCatalog.refresh}
          value={value}
          allowedTones={access.allowedTones}
          max={1}
          disabled={busy}
          onChange={(next) => {
            setValue(next);
            requestId.current = crypto.randomUUID();
          }}
        />
        {error && (
          <p role="alert" className="lineup-feedback">
            {error}
          </p>
        )}
        {exhausted && <p role="alert">今日打标额度已达上限</p>}
        <div className="wt-vehicle-tag-dialog-actions">
          <button type="button" className="quiet-button" disabled={busy} onClick={close}>
            取消
          </button>
          <button
            type="button"
            className="quiet-button calc-open"
            disabled={busy || value.length !== 1 || exhausted}
            onClick={() => void submit()}
          >
            {busy ? "正在提交…" : "确认打标"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
export function VehicleTags({ vehicleId }: { vehicleId: string }) {
  const account = useWorkbenchAccount();
  const tagCatalog = useTagCatalog("vehicle");
  const [page, setPage] = useState<VehicleTagPage | null>(null);
  const [version, setVersion] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setVersion("");
    setPage(null);
    setOpen(false);
  }, [vehicleId]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setOpen(false);
    void communityRequest<VehicleTagPage>(
      `vehicles/${encodeURIComponent(vehicleId)}/tags${version ? `?version=${encodeURIComponent(version)}` : ""}`,
      undefined,
      abort.signal,
    )
      .then((value) => {
        if (!abort.signal.aborted) setPage(value);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) {
          setPage(null);
          setError(cause instanceof Error ? cause.message : "标签读取失败");
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [vehicleId, version, revision, account.session?.user?.id, account.identityVersion]);
  const current = page?.vehicleId === vehicleId ? page : null;
  return (
    <section className="wt-vehicle-tags" aria-label="载具标签">
      <div className="wt-detail-section-heading">
        <h3>载具标签</h3>
        {current && (
          <GameSelect
            value={current.version}
            aria-label="标签游戏版本"
            onValueChange={(value) => setVersion(String(value))}
          >
            {current.versions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.id === current.currentVersion ? " · 当前版本" : ""}
              </option>
            ))}
          </GameSelect>
        )}
      </div>
      {loading ? (
        <output className="calc-note">正在读取标签…</output>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            className="wt-vehicle-text-action"
            onClick={() => setRevision((value) => value + 1)}
          >
            重试
          </button>
        </p>
      ) : (
        <div className="wt-vehicle-tag-counts">
          {current?.tags.length ? (
            current.tags.map((tag) => (
              <span key={tag.id}>
                <GameTag tagId={tag.id} tone={tag.tone}>
                  {tagLabel(tag.id, tagCatalog.items) || "标签加载中"}
                </GameTag>
                <b aria-label={`累计 ${tag.count} 次`}>×{tag.count}</b>
              </span>
            ))
          ) : (
            <p className="calc-note">这个版本还没有标签，来分享你的体验。</p>
          )}
        </div>
      )}
      <div className="wt-vehicle-tag-footer">
        <small>
          {current?.version !== current?.currentVersion
            ? "历史版本标签仅供查看"
            : "同文案累计次数 · 材质取最高档"}
        </small>
        <button
          type="button"
          className="quiet-button"
          disabled={loading || !current || current.version !== current.currentVersion}
          onClick={() => {
            if (!account.session?.user) {
              void account.login();
              return;
            }
            setOpen(true);
          }}
        >
          {account.session?.user ? "为载具打标" : "登录后为载具打标"}
        </button>
      </div>
      {open && current && (
        <VehicleTagDialog
          page={current}
          vehicleId={vehicleId}
          close={() => setOpen(false)}
          applied={setPage}
        />
      )}
    </section>
  );
}
