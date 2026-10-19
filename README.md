# War Thunder 研发工作台

此独立项目是原 Muse 战雷页面的新规范源，使用 QMuse 开发模板的 React + Vite、TanStack 文件路由、Tailwind v4、TypeScript 7、Oxlint。
保留十国四军种的官方现有科技树、原始列位置、折叠组、真实前置、AB/RB/SB 权重及载具研发点。
权重模式切换后，载具卡片与详情只显示当前模式的权重，不并排展示其他模式。
旧 `../war-thunder-trees/` 为迁移前快照，不再作为发布入口。

公开页面：https://render.mrtreasure.cc/muse/war-thunder-trees/index.html

## Codex 接续说明（2026-10-19）

新会话先读取本目录 `AGENTS.md`、父目录 `../AGENTS.md` 和本 README。
中文对话称呼用户“老大”。本节用于接续当前会话，明确区分已发布内容与已确认待办。

### NAS 目录与项目关系

| 用途 | 路径 |
| --- | --- |
| 唯一规范源码项目，新 Codex 的工作目录 | `/vol1/1000/deploy/data/MrTreasure/war-thunder-workbench` |
| Vite 构建输出 | 本项目的 `dist/` |
| Nginx 正式静态页目录 | `/vol1/1000/nginx/public/resume/muse/war-thunder-trees` |
| 发布备份 | `/vol1/1000/appdata/war-thunder-trees/backups/` |
| Muse 兼容工作区，由发布脚本同步 | `/home/Treasure/.picoclaw/workspace/war-thunder-tree` |
| 迁移前旧项目，不在这里继续开发 | `/vol1/1000/deploy/data/MrTreasure/war-thunder-trees` |
| 管理控制台，是另一个项目 | `/vol1/1000/deploy/data/MrTreasure/admin-console` |

当前项目已建立独立 Git 仓库，预览基线标记为 `v1.0.0-preview.4`。
后续先交付构建预览与 Git 版本，用户明确确认后再执行 QMuse 导入。
不要直接编辑正式目录、`dist/` 或 Muse 兼容目录来代替源码修改。

### 已发布的当前状态

- React 19.3.1 / React DOM 19.3.1、Vite 8.3.4、TypeScript 7.0.2、Oxlint 1.88.0、
  Oxfmt 0.73.0、pnpm 12.3.4；依赖固定版本，不改回旧版 TypeScript。
- 十国、四类军种、34 棵可用科技树、3124 条载具记录。中国、瑞典、以色列没有海军树时
  显示真实空状态。常规树保留原始列、前置箭头和折叠组；金币、礼包及特殊载具单独放在右侧。
- 顶部国家下拉带官方国旗；工具栏紧凑；搜索、展开折叠组、路线定位、缩放和全屏可用。
- AB / RB / SB 模式切换后，卡片和详情仅显示选中模式的权重，不同时展示三种，也不靠高亮区分。
- 按钮和原生 select 已统一样式；select 使用 CSS 箭头并预留右侧留白，避免箭头贴边和文字重叠。
- 载具报价面板已精简：左侧目标、单价及账号进度，右侧清单；总经验、总价、购物车按钮固定显示。
  等级核对、其他已有载具与高级设置默认折叠。基础 RP 可切换编辑，未知成本必须补填。
- 已有载具、补研偏好均有 Rank 筛选，可叠加搜索、常规/特殊类型和已勾选筛选；切换选项卡保留等级。
- 提供单独的配件研发面板、独立单价、已完成配件扣除、已投入 RP 和手工总额修正。
  配件名称已接入原版简体中文；无法可靠匹配的弹药名称保留英文，详见下方接续记录。
- 两种报价均可加入本地购物车，载具共享前置去重；整数分和 BigInt 算价，不按整万 RP 向上取整。
- 首次进入不请求车辆或配件数据。选定国家后一次读取该国全部军种及配件的单个 JSON；
  切换军种、打开配件面板不再请求额外数据。记住上次国家/军种，有效 URL 参数优先。
- 数据缓存优先 OPFS，不支持或写入失败降级 localStorage；两者不可写仍可在页面内存中使用。
  内容 hash、长度、结构检查失败会重新下载。配额淘汰只清理自己的数据缓存，不清购物车与进度。
- 战雷炭灰、红色操作、金色高级载具风格；官方 Logo、背景、ICO、载具图、国旗全部使用官方在线链接。
  字体继续同源提供，符合现有 CSP。加载画面使用官方素材；国家 JS 模块加载期间显示不定进度。

