import { useId, useState } from "react";
import type { Vehicle } from "./models";
import { GameButton } from "./components/GameButton";
import {
  armorEstimationModel as model,
  estimateArmor,
  referenceArmorLayer,
} from "./armor-estimation";
import type { ArmorLayer, ArmorPart } from "./armor-estimation";

const number = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
function PartEstimate({ unit, part }: { unit: Vehicle; part: ArmorPart }) {
  const id = useId();
  const [layers, setLayers] = useState<ArmorLayer[]>(() => [referenceArmorLayer(unit, part)]);
  const [edited, setEdited] = useState(false);
  const kinetic = estimateArmor(layers, "kinetic");
  const chemical = estimateArmor(layers, "chemical");
  const label = part === "hull" ? "车体正面" : "炮塔正面";
  const source = referenceArmorLayer(unit, part);
  const input = (
    layer: ArmorLayer,
    field: "thicknessMm" | "angleDeg" | "kineticFactor" | "chemicalFactor",
    title: string,
    maximum: number,
  ) => (
    <label htmlFor={`${id}-${layer.id}-${field}`}>
      <span>{title}</span>
      <input
        id={`${id}-${layer.id}-${field}`}
        type="number"
        inputMode="decimal"
        min={0}
        max={maximum}
        step="any"
        value={layer[field] ?? ""}
        onChange={(event) => {
          const value = event.target.value === "" ? null : Number(event.target.value);
          setLayers((old) =>
            old.map((item) =>
              item.id === layer.id
                ? { ...item, [field]: value !== null && !Number.isFinite(value) ? null : value }
                : item,
            ),
          );
          setEdited(true);
        }}
      />
    </label>
  );
  return (
    <article className="wt-armor-part-estimate">
      <header>
        <h4>{label}</h4>
        <span>{edited ? "自定义参数" : "单层 RHA 假设"}</span>
      </header>
      <dl className="wt-armor-estimate-values" aria-live="polite" aria-atomic="true">
        <div>
          <dt>动能参考</dt>
          <dd>
            {kinetic === null ? "—" : `≈ ${number(kinetic)}`}
            <small>mm RHA</small>
          </dd>
        </div>
        <div>
          <dt>破甲参考</dt>
          <dd>
            {chemical === null ? "—" : `≈ ${number(chemical)}`}
            <small>mm RHA</small>
          </dd>
        </div>
      </dl>
      <p className="wt-armor-estimate-inputs">
        {layers.map((layer, index) => (
          <span key={layer.id}>
            {index ? " + " : ""}
            {number(layer.thicknessMm)} mm / {number(layer.angleDeg)}° · k{" "}
            {number(layer.kineticFactor)} / {number(layer.chemicalFactor)}
          </span>
        ))}
      </p>
      {(kinetic === null || chemical === null) && (
        <output className="wt-armor-estimate-error">
          请补齐本部位各层厚度、角度和系数。角度限 0～{model.limits.angleDeg}°，系数限 0～
          {model.limits.factor}。
        </output>
      )}
      <details className="wt-armor-layer-editor">
        <summary>调整角度与分层参数</summary>
        <p className="calc-note">
          Wiki 正面标称厚度 {number(source.thicknessMm)} mm。默认按一层均质钢、法线入射 0°、系数 1
          建立参考，不代表已验证的实际结构。动能／破甲系数需分别匹配目标材料和所选弹种。
        </p>
        {layers.map((layer, index) => (
          <fieldset key={layer.id}>
            <legend>
              第 {index + 1} 层{layer.id === "wiki-reference" ? " · Wiki 标称参考" : " · 自定义"}
            </legend>
            <div className="wt-armor-layer-fields">
              {input(layer, "thicknessMm", "厚度（mm）", model.limits.thicknessMm)}
              {input(layer, "angleDeg", "相对法线角度（°）", model.limits.angleDeg)}
              {input(layer, "kineticFactor", "动能材料系数", model.limits.factor)}
              {input(layer, "chemicalFactor", "破甲材料系数", model.limits.factor)}
            </div>
            {layers.length > 1 && (
              <GameButton
                tone="ghost"
                onClick={() => {
                  setLayers((old) => old.filter((item) => item.id !== layer.id));
                  setEdited(true);
                }}
                aria-label={`删除${label}第 ${index + 1} 层`}
              >
                删除此层
              </GameButton>
            )}
          </fieldset>
        ))}
        <div className="wt-armor-layer-actions">
          <GameButton
            tone="ghost"
            disabled={layers.length >= model.limits.layers}
            onClick={() => {
              setLayers((old) => [
                ...old,
                { id: crypto.randomUUID(), thicknessMm: null, ...model.reference },
              ]);
              setEdited(true);
            }}
          >
            追加一层
          </GameButton>
          <GameButton
            tone="ghost"
            onClick={() => {
              setLayers([referenceArmorLayer(unit, part)]);
              setEdited(false);
            }}
          >
            恢复参考
          </GameButton>
        </div>
      </details>
    </article>
  );
}
export function VehicleArmorEstimate({
  unit,
  compact = false,
}: {
  unit: Vehicle;
  compact?: boolean;
}) {
  const combat = unit.wikiDetails?.performance?.groundCombat;
  return (
    <section
      className={`wt-armor-estimate ${compact ? "is-compact" : ""}`}
      aria-label={`${unit.name} 正面等效装甲估算`}
    >
      {!compact && (
        <div className="wt-ground-section-heading">
          <h3>正面等效装甲估算</h3>
          <span>分层线性模型 · 非游戏防护解算</span>
        </div>
      )}
      <div className="wt-armor-estimate-parts">
        {(["hull", "turret"] as const).map((part) => (
          <PartEstimate key={`${unit.id}:${combat?.htmlSha256}:${part}`} unit={unit} part={part} />
        ))}
      </div>
      <p className="calc-note">
        E = Σ（厚度 × 弹种对应材料系数 ÷ cos 相对法线角度）。
        {combat?.armorTypes?.length
          ? "该载具的附加防护不能从标称厚度还原。"
          : "未标明材质时不推定实际材料。"}
        数值仅为当前输入下的被动层参考，未计 ERA、跳弹、弹体归正、复合层相互作用或命中位置差异。
      </p>
      {!compact && (
        <details className="wt-armor-model-notes">
          <summary>计算口径与来源</summary>
          <p>
            车体使用车体正面参考层；炮塔使用炮塔正面参考层，不把侧面、后部或炮盾叠加。添加分层时，仅输入同一条命中路径确实经过的层。缺少任一层参数时显示“—”，不将缺失层当作零。输入参数只在当前组件内保留。
          </p>
          <p>
            动能参考不等于所有穿甲弹通用的防护值；长杆弹应使用对应系数。破甲参考不含串联战斗部和 ERA
            的非线性作用。系数 1 是均质钢参考假设，非从当前车型推导出的材料结论。
          </p>
          {model.sources.map((item) => (
            <a href={item.url} target="_blank" rel="noreferrer" key={item.url}>
              {item.label} ↗
            </a>
          ))}
        </details>
      )}
    </section>
  );
}
