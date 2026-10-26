import { useState } from "react";
import { GameTag, gameTagBasicColors, gameTagTiers, gameTagTones } from "./components/GameTag";
import { TagSelector, type TagChoice } from "./components/TagSelector";
import { useTagCatalog, tagLabel } from "./game-tag-catalog";
import { useGameTagAccess } from "./game-tag-access";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import registry from "../data/lineup-sharing-tags.json";
import "./tag-preview.css";

export function TagPreview() {
  const [choices, setChoices] = useState<TagChoice[]>([]);
  const access = useGameTagAccess();
  const tagCatalog = useTagCatalog();
  const account = useWorkbenchAccount();
  const word = choices.length
    ? tagLabel(choices[choices.length - 1].id, tagCatalog.items) || "经典标配"
    : "经典标配";
  return (
    <main className="wt-tag-lab">
      <header>
        <div>
          <p className="wt-tag-lab-eyebrow">游戏标签 · 独立样式验收</p>
          <h1>文案、颜色与材质，自由组合</h1>
          <p>先对照游戏原版，再选择文案与底色。文案与外观独立选择，材质由绑定游戏账号等级解锁。</p>
        </div>
        <a href="#/lineups">返回出击队列 ↗</a>
      </header>
      <section>
        <h2>01 / 游戏原版对照</h2>
        <div className="wt-tag-reference">
          <div>
            <small>官方原始文件 · 等比显示</small>
            <img
              src={registry.officialTag.url}
              width={67.5}
              height={28.5}
              alt="官方未染色的 45×19 标签底纹"
            />
          </div>
          <div>
            <small>保留底纹 · 仅扩展中段</small>
            <GameTag tone="original">−50%</GameTag>
          </div>
          <div>
            <small>游戏红色 · #ff313b 乘色</small>
            <GameTag tone="red">−50%</GameTag>
          </div>
        </div>
        <p className="wt-tag-lab-source">
          底纹直接读取
          <a href={registry.officialTag.url} target="_blank" rel="noreferrer">
            官方原图 ↗
          </a>
          ，不重绘形状。七档配色是工作台的自定义扩展。
        </p>
      </section>
      <section>
        <h2>02 / 基本颜色</h2>
        <div className="wt-tag-basic-grid">
          {gameTagBasicColors.map((id) => (
            <div key={id}>
              <h3>{gameTagTones[id].label}</h3>
              <GameTag tone={id}>{word}</GameTag>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="wt-tag-lab-title">
          <h2>03 / 材质与特效</h2>
          <span className="wt-tag-lab-source">七彩特权效果 · 持续播放</span>
        </div>
        <p className="wt-tag-motion-status">七彩持续播放 · 明亮彩光与扫光特效</p>
        <div className="wt-tag-tier-grid">
          {gameTagTiers.map((id) => (
            <div key={id}>
              <h3>{gameTagTones[id].label}</h3>
              <GameTag tone={id}>{word}</GameTag>
              <small>
                {
                  (
                    {
                      bronze: "拉丝铜面 · 氧化暗纹",
                      silver: "镜面银光 · 细密拉丝",
                      gold: "抛光黄金 · 金属反射",
                      emerald: "通透翠绿 · 宝石折光",
                      diamond: "冰晶切面 · 多面反射",
                      king: "曜石深底 · 内嵌金饰",
                      rainbow: "明亮七彩 · 流动扫光",
                    } as Record<string, string>
                  )[id]
                }
              </small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>04 / 自由组合</h2>
        <p className="wt-tag-lab-source">
          {account.session?.role === "superadmin"
            ? "超级管理员：全部标签样式已开放"
            : access.loading
              ? "正在核验当前账号资格…"
              : access.access?.bound
                ? `绑定账号 ${access.access.level ?? "未知"} 级 · 历史战斗 ${access.access.rbBattles ?? "未知"} 次`
                : "尚未绑定游戏账号：可选官方原版与基本颜色。"}
        </p>
        {!account.session?.user && (
          <button type="button" className="quiet-button" onClick={() => void account.login()}>
            登录并查看解锁资格
          </button>
        )}
        {account.session?.user && !access.access?.bound && (
          <a href="#/stats">前往战绩页绑定游戏账号 ↗</a>
        )}
        {access.error && <p role="alert">{access.error}</p>}
        <button type="button" className="wt-vehicle-text-action" onClick={access.refresh}>
          刷新标签资格
        </button>
        <TagSelector
          options={tagCatalog.options}
          loading={tagCatalog.loading}
          error={tagCatalog.error}
          onRetry={tagCatalog.refresh}
          value={choices}
          onChange={setChoices}
          allowedTones={access.allowedTones}
          max={8}
        />
        <p className="wt-tag-lab-source">
          上方为全样式对照；实际可选范围以下方选择器为准。组合仅保留在当前页面，队列分享会保存发布时选择的样式。
        </p>
      </section>
    </main>
  );
}