最近一次发布备份为 `react-20261019-221015`，发布记录在该备份的 `publication.json`；
HTML SHA256 为 `80350516ccfa8b6f48b36f8569016b5d611c5838687ffd42e276a14b4b74f122`，
共 20 个构建文件（10 个国家 JS 模块、7 个路由/应用 JS、CSS、HTML、字体）。该版已通过数据检查、TypeScript、
Oxlint、格式检查和构建，正式静态目录全部 20 个文件与构建 SHA256 一致。
本次预览的外网资源核对结果随构建产物交付记录保存。
旧 hash 资源继续保留，UI 由用户手动验收。这里的 hash 是交接快照，后续发布会正常改变。

### 本轮接续完成（2026-10-19）

- 已实现手动“已开放等级 / 计价起点”：选择 VIII 后，I～VII 不计价；VIII 的未拥有前置仍计入。
  起点及以上的数量门槛、补位与指定补研照常计算。自动模式继续按真实已有记录计算。
- 不把低等级载具批量写入 `owned`，不修改已有金币、礼包、活动等记录；历史购物车报价不重算。
  目标低于起点时显示“目标低于计价起点”，并在报告、新购物车报价依据中记录起点。
- 已核对：ZTZ99A 在手动 VIII、未勾选已有时，仅包含 WZ1001 与 ZTZ99A，合计 810,000 RP。
  同级前置、较低起点的数量门槛、低等级指定项跳过、目标已拥有/低于起点为 0、未知 RP 阻止报价均已核对。
- `data/localization.json` 保存原版游戏 `<Chinese>` 简体中文映射；目前 3124 辆载具全部覆盖。
  载具优先使用游戏 `_shop` 科技树短名，缺少时使用 `_1` / `_0`；英文名继续可搜索。
  保留 key 的原始大小写，处理 Wiki 将 ID 转小写的情况，避免 Fw 190 等型号混淆。
- 配件按 **ID + Wiki 英文名称** 分别映射，不假设一个 ID 对应唯一名字。
  当前 1933 种名称组合中 1887 种有可核对的原版名称，46 种弹药/弹链名称暂无可靠对应，
  保留英文并列于 `coverage.modificationMissing`；不使用机器翻译。
- 来源为社区保存的原版游戏文件，不是官方 API。固定 commit、各 CSV 字节数、Git blob、SHA256、
  核对时间和原始本地化 key/中英文均保存在 JSON；仅去除 U+200B/U+FEFF 与首尾空白，
  对武器名称使用原版模板并记录数值参数。弹药反查只接受完整英文名称和唯一中文结果，禁止模糊匹配。
- `scripts/localization.py` 可重复更新语言数据，完整下载并验证后才原子替换 JSON。
  `pnpm run refresh:localization` 独立更新；全量 `refresh` 已接入该步骤，失败保留旧映射且阻止发布。
- `prepare-data.mjs` 将中文映射组合进各国数据文件，生成 `nameEn` / `nameZhCN` / `localizationKey`，
  展示字段 `name` 优先使用简中。Wiki 原始 JSON 保持原样，不改 RP、完整性、成本来源时间或任何 ID。
  `check:data` 验证映射、原始中文转换、国家文件名及成本/来源与 Wiki 数据逐项一致。
- 数据更新后如 Wiki 新增或改名导致映射过期，数据门禁阻止发布；先更新语言映射再构建。
  UI 仍由用户在原 Muse 地址手动验收，不启动开发服务器或浏览器自动化。

### 按国家合并数据（2026-10-19）

- 按用户新要求将 68 个军种/配件文件合并为 10 个国家 JSON，载具与配件一起下载和缓存。
- 初始无国家选择时不下载；选定国家后仅请求一个国家文件，同国内切换无需继续下载。
- 缓存 key 改用 `country-{country}`；继续使用原有 OPFS / localStorage / 内存降级与 hash 校验。
  购物车、账号进度及选择记忆键不变；发布保留旧 hash 文件，兼容仍打开旧版的页面。
- `AGENTS.md` 已同步此项新要求；原“按军种加载、配件延迟请求”的约束已由用户要求替换。

### 出击队列与详情大图（2026-10-19）

- 顶部新增“出击队列”，按国家在 `wt-lineups-v1:{country}` 保存多个自定义队列。
  支持新建、命名、复制、删除、11 个有序槽位、换车、清空、横向长按拖动排序及空战 RB 出击飞机选择。
  保存失败会提示只在本次页面有效；不修改账号已有载具、RP、购物车或选择记忆。
