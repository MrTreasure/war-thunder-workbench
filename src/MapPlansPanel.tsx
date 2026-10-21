import { useState } from "react";
import { GameSelect } from "./components/GameSelect";
import type { MapPlanLibrary } from "./map-editor-plans";
import { MAX_PLANS } from "./map-editor-plans";

export function MapPlansPanel({
  library,
  disabled,
  saving,
  error,
  choose,
  action,
  save,
  remove,
}: {
  library: MapPlanLibrary | null;
  disabled: boolean;
  saving: boolean;
  error: string;
  choose: (id: string) => Promise<void>;
  action: (kind: "new" | "copy" | "rename", name: string) => Promise<void>;
  save: () => Promise<void>;
  remove: () => void;
}) {
  const [mode, setMode] = useState<"new" | "copy" | "rename" | null>(null);
  const [name, setName] = useState("");
  const active = library?.plans.find((plan) => plan.id === library.activeId);
  function start(kind: "new" | "copy" | "rename") {
    setMode(kind);
    setName(
      kind === "rename"
        ? active?.name || ""
        : kind === "copy"
          ? `${active?.name || "方案"} 副本`
          : `方案 ${(library?.plans.length || 0) + 1}`,
    );
  }
  return (
    <div className="map-editor-fields map-editor-plans">
      <p>当前地图、任务布局和己方队伍可保存多套方案。修改自动保存在此浏览器。</p>
      {library && (
        <>
          <label>
            当前方案
            <GameSelect
              value={library.activeId}
              disabled={disabled}
              onValueChange={(id) => {
                setMode(null);
                void choose(id).catch(() => {});
              }}
            >
              {library.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </GameSelect>
          </label>
          <div className="map-editor-plan-meta">
            <span>
              {active?.project.items.length || 0} 个标注 · {library.plans.length} 个方案
            </span>
            <time dateTime={active?.project.updatedAt}>
              {active &&
                new Date(active.project.updatedAt).toLocaleString("zh-CN", { hour12: false })}
            </time>
          </div>
          <div className="map-editor-selection-actions">
            <button
              disabled={disabled || library.plans.length >= MAX_PLANS}
              onClick={() => start("new")}
            >
              新建空白方案
            </button>
            <button
              disabled={disabled || library.plans.length >= MAX_PLANS}
              onClick={() => start("copy")}
            >
              另存为新方案
            </button>
            <button disabled={disabled} onClick={() => start("rename")}>
              重命名
            </button>
            <button disabled={disabled || library.plans.length <= 1} onClick={remove}>
              删除当前方案
            </button>
          </div>
          {mode && (
            <form
              className="map-editor-plan-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!disabled && name.trim())
                  void action(mode, name)
                    .then(() => setMode(null))
                    .catch(() => {});
              }}
            >
              <label>
                方案名称
                <input
                  value={name}
                  maxLength={60}
                  disabled={disabled}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <div className="map-editor-selection-actions">
                <button type="button" disabled={disabled} onClick={() => setMode(null)}>
                  取消
                </button>
                <button disabled={disabled || !name.trim()}>
                  {mode === "rename" ? "保存名称" : "创建并打开"}
                </button>
              </div>
            </form>
          )}
          <button disabled={disabled} onClick={() => void save().catch(() => {})}>
            {saving ? "正在保存…" : "立即保存当前方案"}
          </button>
        </>
      )}
      {error && (
        <p className="map-editor-plan-error" role="alert">
          {error}
        </p>
      )}
      <p>方案仅保存在此浏览器。换设备或清理浏览数据前，请在“导出”中保存编辑文件。</p>
    </div>
  );
}
