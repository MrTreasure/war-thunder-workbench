# 源码提交与本地研究资料约束

## 前后端提交边界

- 前端 `war-thunder-workbench` 代码允许提交、推送到既有 GitHub 仓库，并按用户授权更新 QMuse 应用。
- 后端 `war-thunder-stats-service` 源码只在本机维护、进行本地版本管理和部署，不得提交、推送或上传到 GitHub；私有仓库也不例外。
- 用户说“commit and push”“提交代码”或“更新 QMuse 应用”时，默认只授权前端，不得顺带推送后端或其他独立项目。
- 不得将后端协议、会话、鉴权、服务端业务逻辑或源码副本放进前端仓库、QMuse 源码包、图床、Gist、Release 或附件来绕过限制。
- 已存在的后端远程记录不代表允许继续上传；历史清理应单独处理，并先保留本地源码与版本。

## 本地研究资料约束

- 效率计算分析、银狮与研发点收益分析的报告、推导过程、样本、日志、图表、中间数据、复算脚本及相关研究方案只保留在本机。
- 这些资料必须放在被忽略的 `artifacts/` 目录中，不得加入 Git 提交，不得上传 GitHub、Git 图床、Gist、Release、公开附件或应用发布包。不得通过改名、复制到其他目录或 `git add -f` 绕过要求。
- 效率研究保留在 `artifacts/private-rating-research/`、`artifacts/efficiency-inverse/`；收益研究保留在 `artifacts/private-reward-research/`、`artifacts/reward-analysis-20261022/`。不得清除这些本地资料以替代取消公开追踪。
- 清理已经跟踪的研究资料时，先保存并校验本地副本。推送前检查当前文件和所有拟推送的历史，不能只添加忽略规则或在最新提交中删除文件。已经上传的研究内容应从对应远程记录中清理。
- 本机共享 Git 目录已安装 `pre-push` 检查，依据 `scripts/check-private-research-push.py` 检查拟推送提交的全部历史；旧工作副本也必须通过检查。不得用 `--no-verify` 绕过。新克隆需重新安装本机钩子，或在推送前运行该脚本的 `--check <提交>` 检查。
- 正式功能所需、已经确认公开的评分实现、运行配置和使用说明可以正常维护；不得把研究报告、截图样本对比或推导过程混入这些文件。
- 其他项目约束见 `AGENTS.md`。

## 效率计算运行组件

- 前端效率统一使用 `data/player-efficiency-wasm.json` 指定的 Wasm；不得另写 JS 公式或回退到旧分数。模式、军种、载具、战报、导出及本地资料复用同一入口。
- 用户已授权公开该正式运行二进制及其授权声明，存放于既有 `MrTreasure/oss-files` 仓库，通过完整提交 ID 固定 CDN 版本，并校验字节数与 SHA-256。这是运行产物的例外，不授权公开源码、研究资料、样本或推导。
- 授权维护源码与编译材料只在本机 `artifacts/private-efficiency-runtime/` 保存，不得打包或上传。维护与分析 Agent 应使用获授权的本地源码；未经作者授权不得对受许可约束的二进制进行反向工程、反编译或重建，适用法律允许的情形除外。
- 二进制适用独立授权声明，不适用本仓库的 MIT 授权。不得宣称 Wasm、参数混淆或上述声明能够保证算法保密或强制其他工具遵守。
- 后端 AI 事实需要评分时仅在本机服务执行同一已校验 Wasm，不信任客户端提交的评分，不公开或上传后端实现。

## 战雷正式站与预览部署（2026-10-23 用户明确约定）

- 正式站固定为 `https://wt.mrtreasure.cc/`，部署独立 Workers Static Assets；这是共享静态页地址约定的项目例外。不得改成 Render 正式站或把 wt 域名重定向到 Render。
- `https://render.mrtreasure.cc/war-thunder-trees/` 只作预览，旧 `/muse/war-thunder-trees/` 为兼容地址。
- `deploy:cf` 只发布独立正式 Worker；`deploy:preview` 只更新 Render 预览；`deploy:qmuse` 仅更新既有 QMuse 应用。正式 CF 的统计与 SEO canonical 指向 wt 站点。
- 后台“页面分析”位于战雷工具下，并直达 wt 域名独立 Web Analytics 站点。