- 队列只使用已下载的国家文件，切换到另一国家时复用主页面的加载/缓存流程；不新增分片。
  可筛选军种、搜索中文/英文/ID；联动防空系统按控制车归并，发射车不作为额外乘员槽位。
- 分享码严格区分大小写，固定 **24 位**：前两位国家码，后面 11 组各两位载具码，空位为 `00`。
  字符表为 `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`。
  国家码：美国 US、德国 DE、苏联 SU、英国 GB、日本 JP、中国 CN、意大利 IT、法国 FR、瑞典 SE、以色列 IL。
  导入先解析国家、加载相应国家文件，再预览并保存为新队列；校验长度、字符、未知码与重复载具。
  保留中间空位及顺序。没有额外校验位，改动大小写可能得到另一个有效载具，请始终复制原码。
- 分享码只保存国家与槽位，不携带名称、战斗类型或空战 RB 出击飞机。导入后按载具推断类型，
  首架有效飞机作为初始 RB 出击飞机，用户可修改。空队列导入以当前军种对应类型为默认。
- `data/lineup-codebook.json` 是不可重编号的稳定字典，现有 3124 个编码；新载具只追加，
  下架条目保留且不复用。严禁按排序重建全部编码或改变国家前缀。编码容量为每国 3843 辆。
  使用 `pnpm run refresh:lineup-codes` 追加新车；全量 refresh 已接入。数据门禁拒绝漏码、冲突、跨国映射。
  字典只组合进各国 JSON 的 `lineupCodes`，不在启动 JS 中嵌入全车编码，也不单独发布。
- `data/lineup-rules.json` 保存规则、来源、槽位上限与字符配置。BR 使用整数三分之一档位计算，
  不直接对四舍五入后的显示值做浮点运算。空战 AB：前三架 A/2+B/4+C/4，两架 (A+B)/2，
  单架取自身；B/C 与 A 的差距最多按两档计，取最近档位、正中间向上，最终最多低于 A 一档。
  取整依据官方开发说明，单架/两架算法采用当前 Wiki；旧开发说明中的旧单架及战绩补偿规则不采用。
- 空战 RB 只算指定出击飞机；陆战 AB 只取地面载具最高值；陆战 RB 对地面载具及飞机取最高值，
  飞机使用 `trb`，不混用空战 `rb`。海战 AB/RB 取可用舰艇与飞机最高值，
  超过最高舰艇一档的飞机不能使用且不计权重，界面列出排除项。未知 BR 阻止该模式结果。
- 陆战 SB 按活动名单，空战 SB 按房间必需/允许范围；显示范围与规则说明，不编造普通队列匹配值。
  海战无普通 SB。队列是机库估算，锁定、损坏、活动限制与账号槽位解锁需以游戏为准。
- 详情显示官方大图，点击可在弹层进一步放大；载具标题链接官方 Wiki，操作按钮统一为
  “研发载具”与“研发配件”。独立获取载具的常规研发按钮禁用并说明。
  图片 URL 在 JSON 组合阶段由 `catalog-settings.json` 的官方地址模板生成，失败回退官方预览图，
  不复制图片到本地，不改变 CSP；主战坦克及飞机的大图地址已核对 HTTP 200。
- 已核对 3124 个编码导出/导入往返、大小写区别、有序空位、无效码拦截、各模式规则、未知 BR 和本地结构。
  `docs/lineup-states.preview.html` 为不发布的本地控件状态预览；UI 与真实交互仍由用户手动验收。

### 出击队列独立路由与横向编队（2026-10-19）

- 出击队列现在是独立页面 `/muse/war-thunder-trees/index.html#/lineups`，研发树为 `#/tree`。
  使用现有 Muse 入口的 hash 路由，支持直接访问、刷新、浏览器前进/后退；不依赖新的 Nginx 路径。
  页面切换复用已加载的国家数据，国家/军种/模式继续同步 URL 参数，不再打开队列弹窗。
- 11 个乘员槽位为游戏式横向单排卡片，始终不换行；窄屏横滚，所有卡片操作保持单行底栏。
  卡片长按 350ms 后拖动，拖动柄按住即可拖动，接近左右边缘自动横滚，松开后按插入位置调整顺序。
  卡片未到长按时间的横划只滚动；垂直滑动仍可滚动页面。Esc、指针取消、失焦、离开页面或在栏外松开
  不提交排序。键盘可用 Alt + 左右方向键移动，页面提供文字提示与辅助技术状态播报。
