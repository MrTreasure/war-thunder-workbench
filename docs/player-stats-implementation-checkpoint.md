# 战绩功能实施记录

更新：2026-10-21；功能已接入，界面由用户手动验收。

## 已完成

- 独立服务 `../war-thunder-stats-service`，FastAPI 0.2.0，私网 8080；Postgres 独立库/角色，保存原始公开响应、规范化快照、缓存、查询、额度、报告与风控记录。
- 最低 7200 秒缓存；有效命中不扣次数；匿名每日 5 次新查询、1 次成功新战报，北京时间重置；失败退回预占额度。搜索和确认玩家属于同一查询意图。
- 双 Gaijin 账号均已连接，各自独立会话/签名/验证挑战，轮换调度。至少 7 秒/账号、全局 3.5 秒；上游限制会冷却，不换账号重试同一受限请求。
- 指纹签名票据、统一用户 PKCE 登录、独立应用令牌；登录免每日业务次数，仍接受请求频率保护。IP 检测、证据、到期封禁和手动解封入库。
- 真实 AI 已经本机通用服务调用成功，独立调用方 war-thunder-stats，nas-cpa / gpt-6-luna，备用 sensenova-6.8-flash-lite；仅发送同模式 Top 5 的事实，生成虚构二战司令授勋致辞。
- 原头像、等级、六维能力图，陆军对地 / 航空对空 / 海军对海 K/D 分别配对对应载具死亡数；单车分类 K/D 与综合 K/D 同时保留。
- 无正出击记录隐藏。效率按公开的 v2 公式计算，范围 0–2000，低于 50 场记 0；非官方评级，未知计数不补零。
- 载具累计银狮来自助手单车字段 10；非余额/净收入，最终游戏内对照仍待用户确认。
- 30 张有来源的战雷官方壁纸，军种/时代自动匹配，亦可手选；原生军种图标固定资源提交；玩家原头像用于生涯与战报。
- 主应用独立 `#/stats` 页面，可查询真实资料、选择候选、切换模式、预览、生成、查看历史和保存 PNG。旧 `/design/player-stats/preview.html` 转入新页面，不再发布样本数据。
- 战绩页面保持按需加载，不加载记忆国家的载具资料；科技树、地图、出击队列和已有本地记录保持原有行为。
- admin-console “战争雷霆 / 战雷战绩”管理页：两账号连接与同会话验证码、缓存时效、额度、IP 阈值、公开资料核对、封禁、查询/报告日志。
- API 经既有 Cloudflare API 域名和 Nginx；管理入口校验真实 `/api/session`，公开入口剥离私有管理头。官方登录资料只在进程内，未写数据库、文件或日志。
- PNG 使用有 CORS 许可的图片读取；必要图层失败会报错，不静默漏图。仅工作台目录放行所需可信图片连接域名，其他 render 应用策略不变。

## 实际核对

- ArthurDaynee：UID 241034055，等级 21，26 条有出击记录的载具/模式条目。
- starfall21740：UID 129393650，等级 100，739 条有出击记录的条目，含街机、历史、全真。
- 有效缓存查询后匿名查询 used=0/reserved=0。
- 真实 AI 报告已完成，Top 5 均返回累计银狮；生成成功后报告 used=1/reserved=0。此前一次上游生成失败的额度已退回。
- 官方背景、logo、原头像读取成功且带允许的 CORS；原生陆空海图标及官方载具图可访问。一次载具源站连接超时后再次请求恢复，导出已增加直读/服务端备用与超时。
- `pnpm run check`、`pnpm run build`通过；10 个国家 JS 载荷哈希一致，产物无独立 JSON。独立服务 Python 编译与容器健康通过。管理页从独立干净版本类型检查/构建通过，静态资源上传后逐项核对哈希/CORS。
- 未运行浏览器自动化或界面截图；真实浏览器的登录、图片下载、手机布局由用户验收。

## 预览和版本

- 应用：<https://render.mrtreasure.cc/muse/war-thunder-trees/#/stats>
- 管理：<https://orbit.mrtreasure.cc/war-thunder>
- 外部 API：<https://api.mrtreasure.cc/wt-stats/v1>
- 管理页 Git：a7ab697；独立服务 Git：5e73dc8；统一用户应用登记：675817f。
- 本轮不做 QMuse 导入或 GitHub 推送，等待预览确认。

## 运维边界

凭据只按密码本原键读取：gaijin 为两个对象的数组；服务配置位于 services.war_thunder_stats，AI 令牌位于 services.c137_ai_gateway.tokens.war-thunder-stats。不复制值。

