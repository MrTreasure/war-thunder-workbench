import { t, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { GameTag, gameTagBasicColors, gameTagTiers, gameTagTones } from "./components/GameTag";
import { TagSelector, type TagChoice } from "./components/TagSelector";
import { useTagCatalog, tagLabel } from "./game-tag-catalog";
import { useGameTagAccess } from "./game-tag-access";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import registry from "../data/lineup-sharing-tags.json";
import "./tag-preview.css";

export function TagPreview() {
  useLocale();
  const [choices, setChoices] = useState<TagChoice[]>([
    { id: "classic", tone: "original" },
    { id: "flank", tone: "color-blue" },
  ]);
  const [vehicleChoices, setVehicleChoices] = useState<TagChoice[]>([]);
  const vehicleCatalog = useTagCatalog("vehicle");
  const access = useGameTagAccess();
  const tagCatalog = useTagCatalog();
  const account = useWorkbenchAccount();
  const word = choices.length
    ? tagLabel(choices[choices.length - 1].id, tagCatalog.items) || t("经典标配")
    : t("经典标配");
  return (
    <main className="wt-tag-lab">
      <header>
        <div>
          <p className="wt-tag-lab-eyebrow">{t("游戏标签 · 独立样式验收")}</p>
          <h1>{t("标签表单与编辑弹层")}</h1>
          <p>{t("点击标签字段体验编辑；文案与样式分别选择，确认后应用。下方保留样式对照。")}</p>
        </div>
        <Link to="/lineups" preload={false}>
          {t("返回出击队列 ↗")}
        </Link>
      </header>
      <section>
        <h2>{t("标签表单组件")}</h2>
        <p className="wt-tag-lab-source">
          {account.session?.role === "superadmin"
            ? t("超级管理员：全部标签样式已开放")
            : access.loading
              ? t("正在核验当前账号资格…")
              : access.access?.bound
                ? t(
                    t("绑定账号 {0} 级 · 历史战斗 {1} 次"),
                    access.access.level ?? t("未知"),
                    access.access.rbBattles ?? t("未知"),
                  )
                : t("尚未绑定游戏账号：可选官方原版与基本颜色。")}
        </p>
        {!account.session?.user && (
          <button type="button" className="quiet-button" onClick={() => void account.login()}>
            {t("登录并查看解锁资格")}
          </button>
        )}
        {account.session?.user && !access.access?.bound && (
          <Link to="/stats" preload={false}>
            {t("前往战绩页绑定游戏账号 ↗")}
          </Link>
        )}
        {access.error && <p role="alert">{access.error}</p>}
        <button type="button" className="wt-vehicle-text-action" onClick={access.refresh}>
          {t("刷新标签资格")}
        </button>
        <TagSelector
          options={tagCatalog.options}
          loading={tagCatalog.loading}
          error={tagCatalog.error}
          onRetry={tagCatalog.refresh}
          value={choices}
          onChange={setChoices}
          allowedTones={access.allowedTones}
          max={5}
          label={t("队列标签")}
        />
        <p className="wt-tag-lab-source">
          {t(
            t(
              "演示表单已放入两条标签。点击字段打开编辑弹层，文案和样式分别选择；确认后回填，取消保留原值。",
            ),
          )}
        </p>
      </section>
      <section>
        <h2>{t("载具标签")}</h2>
        <TagSelector
          scope="vehicle"
          options={vehicleCatalog.options}
          loading={vehicleCatalog.loading}
          error={vehicleCatalog.error}
          onRetry={vehicleCatalog.refresh}
          value={vehicleChoices}
          onChange={setVehicleChoices}
          allowedTones={access.allowedTones}
          max={1}
          label={t("载具标签")}
        />
        <p className="wt-tag-lab-source">
          {t(
            "载具评价文案供玩家自主选择，参考社区讨论，不是官方评级。此处仅演示选择，不提交打标或消耗额度。",
          )}
        </p>
      </section>
      <section>
        <h2>{t("01 / 游戏原版对照")}</h2>
        <div className="wt-tag-reference">
          <div>
            <small>{t("官方原始文件 · 等比显示")}</small>
            <img
              src={registry.officialTag.url}
              width={67.5}
              height={28.5}
              alt={t("官方未染色的 45×19 标签底纹")}
            />
          </div>
          <div>
            <small>{t("保留底纹 · 仅扩展中段")}</small>
            <GameTag tone="original">−50%</GameTag>
          </div>
          <div>
            <small>{t("游戏红色 · #ff313b 乘色")}</small>
            <GameTag tone="red">−50%</GameTag>
          </div>
        </div>
        <p className="wt-tag-lab-source">
          {t("底纹直接读取")}
          <a href={registry.officialTag.url} target="_blank" rel="noreferrer">
            {t("官方原图 ↗")}
          </a>
          {t("，不重绘形状。七档配色是工作台的自定义扩展。")}
        </p>
      </section>
      <section>
        <h2>{t("02 / 基本颜色")}</h2>
        <div className="wt-tag-basic-grid">
          {gameTagBasicColors.map((id) => (
            <div key={id}>
              <h3>{localize(gameTagTones[id].label)}</h3>
              <GameTag tone={id}>{word}</GameTag>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="wt-tag-lab-title">
          <h2>{t("03 / 材质与特效")}</h2>
          <span className="wt-tag-lab-source">{t("七彩特权效果 · 持续播放")}</span>
        </div>
        <p className="wt-tag-motion-status">{t("七彩持续播放 · 明亮彩光与扫光特效")}</p>
        <div className="wt-tag-tier-grid">
          {gameTagTiers.map((id) => (
            <div key={id}>
              <h3>{localize(gameTagTones[id].label)}</h3>
              <GameTag tone={id}>{word}</GameTag>
              <small>
                {
                  (
                    {
                      bronze: t("拉丝铜面 · 氧化暗纹"),
                      silver: t("镜面银光 · 细密拉丝"),
                      gold: t("抛光黄金 · 金属反射"),
                      emerald: t("通透翠绿 · 宝石折光"),
                      diamond: t("冰晶切面 · 多面反射"),
                      king: t("曜石深底 · 内嵌金饰"),
                      rainbow: t("明亮七彩 · 流动扫光"),
                    } as Record<string, string>
                  )[id]
                }
              </small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
