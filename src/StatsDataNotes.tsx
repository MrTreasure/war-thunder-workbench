import rules from "../data/player-stats-rules.json";
export function StatsDataNotes() {
  const { smoothing: s, weights } = rules.efficiency;
  return (
    <div className="wt-data-notes">
      <p className="wt-data-intro">
        生涯看全貌，Top 5 看常用载具。两处统计范围不同，阅读时请先留意标题。
      </p>
      <section className="wt-data-note">
        <div className="wt-data-note-heading">
          <h3>参考效率</h3>
          <span>0–{rules.efficiency.maximum}</span>
        </div>
        <p>
          综合击毁、出击和胜率，帮助比较你自己的记录。它不是官方评分，也不是全服排名；不足 50
          场会标注“小样本”。
        </p>
        <div className="wt-efficiency-weights">
          <span>
            <b>{weights.kd * 100}%</b> 击毁 / 死亡
          </span>
          <span>
            <b>{weights.kr * 100}%</b> 击毁 / 出击
          </span>
          <span>
            <b>{weights.winRate * 100}%</b> 胜率
          </span>
        </div>
        <details className="wt-data-formula">
          <summary>查看计算方式</summary>
          <dl>
            <div>
              <dt>平滑 K/D</dt>
              <dd>
                (K + {s}) / (D + {s})
              </dd>
            </div>
            <div>
              <dt>平滑 K/R</dt>
              <dd>
                (K + {s}) / (R + {s})
              </dd>
            </div>
            <div>
              <dt>平滑胜率 wr</dt>
              <dd>
                (W + {s / 2}) / (B + {s})
              </dd>
            </div>
          </dl>
          <code>
            {rules.efficiency.maximum} × ({weights.kd} × kd/(1+kd) + {weights.kr} × kr/(1+kr) +{" "}
            {weights.winRate} × wr)
          </code>
          <p>
            结果四舍五入。K 为已返回的击毁合计，D 为死亡，R 为出击，W 为胜场，B
            为场次；缺失关键项时不计算效率。
          </p>
        </details>
      </section>
      <section className="wt-data-note">
        <div className="wt-data-note-heading">
          <h3>K/D 怎么看</h3>
          <span>击毁 ÷ 对应死亡</span>
        </div>
        <dl className="wt-data-kd">
          <div>
            <dt>陆军对地</dt>
            <dd>陆军的地面目标击毁 / 陆军载具死亡</dd>
          </div>
          <div>
            <dt>航空对空</dt>
            <dd>航空的空中目标击毁 / 航空载具死亡</dd>
          </div>
          <div>
            <dt>海军对海</dt>
            <dd>海军的海上目标击毁 / 海军载具死亡</dd>
          </div>
          <div>
            <dt>单车 K/D</dt>
            <dd>该车对空、对地或对海击毁 / 该车死亡</dd>
          </div>
        </dl>
        <p>只配对同一范围内已返回的记录。综合 K/D 合计已知击毁；缺少死亡记录时，不推测分母。</p>
      </section>
      <div className="wt-data-note-pair">
        <section className="wt-data-note">
          <h3>六维能力图</h3>
          <p>
            按同一模式换算至 0–100。胜率使用原百分比，比值按 100 × x / (1 + x)
            换算；缺项留空，不表示全服名次。
          </p>
        </section>
        <section className="wt-data-note">
          <h3>累计银狮</h3>
          <p>
            记录载具累计获得的银狮，按四位分组阅读。它不是当前余额或扣除维修后的净收入；未返回的金额显示“—”。
          </p>
        </section>
      </div>
      <p className="wt-data-footnote">
        资料来自公开统计，载具列表仅包含有出击记录的载具，并非完整车库。AI
        点评基于这些资料，不代表官方评价。
      </p>
    </div>
  );
}