成功会话的 JWT、签名私钥、设备标识以 AES-256-GCM 加密存于独立 sessions 运行目录；密钥仅从密码本 services.war_thunder_stats.session_encryption_key 注入，重启自动恢复。密码与待验证挑战不写入会话文件；验证码应提交给当次挑战，不能重新发起登录。数据库故障时使用有界公开结果恢复日志，恢复前不伪装成功。

后台原工作目录还有其他未完成修改，本次仅提交管理组件及入口，使用独立 Git 工作目录构建发布。未覆盖其他工作文件。

## 国家与兵种筛选补充

- 战报生成区独立选择国家和五类兵种，默认全部。服务端先筛选再选 Top 5；范围同时进入预览、AI 事实、报告存档、幂等校验和缓存键。旧战报按全部范围读取。
- 屏幕战报、历史列表及 PNG 都显示范围；筛选预览不扣次。无匹配出击记录提示调整筛选，生成按钮不可提交；新的范围需单独生成 AI 致辞并遵守原有每日额度。
- 地图列表缩略图、详情原帖和旧版合集均新标签页打开，保留当前列表或画图页面。
- 实际接口核对：中国陆军、美国空军均得到范围内的五辆载具；全部范围正常；无记录范围返回 NO_SORTIES；前后报告额度相同，命中缓存的查询额度仍为 0。
- 服务端版本 31ec611 已加载，账号二已连接；账号一正在等待本次邮箱验证码，保持同一验证会话。缓存与账号二可继续服务。

## 战报交互和呈现更新

- 登录移至共享顶部，文字下划线；缓存提示合并到资料时间行，昵称缓存在本机且不自动重新查询。
- 取消自动请求战报预览。先选范围/背景，点击生成，数据与 AI 完成后一起展示。
- 战报增加同模式生涯场次、K/D、效率评分、胜率及分军种 K/D；Top 5 保持国家/兵种范围，图表显示所列载具效率和已知击毁构成，不混作总生涯。
- 自选背景仅本页面内处理，限制 JPG/PNG/WebP 和大小/像素，颜色提取与图表数据供 HTML/SVG 与 Canvas PNG 共用。
- 致辞改为自然短句，减少数字和车型罗列；真实管理员任务已生成成功并入库，不消耗访客额度。
- 后端增加任务私有写作上下文，后续更新措辞无需断开官方查询；当前账号二正常，账号一待新验证码。
- 近期逐场未接通，核查记录见 player-stats-recent-matches.md；AI 不会编造近期走势。

## 导出图片来源标识

走线图 PNG 与战报 PNG 最终编码前统一写入 mrtreasure.cc：PNG 蓝色位平面文字显影，以及带重复/纠错的亮度频域来源编号。配套脚本 scripts/reveal-watermark.py 可供 Agent/用户提取；参数与实测边界在 docs/export-watermark.md。原始地图/背景、编辑文档和本地方案不改写。

两个实际图片样本的原始 PNG 与 JPEG q3/q5 完整检出，未写入对照未检出；更重 q10/q15 失败，未承诺任意压缩或仅 Agent 可读。生成屏幕的低可见度文字层不等同于导出像素的可靠检测。

## 2026-10-21：账户菜单、角色与银狮

- 点击页头用户名展开退出；登录页底部显示“暂未开放注册”。
- 每日查询/战报额度按游客、普通用户、全局超管分别配置，支持 0 和不限次。默认游客 5/1，普通用户及超管不限次；缓存免费、失败退回，未改动 IP 侦测。
- 统一身份服务增加每应用独立的普通用户/应用管理员角色及允许/禁止访问。全局超管身份另行管理；应用管理员无法登录 Orbit。会话每次重新核验，不依赖浏览器自报身份。
- 银狮按四位分组，例如 2617,9505；表格、战报和 PNG 使用同一格式及游戏原生 warpoints 图标。PNG 继续写入来源水印。

## 紧凑战报与分析风格

- 图表使用横向效率条与击毁比例条，保留可读数值与表格备选。Top5合并标题/效率与战斗/KD/累计银狮，屏幕与PNG均缩短留白。数据说明改为范围提示、权重、K/D对照与可展开公式。
- 司令致辞、战斗数据分析、犀利评价、自定义四种服务端允许风格；未知旧战报默认司令。风格与规范化偏好参与幂等校验、缓存身份和已存战报，切换配置不会自动生成。
- 自定义最多160字，NFKC规范化，限制不可见控制字符、URL/HTML、角色分隔与明显越权要求；在额度预留前拒绝。固定系统边界+可信风格指令，玩家资料与偏好只在独立的用户JSON消息中传入。AI不挂工具、不接收用户端点/模型/系统提示，不接触官方凭证。
- 输出仅接受title/speech短文本，限制长度、控制字符、链接/HTML及明显辱骂；不合格生成失败并退还额度。角色额度、IP保护继续生效，同一调用身份同时只能生成一份新战报。过滤是多层防护的一部分，不声明能阻止所有语义注入或保证每句AI分析准确。
- 安全设计参考[OWASP Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)。

