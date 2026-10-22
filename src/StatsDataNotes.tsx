import rules from "../data/player-stats-rules.json";
export function StatsDataNotes() {
  const { minimumBattles } = rules.efficiency;
  return (
    <div className="wt-data-notes">
      <p className="wt-data-intro">
        生涯看全貌，Top 5 看常用载具。两处统计范围不同，阅读时请先留意标题。
      </p>
      <section className="wt-data-note">
        <div className="wt-data-note-heading">
          <h3>效率评分</h3>
          <span>0–{rules.efficiency.maximum}</span>
        </div>
        <p>
          评分受击毁与死亡表现、场均击毁、每次出击击毁、胜率、场均死亡与场均出击影响。
          它不是官方评级或全服排名；不足 {minimumBattles} 场记 0 分。
        </p>
        <div className="wt-efficiency-weights">
          <span>
            <b>K/D</b> 击毁与死亡
          </span>
          <span>
            <b>K/B</b> 场均击毁
          </span>
          <span>
            <b>W/B</b> 胜率
          </span>
          <span>
            <b>K/R</b> 每次出击击毁
          </span>
          <span>
            <b>D/B</b> 场均死亡
          </span>
          <span>
            <b>R/B</b> 场均出击
          </span>
        </div>
        <p>缺失关键记录时显示“—”，未返回的击毁类别保持未知。</p>
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
            展示同一模式下的胜率、对空表现、对地表现、综合 K/D、出击表现与场均击毁。
            各维度统一展示为 0–100；缺项留空，不表示全服名次。
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