- 载具选择增加 Rank 筛选；与军种和中英文/ID 搜索叠加，Rank 选项来自已加载的国家数据。
- 导入仅提供按钮入口，在弹窗中粘贴分享码、加载资料、预览及确认，不常驻输入框；分享码直接以
  可选中的文本展示，点击复制调用剪贴板，失败则选择文本供手动复制，不使用只读输入框。
- 保留原 `wt-lineups-v1:*`、11 槽位顺序和 24 位分享码，不改变固定码表、已有账号记录及 RP。
  纯逻辑核对覆盖全部 11×11 移动位置、空位、顺序和分享码往返；手势、横滚、路由交互由用户手动验收，
  未运行浏览器自动化。控件预览文件只供本地查看，不发布新静态路径。

### 队列类型、拖动修复与应用封面（2026-10-19）

- 底部载具显示常规、特殊、礼包、精英、联队及市场类型标签，类型筛选可叠加军种、Rank 和搜索。
  按现有国家数据的 side / kind / premium 分类；礼包和市场中的精英载具额外保留精英标签。
  这些标签表示载具属性，不表示账号乘员是否已获得游戏内“精英资格”。
- 拖动柄现在按下即可提起，使用 `touch-action: none`，防止快速移动被旧的短划滚动逻辑取消，
  或触屏手势被浏览器滚动接管；卡片主体继续长按拖动、短划横滚。原生拖放被禁止，避免与指针排序冲突。
  边缘横滚、栏外取消、Esc 取消及 Alt + 左右排序保留。真实鼠标与触屏交互由用户手动验收。
- 应用封面选用官方 Sky Odyssey 壁纸，已核对实际尺寸 **1920×1080（16:9）**、JPEG 及 SHA256。
  原图链接、来源与核对时间保存在 `data/branding.json` 的 `cover` 项；`index.html` 配置 OG / Twitter
  分享封面，继续直接使用官方 HTTPS 原图。加载页背景保留现有官方陆军壁纸。

### QMuse 模板重构与底部入口（2026-10-19）

- 已采用提供的开发模板：`@qmuse/vite-config`、TanStack 文件路由与 Query Provider、Tailwind v4、
  路径别名、Runtime 类型与 React 错误上报入口。保留 TypeScript 7、精确依赖版本及 pnpm 锁文件。
- `src/routes/index.tsx` / `_workbench.tree.tsx` / `_workbench.lineups.tsx` 分别声明首页跳转、研发树与出击队列；继续使用
  hash 路由（`#/tree` / `#/lineups`），兼容原链接、刷新与前进后退。路由树由 `tsr generate` 生成。
- `src/Workbench.tsx` 的 Provider 保留国家资料、缓存、国家/军种/模式、购物车和详情状态，切换页面
  不额外读取数据。原始 RP、未知成本、预设队列、分享码和所有历史本地存储键不变。
- 模板样式入口为 `src/styles.css`，旧基础规则放入 `src/workbench.css`；选用模板 Button、Badge、
  Separator、工具函数与移动端 hook，后续组件可继续复用。未增加云数据库或改变账号持久化方式。
- 模板根路由保留官方 Query Provider；下一层 `_workbench` 布局承载共享状态，适配平台导入器。
- 研发树原有说明栏右侧及出击队列说明行添加“点击创作自己的工具页面，支持AI应用”，原始 Logo 和邀请地址均按用户指定，
  新标签页打开并设置 `noopener noreferrer`。研发树、出击队列及加载状态都可访问该入口，不在应用最底部新增整条页脚。
- 模板来源和模板 Skill 已保留；模板建议的 npm/cnpm 命令在本项目统一替换为 pnpm。
- QMuse 已绑定应用 `8645013411493394`，地址 https://qmuse.cn/app/8645013411493394 。
  后续执行 `pnpm run import:qmuse` 更新同一应用，不手工修改绑定文件；原 Muse 静态地址继续兼容。
  `.gitignore` 放行运行所需的索引及十国 TS 运输模块，排除依赖、构建、私有总目录与本地平台记录。

### 当前预览与确认流程

- 本地构建预览：https://render.mrtreasure.cc/muse/war-thunder-trees/index.html#/tree
- 出击队列预览：https://render.mrtreasure.cc/muse/war-thunder-trees/index.html#/lineups
- Git 预览版本：`v1.0.0-preview.4`，包含模板重构、页脚、完整规范源数据与所需运行数据包。
- 上一轮 QMuse 导入已经完成：应用 `8645013411493394`、版本 `89600402`、任务
  `import_d7d29de4-2376-45a4-8480-366117cdc847`，READY 且门禁无未完成项。
  该次操作早于用户要求“先预览、再确认导入”；后续导入须等用户明确确认。
