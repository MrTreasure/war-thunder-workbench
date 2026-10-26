import { useState } from "react";
import { GameTag, gameTagTiers, gameTagTones } from "./components/GameTag";
import type { GameTagTone } from "./components/GameTag";
import registry from "../data/lineup-sharing-tags.json";
import "./tag-preview.css";

export function TagPreview() {
  const [word, setWord] = useState("经典标配");
  const [tone, setTone] = useState<GameTagTone>("gold");
  const [animated, setAnimated] = useState(true);
  const [combinations, setCombinations] = useState<{ word: string; tone: GameTagTone }[]>([]);
  return (
    <main className="wt-tag-lab">
      <header>
        <div>
          <p className="wt-tag-lab-eyebrow">游戏标签 · 独立样式验收</p>
          <h1>同一句话，自由搭配七档质感</h1>
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
        <div className="wt-tag-lab-title">
          <h2>02 / 七档配色</h2>
          <button type="button" aria-pressed={!animated} onClick={() => setAnimated(!animated)}>
            {animated ? "暂停七彩闪烁" : "开启七彩闪烁"}
          </button>
        </div>
        <div className="wt-tag-tier-grid">
          {gameTagTiers.map((id) => (
            <div key={id}>
              <h3>{gameTagTones[id].label}</h3>
              <GameTag tone={id} animated={animated}>
                {word}
              </GameTag>
              <small>
                {id === "rainbow"
                  ? "七色金属流光 · 可暂停"
                  : id === "king"
                    ? "深金底 · 浅金文字"
                    : id === "diamond"
                      ? "冰蓝银面 · 深色文字"
                      : "原版金属底纹 · 独立乘色"}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>03 / 自由组合</h2>
        <div className="wt-tag-composer">
          <div className="wt-tag-words">
            <h3>选择文案</h3>
            <div>
              {registry.tags.map((t) => (
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
            <div>
              {gameTagTiers.map((id) => (
                <GameTag
                  key={id}
                  tone={id}
                  animated={animated}
                  selected={tone === id}
                  onClick={() => setTone(id)}
                >
                  {gameTagTones[id].label}
                </GameTag>
              ))}
            </div>
          </div>
        </div>
        <div className="wt-tag-result">
          <span>当前组合</span>
          <GameTag tone={tone} animated={animated}>
            {word}
          </GameTag>
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
                <GameTag tone={c.tone} animated={animated}>
                  {c.word}
                </GameTag>
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
          组合只保留在当前页面；暂停及减少动态效果设置都会停止闪烁。导出图片保留静态颜色。
        </p>
      </section>
    </main>
  );
}
