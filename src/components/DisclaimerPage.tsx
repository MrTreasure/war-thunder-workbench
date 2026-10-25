import "./app-footer.css";

/** Shared scroll-content footer. Never replaces the persistent account/header controls. */
export function DisclaimerPage() {
  return (
    <article className="wt-disclaimer-page">
      <h2>免责声明</h2>
      <div className="wt-disclaimer-copy">
        <p>
          本应用为玩家独立开发的非官方工具，与 Gaijin Entertainment 无隶属或官方背书关系。
          游戏基础资料整理自{" "}
          <a href="https://wiki.warthunder.com/" target="_blank" rel="noopener noreferrer">
            战争雷霆官方 Wiki ↗
          </a>{" "}
          及官方公开渠道；游戏名称、商标、图片、地图和相关资源归相应权利人所有，社区补充资料保留原出处。
        </p>
        <p>
          内容以游戏与官方公告为准；账号参考价值、工作台效率分、折扣预测与 AI 点评仅供参考。
          如涉及权益问题，请通过{" "}
          <a
            href="https://github.com/MrTreasure/war-thunder-workbench/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            项目反馈入口 ↗
          </a>{" "}
          联系，核实后及时更正、替换或移除。
        </p>
        <p className="wt-app-platform-credit">
          本应用通过{" "}
          <a
            href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
            target="_blank"
            rel="noopener noreferrer"
          >
            QMuse Vibecoding 平台 <span aria-hidden="true">↗</span>
          </a>{" "}
          搭建
        </p>
      </div>
    </article>
  );
}