- 不运行浏览器自动化；页面、移动端拖动与页脚视觉交互由用户手动预览。

### 文字样式与 JS 数据运输修复（2026-10-19）

- 工作台与模板此前共用了 `--muted`、`--accent` 等变量，模板的暗色背景值覆盖了辅助文字色。
  工作台变量已整体改用 `--wt-*`，并给布局显式设置正文色、背景色与字体。模板变量保留原义。
- 不再使用 `BASE_URL + data/*.json`。各国规范 JSON 在构建时生成独立的动态 JS 模块，
  导出原始 JSON 文本，选择国家后才加载；URL 由模块系统相对实际部署的 JS 位置解析。
  内容仍逐国合并，初始页面不请求车辆数据，同国内切换军种与配件没有新请求。
- 发布产物不包含独立 JSON；完整规范 JSON 留在私有 `data/generated/countries/`，
  OPFS / localStorage 缓存键、原文 SHA256、字节数与账号数据不变。原有有效缓存继续可用。
- 创作入口移入截图指定的说明栏右侧；出击队列同样使用说明行，不另加应用最底部整条页脚。
- 字体改成 Vite 管理的相对静态资产，避免在 QMuse 宿主页上寻找错误的 `/branding/` 根路径。
- `scripts/check-build.mjs` 直接读取十个构建后的 JS 模块并核对原文哈希和国家，
  检查没有 JSON 文件、首页没有预加载国家模块。类型、Lint、源数据与构建门禁一并运行。
- 当前修复交付为 `v1.0.0-preview.4`；QMuse 的上一次已导入版本尚未包含本次宽屏布局修复，待用户确认后更新。

### 4K 居中与滚动说明栏（2026-10-19）

- 科技树的缩放占位容器使用水平 auto margin，在宽屏内保持居中；缩放后仍按实际尺寸居中。
  内容超过窗口宽度时保留完整横向滚动，不产生负偏移导致首列不可访问。
- 原生 dialog 显式设置 fixed / inset: 0 / margin: auto，修复 Tailwind preflight 的 margin 重置
  导致弹窗偏左；图片和导入弹窗使用 fit-content，保留各自的宽高限制。
- 载具详情改用共享居中弹窗，常规最大宽 840px，2560px 以上宽屏为 1040px；标题、图片、
  正文与留白一起增大，保留官方标题外链、图片放大、研发载具及研发配件操作。
  对话框使用唯一标题 ID 标记，支持原生 Esc、焦点约束与返回焦点。
- 原说明与创作入口仍在同一行，但整体移入科技树滚动容器的内容末尾。
  滚动到树末尾才会看到说明栏，底部不再常驻占用科技树空间。
- 上一轮 QMuse 发布为版本 `89600414`，任务 `import_4eecb58a-9530-4a30-9846-49da19da26b5`。
  当前宽屏修复先提供 `v1.0.0-preview.4` 预览，用户确认后再导入同一 QMuse 应用。

### 队列默认列表与分享入口（2026-10-19）

- 国家资料载入后默认展示该国已保存队列：名称、战斗类型、槽位数量、各模式队列权重及横向载具预览。
  11 个槽位顺序和中间空位保留；常规/精英/礼包的现有标识与当前载具权重显示继续使用数据字段。
- 每个队列标题旁提供“分享”，显示原始大小写分享码并尝试复制；失败可选中文本手动复制。
  导入仍使用弹窗预览并确认，确认后新增队列并回到默认列表。
- “新建队列”或显式“编辑”才进入原配置界面，配置改动先保存在草稿中；点“保存队列”后写入。
  取消新建不创建空记录；取消编辑不覆盖原队列。原有记录、ID、本地存储键和码表不变。
- 仍可在配置页拖动槽位、筛选军种/Rank/载具类型、复制和删除队列；配置中的权重说明保留。
  列表不再常驻整套选车表单。新界面及完整 4K 修复包含在 `v1.0.0-preview.4`，待用户确认后导入。

### 主要代码入口