## 生涯区域收紧与毒舌风格

- 生涯左侧按军种/KD与各国拥有/精英排列成紧凑记录；桌面左右面板随内容等高，雷达保持原比例；移动端自然堆叠，窄屏国家记录分两行，不截断数值。
- 精英字段原义保留，仅调整颜色与装饰。金鹰使用固定版本的原生 `item_type_eagles.svg`，文字/数量颜色取SVG的 `#fdc85d`，未知数量仍为“—”。不把数量当作售价或金币余额。
- 犀利评价强化反问、冷嘲与真实数据反差，去掉刻意鼓励和找补；继续限制攻击现实身份、辱骂、虚构对局与无依据的意图判断。风格指令变化参与缓存身份；只在新生成时生效，不改已存历史评价。无需重启官方查询会话。

## 2026-10-22：排行榜首页、查询缓存与返回

- 删除两个固定测试玩家入口，战绩首页展示官方街机/历史/全真 × 地面/空中目标累计击毁榜各前25名，点击昵称才发起查询。官网没有独立陆战/空战匹配榜，页面明确注明目标击毁口径。
- `data/player-leaderboards.json` 保存六个榜单、原始分页链接及各自采集时间，按战绩页面懒加载为JS。`pnpm run refresh:leaderboards` 串行请求官方两页、请求间隔7秒；模式、排序及连续25名均校验，失败保留对应旧榜及采集时间。该命令不发布；当前没有自动定时刷新。
- 数据门禁校验六榜完整性、排名、昵称、来源与统计口径。主页注明榜单快照非实时，并链接官方原榜。
- 增加“返回战绩首页”，从资料、候选及查询中均可返回；取消尚未完成的前端请求，清除初始玩家深链参数。
- `wt-stats-query-history-v1` 独立本机缓存最近8名已成功查询的玩家资料，上限约200万字符。点击直接显示原采集时间与本机缓存提示，可显式刷新；清空只删除该历史键，不动其他存储。写入失败不淘汰其他用户数据。
- 地图卡片恢复当前标签页进入独立详情路由，保留列表搜索与过滤；下方关联攻略继续新标签页打开。此项替代上文“地图列表缩略图新标签页打开”的旧规则。
- `pnpm run check` 与 `pnpm run build` 均通过，六榜合计150个名次记录，10国JS载荷哈希通过，无独立JSON输出。未使用浏览器自动化，界面待手动验收。

## 2026-10-22：按需账号估值

- 玩家名称旁增加“计算账号估值”，点击前不请求估值。独立服务端 `valuation` 额度按游客/普通用户/全局超管配置，默认1/不限/不限；0禁用新计算，有效估值缓存免费，失败退还预占。同身份串行计算，结果与额度结算同一事务落库；必须有服务端资料访问权限，不信任客户端载具/金额。
- `data/account-valuation-rules.json` 保存189元/5000GE、正常/折扣/二手的研发点单价和100%/50%/30%购入比例。正常和折扣RP为陆战/直升机3元、航空2元每万；二手为1.5/1元。海军暂未配置单价，不补零。
- `pnpm run prepare:valuation` 从当前canonical研发树、RP、购买链接和官方CNY原价生成独立服务metadata。沿明确前置链推算，跨模式/同一前置/别名去重；不臆造Rank门槛购买历史，不从金鹰/礼包/市场载具反推整线，不计改装。联队载具只计算自身已知RP。
- 同礼包多个出战载具仅计一次整包原价，日期与来源保留；金鹰按总GE汇总换算，金额使用Python任意精度整数分，前端使用BigInt格式化；每个场景的RP、GE、礼包各汇总后四舍五入到分。
- 弹窗列出三档价值、研发/GE/礼包分项、全部对应载具、研发前置、未核价条目、资料及报价日期，注明仅供参考。外层显示正常价值；存在未核价人民币项目时明确“部分”，完整总价保持null，不将未知价格视作0。
- 市场特殊载具优先分类，GJN均价单独汇总，不计人民币总价。141个允许的市场载具目录预置入独立Postgres表。最初未带认证的请求返回TOKEN_REQUIRED；后续已实测现有账号二的加密助手JWT可直接读取官方市场行情，无需重新登录。真实均价由独立串行刷新脚本维护，缺少统计窗口内成交时保持null/保留旧报价。后台仍可维护已核验均价、核验时间、样本量和口径；不填示例/猜测价格，不修改官方来源链接。
- 估值使用已查询的历史快照，记录采集/计算时间，不表示完整持有、实际投入或可成交价格。原有查询、战报额度和本地研究/队列/地图存储保持原键与行为。
- 本次独立版本：前台 `bda0e06`，服务 `9fba770`，后台 `92ff94a`。为避免发布工作区中的其他草稿，前台/后台从独立worktree完成检查构建；前台已按既有publish流程发布，线上HTML哈希与checked build一致，后台CDN资源与HTML也已核验。没有QMuse导入。
- 服务运行于 `/vol1/1000/appdata/war-thunder-stats-service/releases/9fba770` 的已提交代码/data/migrations只读挂载，保留原Postgres与加密官方会话目录。该release的公开代码目录/文件显式赋予容器用户读取权限；未改任何密钥。后续服务发布请明确核对compose来源，勿假定仍挂载canonical工作目录。
- 验证：独立版本 `pnpm run check`、`pnpm run build`，后台typecheck/build及服务Python编译均通过。实际资料试算与共享前置、重复模式、整包去重、三档公式、未知RP检查通过；完整当前图无自引用/缺失前置/循环。HTTP验证新估值只扣valuation、同结果缓存免费、查询/战报额度不变、0额度阻止新计算、未授权snapshot和公开管理访问被拒绝；验证专用actor/额度记录已清理。容器healthy，官方助手会话恢复正常。界面仍由用户手动验收，未用浏览器自动化。

