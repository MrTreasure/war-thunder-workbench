import "../src/main";
import "./preview.css";
const notice = document.createElement("aside");
notice.className = "wt-preview-notice";
notice.innerHTML =
  '<span>小程序界面预览 · 游客模式</span><a href="../heybox-review/">截图与验收结果 ↗</a>';
document.body.prepend(notice);