| 文件 | 职责 |
| --- | --- |
| `src/main.tsx` / `index.html` | 轻量启动、原生加载画面、React 入口与错误边界 |
| `src/App.tsx` / `src/Workbench.tsx` | QMuse 兼容入口、共享国家加载与状态、研发树与报价 |
| `src/TreeCanvas.tsx` | 科技树定位、前置连线、载具卡片、当前模式权重 |
| `src/planner.ts` | 纯计算逻辑：前置闭包、等级门槛、已有/指定/排除、执行顺序 |
| `src/VehicleCalculator.tsx` | 载具报价、账号进度、等级筛选、复制与购物车快照 |
| `src/Modifications.tsx` | 配件报价、逐项完成扣除、独立单价 |
| `src/Lineups.tsx` / `src/LineupRoster.tsx` / `src/lineups.ts` | 独立队列页、横向长按排序、Rank 筛选、本地保存及分享码 |
| `src/VehicleImage.tsx` / `src/lineups.css` | 官方大图、队列面板与响应式样式 |
| `src/quotes.ts` / `src/Cart.tsx` | 整数金额、共享工作去重、单价冲突、导出 |
| `src/models.ts` / `src/validation.ts` | 数据类型及输入结构检查 |
| `src/selection.ts` / `src/storage.ts` | 选择记忆、持久进度及写入失败提示 |
| `src/data-cache.ts` / `src/data-loader.ts` | OPFS / localStorage / 内存降级、hash 与流式字节进度 |
| `src/styles.css` / `src/workbench.css` / `src/loading.css` / `src/war-thunder.css` | 基础布局、加载画面、当前战雷主题与公共控件 |
| `scripts/prepare-data.mjs` / `scripts/check-data.mjs` | 生成元数据和 10 个国家文件、数据门禁 |
| `scripts/refresh.mjs` / `scripts/publish.py` | 显式刷新数据 / 发布构建及备份 |

### 接续工作约束

- 只用 pnpm。通常执行 `pnpm run typecheck`、`pnpm run lint`、`pnpm run format:check`、
  `pnpm run build`，构建已包含数据门禁；有实际数据更新需求时才执行全量 `refresh`。
- UI 与交互由用户手动验收；未收到明确请求时，不运行浏览器自动化或自动截图。
- 用户要求通过原静态页预览，开发服务器保持关闭；5178 端口当前未监听。
  不自动启动或遗留 Vite dev / preview 常驻进程。
