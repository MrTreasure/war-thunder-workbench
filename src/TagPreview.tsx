import { useState } from "react";
import {
  GameTag,
  gameTagBasicColors,
  gameTagChoiceGroups,
  gameTagTiers,
  gameTagTones,
} from "./components/GameTag";
import type { GameTagTone } from "./components/GameTag";
import registry from "../data/lineup-sharing-tags.json";
import officialTexts from "../data/game-tag-texts.json";
import "./tag-preview.css";

export function TagPreview() {
  const [word, setWord] = useState("经典标配");
  const [tone, setTone] = useState<GameTagTone>("gold");
  const [textQuery, setTextQuery] = useState("");
  const matchesText = (label: string) =>
    label.toLocaleLowerCase().includes(textQuery.trim().toLocaleLowerCase());
  const officialText = officialTexts.titles.find((title) => title.label === word);
  const [combinations, setCombinations] = useState<{ word: string; tone: GameTagTone }[]>([]);
  return (
    <main className="wt-tag-lab">
      <header>
        <div>
          <p className="wt-tag-lab-eyebrow">游戏标签 · 独立样式验收</p>
          <h1>文案、颜色与材质，自由组合</h1>
          <p>先对照游戏原版，再选择文案与底色。配色不绑定语义，也不表示账号等级。</p>
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
                      silver: "柔和银面 · 细密拉丝",
                      gold: "缎面黄金 · 温润反光",
                      emerald: "通透翠绿 · 温润抛光",
                      diamond: "冰晶切面 · 柔和折射",
                      king: "曜石深底 · 镶金边缘",
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
        <div className="wt-tag-composer">
          <div className="wt-tag-words">
            <h3>选择文案</h3>
            <input
              className="wt-tag-text-search"
              type="search"
              aria-label="标签文案搜索"
              placeholder="搜索官方称号或队列文案"
              value={textQuery}
              onChange={(event) => setTextQuery(event.target.value)}
            />
            <h4>官方游戏称号 · {officialTexts.titles.length}</h4>
            <div>
              {officialTexts.titles
                .filter((title) => matchesText(title.label))
                .map((title) => (
                  <button
                    key={title.id}
                    type="button"
                    aria-pressed={word === title.label}
                    onClick={() => setWord(title.label)}
                    title={`来自官方公告《${title.sourceTitle}》`}
                  >
                    {title.label}
                  </button>
                ))}
            </div>
            <p className="wt-tag-lab-source">
              {officialText ? (
                <>
                  官方出处：
                  <a href={officialText.sourceUrl} target="_blank" rel="noreferrer">
                    {officialText.sourceTitle} ↗
                  </a>{" "}
                  ·{" "}
                </>
              ) : null}
              称号仅作标签文案引用，不代表已解锁。
            </p>
            <h4>队列文案</h4>
            <div>
              {registry.tags
                .filter((t) => matchesText(t.label))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={word === t.label}
                    onClick={() => setWord(t.label)}
                  >
                    {t.label}
                  </button>
                ))}
            </div>
          </div>
          <div className="wt-tag-finishes">
            <h3>选择标签</h3>
            {gameTagChoiceGroups.map((group) => (
              <div className="wt-tag-choice-group" key={group.label}>
                <h4>{group.label}</h4>
                <div>
                  {group.tones.map((id) => (
                    <GameTag key={id} tone={id} selected={tone === id} onClick={() => setTone(id)}>
                      {gameTagTones[id].label}
                    </GameTag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="wt-tag-result">
          <span>当前组合</span>
          <GameTag tone={tone}>{word}</GameTag>
          <button
            type="button"
            disabled={combinations.length >= 8}
            onClick={() => setCombinations([...combinations, { word, tone }])}
          >
            加入组合 · {combinations.length}/8
          </button>
        </div>
        {combinations.length > 0 && (
          <div className="wt-tag-combinations" aria-label="自由组合结果">
            {combinations.map((c, i) => (
              <div key={i}>
                <GameTag tone={c.tone}>{c.word}</GameTag>
                <button
                  type="button"
                  aria-label={`移除第 ${i + 1} 个组合`}
                  onClick={() => setCombinations(combinations.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="wt-tag-lab-source">
          组合只保留在当前页面；七彩作为特权效果持续播放，文案与材质可自由搭配。
        </p>
      </section>
    </main>
  );
}