## 2026-10-22：估值卡片与公开已拥有清单

- 返回战绩首页移至搜索表单最后一个按钮（type=button），手机同样保持与搜索在一行；缓存说明在窄屏移至下一行。外层计算前后统一“账号估值”文案，内部三档名称保持不变。
- 金鹰/礼包/市场特殊载具改为图片商品卡片，显示来源、原价/均价、日期和样本信息；礼包多车共享一张整包卡片，不拆分车价。研发明细改为带官方缩略图的紧凑卡片，展开后再挂载，图像使用canonical官方HTTPS模板，不取本地或生成图片。
- 已验证可复用现有账号二JWT读取官方 `ano_get_public_userstat`。BLK的 `aircrafts` 成员清单与 `unitsPerCountry` 数量逐国核对，状态0/1/2均是拥有清单成员，2为精英。ArthurDaynee实测126辆，其中43辆中国载具，中系T-34-85明确存在、没有出战记录，已按canonical 33000RP计入；不将未出战补成0场战绩。
- 新估值优先按已核验拥有ID去重汇总，不再对这份完整清单额外增加未持有的当前前置；接口失败时标明按出战记录推算。车库只在显式计算时读取/缓存，与现有查询池共享频控，不额外扣查询额度，独立估值额度保持原规则。本地科技树拥有状态不自动更改。
- 真实市场均价首轮已完成：141项中139项取得近30完整UTC日成交量加权日行情均价，2项无窗口内成交保持null；原始公开行情hash、样本、窗口和日期随数据库事件保留。更新脚本仅复用加密会话，无重新登录或交易。
- 已部署验证：前台 `d241277` 独立worktree运行 `pnpm run check` / `pnpm run build` 通过；服务运行于只读release `def7c07`，解析器镜像内校验安装成功，Python编译通过。实际HTTP估值返回ownedCount=126/unplayedCount=105，T-34-85为owned且未出战、33000RP；再次计算免费缓存、独立估值额度used=1/reserved=0，查询/战报额度不变。车库表不保存slots/unlocks等额外字段，验证actor记录已清理。未使用浏览器自动化，未进行QMuse导入。


## 2026-10-22 compact valuation and owned-vehicle import

- Product cards use four compact desktop columns and shorter official artwork. The upper-right donut summarizes known normal CNY RP/GE/pack values, including zero/partial states; market GJN stays separate.
- Research detail filters compose country/category/rank using canonical metadata. Unknown rank remains explicit.
- Research quote calculators can search/select a player and explicitly import the verified public garage for the current country/category, including unplayed vehicles. Search uses existing query quota; each successful import uses one valuation quota even if garage cache is reused. Failures release reservations; retries reuse the request ID.
- Manual ownership remains in `Profile.owned`; optional `Profile.ownedImport` stores imported IDs and provenance in the existing country/category local profile. Calculations use a deduplicated union. Clearing import retains manual selections; reset clears both. Import restores automatic rank calculation and clears prior target partial RP to avoid applying another player's progress.
- No cloud user-state persistence or QMuse import was added. Preview remains the existing Nginx route.