- 界面沿用已确定的战雷风格与 finesse-ui 规范。图片仍直连官方 URL，不能改回本地图片副本。
- 不改掉购物车、载具进度、配件进度和选择记忆的原有存储键；精确键名见下文。
- 发布只影响本项目原 Muse 路径，保留旧 hash 文件，使用既有脚本先上传资源再切换 HTML。
- 本轮两项待办和载具简中名称均已实现；后续以本轮发布记录与语言映射覆盖报告为准。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm run dev                 # Vite + React Fast Refresh，0.0.0.0:5178
pnpm run typecheck           # TypeScript 7 tsc --noEmit
pnpm run lint                # Oxlint，包含 TS / React / a11y correctness
pnpm run format              # Oxfmt
```

固定版本见 `package.json` 和 `pnpm-lock.yaml`。开发服务只用于开发，正式站使用 Vite 静态产物。
UI 验收由用户手动完成，不运行浏览器自动化。

## 更新、核对与发布

```sh
pnpm run refresh             # 官方树、国旗、购买链接、载具 RP、等级门槛、配件 RP
pnpm run check:data          # 全树、前置、门槛与配件覆盖/金额检查
pnpm run lint
pnpm run release             # 重新准备 JSON、类型检查、Vite build，再发布
```

只更新配件或一辆车：

```sh
python3 scripts/modifications.py
python3 scripts/modifications.py --unit=germ_leopard_2a7v --force
pnpm run refresh:localization # 名称新增/变化后更新原版中文映射，再 check:data / build
```

上述更新使用有时间的本地缓存；不启动定时任务。请求失败保留已经核对的数据并让更新失败，
阻止误把失败采集当作新快照发布。`unavailable` 是“官方字段未提供”，不同于网络失败。
`data/modifications-report.json` 保留最近采集结果。

原 Muse `build.py` 兼容入口会调用此项目更新与构建；发布仍显式执行 `pnpm run publish`。
只替换该 Muse 页面，JS/CSS/JSON 先上传，最后原子切换 HTML；旧文件先备份到
`/vol1/1000/appdata/war-thunder-trees/backups/`。保留旧 hash 资源供尚未关闭的页面使用。

## JSON 数据

| 文件 | 内容 | 更新脚本 |
| --- | --- | --- |
| `data/catalog-settings.json` | 国家、军种、门槛配置类型、官方国旗地址模板 | 按官方新增国家维护 |
| `data/taxonomy.json` | 角色和获取方式的展示名称 | 维护标签映射 |
| `data/trees.json` | Rank、原始行列、折叠组、载具 ID/名称、前置、权重、GE 价格 | `scripts/trees.mjs --refresh --data-only` |
| `data/research.json` | 官方页首 Research 载具 RP，来源和时间 | `scripts/research.py` |
| `data/purchases.json` | 官方礼包 / 市场链接，来源和时间 | `scripts/purchases.py` |
| `data/planning.json` | 各国各军种各级购车门槛，来源和原文 SHA256 | `scripts/planning.py` |
| `data/flags.json` | 官方 SVG 国旗的在线 URL | `scripts/flags.py` |
| `data/modifications.json` | 每辆车配件总 RP、逐项成本、已解锁默认、来源/时间/SHA256 | `scripts/modifications.py` |
| `data/lineup-rules.json` | 队列槽位、国家码、Base62 字符与匹配规则来源 | 按官方规则维护 |
| `data/lineup-codebook.json` | 不重编号的每国载具分享码字典 | `scripts/lineup-codebook.mjs` |
| `data/localization.json` | 原版简体中文名称、固定版本、原文及缺失报告 | `scripts/localization.py` |
| `data/branding.json` | 官方 Logo、壁纸和字体的来源、处理方式、内容 hash | `scripts/branding.py` |

`schema/` 提供配件和购物车 JSON 结构。所有车辆相关数据均从这些 JSON 生成；
`src/models.ts` 定义前端类型，`scripts/check-data.mjs` 执行一致性检查。
`prepare-data.mjs` 将完整 catalog 写入仅用于构建检查的 `data/generated/catalog.json`，
不会将全十国完整车辆表发布到浏览器。公开数据按国家合并为带内容 hash 的
`src/generated/countries/country-{country}.{hash}.ts` 生成 JS 运输模块，构建输出十个独立的
`assets/country-{country}.{hash}.{build-hash}.js`。每个包含该国全部四类军种的科技树
（不存在的树为 `null`）和全部配件，不再按军种或配件拆文件。
`src/generated/bootstrap.json` 只有国家、军种、国旗、来源和可用性等导航元数据；
`src/generated/manifest.json` 使用 schemaVersion 3，每个国家直接对应文件描述，包含逻辑 key、
JS 模块源标识、规范 JSON 的 SHA256 和 UTF-8 字节数；国家 JSON 的 schemaVersion 为 2，包含 `country`、
`checkedAt`、`trees`（军种到树的映射）、`modifications`（载具 ID 到配件的映射）和
`lineupCodes`（该国两位载具码到 ID 的稳定映射）。
构建与发布检查十国文件的 hash、字节数、全部军种与配件归属，避免漏车。
更换源 JSON 后重新构建发布即可更新，不需要修改组件。

### 配件记录示例

```json
{
  "unitId": "germ_leopard_2a7v",
  "totalRp": 297100,
  "items": [{ "id": "new_tank_tracks", "name": "Tracks", "rp": 22000 }],
  "itemSumRp": 297100,
  "itemCostsComplete": true,
  "allUnlockedByDefault": false,
  "status": "verified",
  "source": "https://wiki.warthunder.com/unit/germ_leopard_2a7v",
  "checkedAt": "ISO-8601",
  "sha256": "official HTML content hash"
}
```

示例只截取一个配件，实际 `items` 包含该载具全部配件。`totalRp:null` 表示未知，不表示免费。
配件字段来自官方的 Total cost of modifications 和配件弹层 Research，
不读取 Research Aces、载具 Research 或 SL 购置费作为配件经验。
逐项求和无法与官方总额核对时，界面关闭逐项扣除，只允许按明确总额与已投入 RP 计算。
高级载具通常已解锁全部配件，`allUnlockedByDefault` 与原始总成本分别保存，默认待研 0。

门槛使用游戏配置公开镜像，非官方 API，界面保留来源、时间和手动修改。
科技树的所有前置只采用官方声明；不按 BR 或相邻位置发明关系。

## 速算与购物车

- 配件面板先选一辆车，可勾选已完成配件并填写其余已投入 RP；配件单价独立。
- 载具面板计算目标、前置及等级补位，可标记已有常规/金币/礼包/活动/联队车。
  只有已购买或领取的车才计入所在等级。补位为有效建议，不宣称全局最省。
- 手动选择“已开放等级 / 计价起点”后，低等级载具不进入报价，不改真实已有记录；
  同级及以上前置仍计算。未手动选择时，按真实已有记录自动计算。
  使用“这条线路已拥有到哪辆车”一次记录本线进度，会将该车及更早的实际前置记为已有，
  保留其他线路和特殊载具记录。只有确认目标在游戏内已可直接研发时，才使用
  “已可直接研发，只算目标”；该操作记录前置已拥有和目标等级开放，并清除指定补研项。
- 报价总经验、价格与购物车操作固定显示；等级核对、其他已有载具与修正设置默认收起。
  结果清单可直接勾选已有车，基础 RP 仅在选择修改或存在未知成本时展开输入框。
- 已有载具与补研偏好支持按 Rank 筛选，可与型号搜索、载具类型、已勾选条件组合使用；
  切换两个选项卡时保留等级选择，筛选只影响列表展示，不改变已有记录和报价依据。
- 普通折叠组各成员独立计数；联动防空系统的发射车归并控制车，不重复收费。
- 两种计算完成后均可加入购物车。相同报价不重复加入；同车配件新报价更新旧报价。
- 购物车存于 `wt-workbench-cart-v1`，按 JSON 快照保存报价依据、明细、成本、单价和数据时间。
  同国同军种同一载具的共享前置去重，取较大的待研 RP；不同单价冲突时暂停总价。
- 价格按实际待研 RP / 10000 × 单价，用整数分和 BigInt 统一四舍五入，不凑整万。
  购物车行金额显示只是分项参考，最终价按合并后的原始值统一舍入。
- 浏览器保存失败时明确提示，不会声称已加入。支持 JSON 导出和报价清单复制。
- 旧 `wt-planner-v1:*` 载具进度兼容；配件单车进度使用 `wt-mod-v1:*`，购物车互相独立。
  正式站同源，迁移不会主动清理旧数据；开发端口与正式站因不同 origin 不共享 localStorage。
- 报价是工作量估算，不含银狮、金币购车和乘员训练；购物车不会自动同步游戏账号进度。


## 战雷风格与加载流程

Logo、壁纸、ICO、国旗和载具图片均由浏览器直接读取官方在线地址，不经过本站图片代理，
也不从本站加载图片副本。Logo 使用 CSS 调整深色背景下的显示颜色，保留原版 SVG。
图标使用 `https://warthunder.com/i/favicons/favicon.ico`。
字体规范文件在 `src/assets/RobotoCondensed-Bold.ttf`，随 Vite 打包并使用相对 URL，保持同源读取。
来源、内容 hash 与交付方式记录于 `data/branding.json`；
`pnpm run refresh:branding` 使用 curl 检查在线素材并更新本地字体，
`scripts/flags.py` 检查国旗在线地址后写回 URL，不嵌入图片数据。

启动画面在 HTML 中直接显示官方 Logo 与壁纸。首次访问显示国家选择，不请求任何载具或配件
资料模块。选择国家后按需导入一份包含该国全部军种与配件的 JS 模块。
切换国家会忽略前一模块的加载结果；原生动态 import 已发起的网络请求不能强制中止。
同国内切换军种、打开或关闭配件面板不触发新请求。
模块加载期间显示不定进度，不伪造网络字节。完成后核对规范 JSON 的 UTF-8 字节数、SHA256 与结构。
脚本读取失败、数据不完整或解析失败会给出重试入口；本地购物车不受重试影响。
开发服务器保持关闭，正式预览仍使用原 Muse 地址。

### 选择记忆与浏览器缓存

- `wt-workbench-selection-v1` 保存上次选择的国家和军种；有效 URL 参数优先于本地记录。
  无有效记录时不预选国家，军种默认陆军；不存在的海军科技树显示空状态，使用已下载的该国资料。
- 数据优先写入 OPFS 的 `war-thunder-data-v1` 目录。不支持 OPFS、非安全上下文或读写受限时，
  自动使用 localStorage 的 `wt-data-cache-v1:*` 命名空间。
- 两者都不可写时仍可从网络加载并在本次页面内复用；界面会如实显示未持久保存。
- 每份缓存包含 schemaVersion、SHA256、字节数、原始 JSON 和访问时间。
  读取时验证内容 hash、字节数和国家/军种结构；损坏或版本不匹配则重新下载。
  同一国家的缓存覆盖旧版本；旧军种/配件缓存不再读取，可由原有数据缓存配额淘汰机制回收。OPFS 恢复可用时会迁移已验证的 localStorage 缓存。
- localStorage 配额不足时，仅按最久未访问顺序淘汰本页的数据缓存。
  不删除购物车、载具进度、配件进度、选择记忆或同域其他页面数据。
- 浏览器可能清理网站存储，缓存不是备份。数据更新后重新发布生成的新 manifest
  会使旧版本失效；无需用户手动清缓存。
