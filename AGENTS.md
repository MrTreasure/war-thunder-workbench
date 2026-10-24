# War Thunder Workbench

## Wiki 数据资源更新（2026-10-24 用户确认）

- 科技树资料允许发布到既有 Git 图床，固定入口 `war-thunder/catalog/manifest.js`，各国数据文件名包含内容哈希。通过公共版本索引取得完整提交 ID，校验字节数、SHA-256、国家及 schema，按文本解析固定 JSON 字面量，不执行远程 JavaScript。保留本地国家模块和已验证缓存作为回退，canonical 数据仍在 data/*.json。
- 后台管理员手动采集 Wiki 当前值并点击更新资料；后续资料发布不重复部署页面，不创建自动同步任务。计划表不直接覆盖现行值，新增及结构冲突保留待核对。
- 载具详情增加基础资料、获取与价格，以及 RP/银狮获取百分比；配件信息继续在配件研发中展示。匿名读取公开 Wiki，不携带用户登录态；串行请求至少间隔 6 秒，遇限流、登录或验证停止。来源倍率与玩家作战效率评分分别保存，未知不补零。

## 指令文件与站点约定（2026-10-23 更新）

- 本文件 `AGENTS.md` 是 Codex 的唯一项目指令入口；原 `AGENT.md` 规则已合并到本文件，不再维护第二份指令。`AGENT.md` 不得提交或上传，必须保持 Git 忽略。
- 正式站：`https://render.qmuse.pub/p/muse/8645013411493394`，只更新既有 QMuse 应用。
- 国际站：`https://wt.mrtreasure.cc/`，部署独立 Workers Static Assets，Worker 保持 `war-thunder-workbench` 原名。
- 禁止访问、部署、预览、重定向或新增链接到域名 `render.mrtreasure.cc`，包括任何子路径。上级或历史文档中的旧 Render 发布指令不适用于本项目。
- `deploy:qmuse` 用于正式站；`deploy:cf` 用于国际站。禁止运行旧 `deploy:preview`、`publish`、`release` 及共享 Render 发布流程；不得将其当作正式站或国际站的发布步骤。
- 验收使用用户明确授权的 QMuse 或国际站部署；尚未发布的本地构建不能宣称已在线。发布前保留构建、Git 版本及必要回滚材料。
- 国际站 SEO canonical 与 Web Analytics 继续对应 wt 域名；后台“页面分析”保持直达该站统计。
- 国际站发布使用 `feat/seo-localized-pages` 的多语言工作区，合并 main 后补充英、俄、日文案，不得以中文 main 构建覆盖国际站。
- 2026-10-24 QMuse 90800278 被平台自动审核以「未声明 WASM」拒绝；官方 CLI 1.0.7 的源码清单已含既有 911 字节本地资产及 SHA。保留上一线上版，需核对平台正式声明规范或由平台复核；不得隐藏 WebAssembly 调用、伪装文件或绕过审核。
- 旧 `../war-thunder-trees/` 和 NAS Muse 目录仅作历史存档，不是发布目标。

## 项目实现约束

- React + Vite + TypeScript 7, using the supplied QMuse template configuration,
  TanStack file routes and Tailwind v4. Use pnpm and keep exact dependency versions.
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:data`, and
  `pnpm run build` for routine verification. UI acceptance is manual;
  do not use browser automation unless the user requests it.
- All vehicle-specific data, prices, prerequisites, ranks, BR, flags,
  modification costs and provenance belong in `data/*.json`, not JSX.
- Pack prices use verified official CNY amounts in integer cents from
  `data/store-prices.json`, joined through existing purchase links. Keep GE
  prices separate. Display the whole pack price and its check date, not an
  inferred single-vehicle price. Missing quotes remain null, never zero.
  Refresh failures preserve prior price records and their provenance timestamps.
- Never infer unknown RP as zero. Zero can be derived for a missing item
  only if known nonnegative costs already sum to the verified official total;
  record that derivation in `rpBasis`.
- Keep premium modifications already-unlocked defaults separate from the
  Wiki's raw full modification cost. A raw cost is not outstanding account RP.
- Monetary arithmetic uses integer cents and BigInt. Cart shared vehicle
  prerequisites are deduplicated, conflicting rates block the final price.
- Keep the `wt-planner-v1:*` localStorage keys compatible during migration.
- Initial rendering must not fetch vehicle or modification data. Load only the
  selected country file, including all categories and modifications. Switching
  categories or opening modifications must not fetch additional data.
- Include all five categories: ground, aviation, helicopters, ships and boats.
  Helicopters use their own tree and Helicopter rank gates; keep their game
  Simplified Chinese names and append their share codes without renumbering.
- Prefer OPFS for verified JSON caches and fall back to localStorage. Cache quota
  eviction may only remove `wt-data-cache-v1:*` entries, never carts or profiles.
- Keep source JSON canonical. `data/generated/catalog.json` is a private build
  validation output; publish one hashed lazy JS module per country. Canonical
  data and verified cache bodies remain JSON; never publish standalone JSON files.
- Images and the favicon must use their original official HTTPS URLs, not local
  copies or embedded flag data. Keep the font same-origin under the existing CSP.
- `pnpm run refresh` updates JSON; it must not publish. Build and publish only
  after the data gate succeeds. Preserve provenance timestamps on failed requests.
- Publish only the existing QMuse application or independent international Worker according to user authorization. For Cloudflare deployment, follow asset-before-HTML ordering, preserve old hashed assets for open sessions and back up entry files. Shared deployment documentation must not override the site restrictions above.

- Sortie lineups use country-scoped `wt-lineups-v1:*` storage. Never evict these
  with data caches. Share codes are case-sensitive, 24 characters: two country
  characters plus eleven two-character vehicle slots, with `00` for empties.
- `data/lineup-codebook.json` is append-only. Never sort IDs and regenerate codes,
  renumber existing entries, reuse retired entries, or change established prefixes.
  Publish each country's registry inside its existing country module only.
- Queue BR uses context-specific aircraft ratings (`trb` for Ground RB), excludes
  aircraft from Ground AB, and filters over-limit aircraft in Naval AB/RB. Ground
  SB uses event lists and Air SB room ranges; do not invent a numeric SB queue BR.
- Ground RB mixed lineups include helicopters using their RB rating. Ground AB,
  fixed-wing Air and Naval calculations exclude helicopters. Do not infer
  helicopter PVE/event matchmaking from a Ground lineup rating.

- Lineups have a dedicated `#/lineups` page under the existing Muse entry; `#/tree`
  returns to the research tree. Keep deep links, refresh and back/forward working.
- Crew slots stay in one horizontal nonwrapping strip, with long-press pointer
  reordering and a keyboard alternative. Rank filtering composes with category
  and search. Preserve the existing lineup storage and share-code order.

- Keep lineup import behind a dialog button. Render exported share codes as
  selectable text with a copy action, not as permanent input fields.

- Use `@qmuse/vite-config` as the single Vite plugin configuration; do not add
  duplicate React, Tailwind or TanStack Router plugins. Keep dependencies exact.
- Routes are declared in `src/routes/`, with generated `src/routeTree.gen.ts`.
  `WorkbenchProvider` holds country loading and shared state across pages.
  Preserve TanStack history state when synchronizing legacy outer query params.
- `src/styles.css` is the template/Tailwind entry, `src/workbench.css` contains
  existing workbench rules. Keep legacy localStorage/OPFS and RP behavior.
- Place `CreatorLink` in the top-right header of both research-tree and lineup
  pages. Use the supplied QMuse logo and invite link; do not duplicate it in the
  explanatory row or a separate footer. Keep it responsive without horizontal overflow.
- All pages share `PageNavigation` for 科技树 / 出击队列 / 陆战地图. Keep this navigation
  outside the tree's collapsible filter panel on every screen size. Categories
  are filters, not page links. Use menu.csv's mainmenu/* Simplified Chinese
  entries for category labels, with localization provenance in canonical JSON.
- Render `AppHeader` once in the shared `_workbench` route, outside the Outlet.
  The title is 研发工作台. Keep the shared account control at the right edge on every
  page, including map editing. `WorkbenchAccountProvider` owns existing stats
  login/session state, popup callbacks and cross-tab updates; page components
  must not portal their own login control into the header.
  Its identity, dimensions and creator link stay identical across pages. Desktop
  shows page links; mobile uses a native page select in the top header. Keep
  the shared content scroll frame and its TanStack scroll restoration ID stable.
  `app-header.css` owns shell/header geometry; page shells inherit the remaining
  height rather than adding another 100dvh. Wiki provenance stays in tree content.
- Keep `.qmuse/project.json` managed by qmuse-cli; update the bound application
  with `qmuse-cli import .`, never manually change its platform binding.
  Generated bootstrap/manifest, `src/generated/country-modules.ts` and all ten
  `src/generated/countries/*.ts` transport modules must be included in uploads.
  Private `data/generated/` stays excluded. Do not assemble paths using BASE_URL.
- Run `pnpm run check` and `pnpm run build` before QMuse import. Use pnpm even
  where the template's upstream documentation suggests another package manager.
- Before adding QMuse cloud persistence/auth/schema/services, read the bundled
  `.agents/skills/qmuse-cloud/SKILL.md`. Existing local user state stays local.

- Current delivery flow: build a reviewable preview and create a Git version first.
  Do not run further QMuse imports until the user explicitly confirms the preview.

- All workbench CSS custom properties use `--wt-*` to avoid template/Tailwind
  `--muted` and `--accent` collisions. The bundled font uses a relative asset URL.
- Country modules dynamically import canonical JSON text only after selection.
  Keep SHA256, byte-length and schema checks before caching/using that text.
  Loading is indeterminate while native import runs; never fake byte progress.
- `scripts/check-build.mjs` verifies all ten emitted JS payload hashes and blocks
  standalone JSON output. It runs after build and before static publication.

- Center `.canvas-space` horizontally with auto inline margins whenever it fits
  the scroll viewport; retain accessible overflow for wider or zoomed trees.
- All native `.calculator` dialogs explicitly use fixed inset zero and auto
  margins, independent of Tailwind resets. Content-sized variants use fit-content.
- Vehicle details use the shared centered Modal, with a larger responsive layout
  and the title as the official Wiki link. Keep nested image/quote dialogs usable.
- The research explanatory footer lives after the canvas inside `.viewport`,
  so it appears at the end of the tree scroll rather than remaining on screen.

- The lineup page defaults to saved lineup summaries, not the vehicle picker.
  Each saved lineup has a share action next to its title; display the code and
  attempt clipboard copy. Keep rank/category/type filters inside configuration.
- New and edited lineups use local drafts. Persist only on explicit save;
  cancellation must preserve existing saved entries. Confirmed imports return
  to the saved list. Keep legacy lineup keys, IDs, share slots and codebook stable.
- Keep lineup header and content aligned in a centered 1560px container. Country,
  card BR mode and import share one compact toolbar; empty saved lists have one
  create action. Saved cards keep sharing beside the title and editing/deletion
  below the crew strip. Mobile picker filters collapse independently of page
  navigation, with their active settings visible and search always available.

- Mobile layout overrides live in `src/mobile.css`, imported after all workbench styles.
  Tree controls share one DOM and collapse behind an accessible toggle at <=800px
  (<=1100px on coarse pointers). Keep the selected country/category/mode visible
  in the collapsed summary, and preserve search/Escape focus behavior.
- Mobile calculators use one vertical scroller and a reachable close button;
  inputs are at least 16px and common action targets at least 44px. Keep lineup
  crew strips nonwrapping and preserve draft/save/share behavior.

- Preview acceptance uses the authorized site listed above. QMuse import requires explicit user authorization; do not invoke legacy preview publishing.
- Keep HTML revalidated/no-store as appropriate and hashed JS/CSS/font/country assets immutable. Preserve old hashes on publication.
- Keep the lightweight file-route adapters eager with `codeSplitGroupings: []`
  to avoid a serial startup waterfall. Country payload imports must remain lazy.

- Ground maps are public in desktop navigation and the mobile page dropdown.
  Allow direct access to `#/maps` and `#/maps/$mapId` without any outer query
  flag. Keep old root `?guides=1` links opening maps for compatibility; the
  normal root continues to open the research tree.
- Guide summaries, CDN image metadata, sources and collection audit live in
  `data/map-atlas.json`; load them with the guide component only after entry.
  Publish them as JS, never a separate JSON file. Opening guides must not load
  a remembered country's vehicle payload.
- `pnpm run refresh:guides` uses Playwright to extract the original atlas and
  inspect the public author collection. Visits are serial, at least 6 seconds
  apart (7 seconds by default), with a 6-hour snapshot cooldown, bounded scrolling
  and no automatic bulk article/image downloads. Preserve prior data on failed
  or incomplete collection responses. Keep raw page/article captures in ignored
  `artifacts/`, not published data. Preserve summary verification dates separately
  from collection checks and article edits.
- Map images retain their supplied HTTPS CDN URLs. Thumbnails load in the guide
  page; full images load only on explicit open, with byte/hash checks and isolated
  `wt-map-atlas-v1` OPFS caching. Clearing map images must never touch vehicle
  caches, profiles, carts, lineup storage or the share registry.
- Additional author collections use `data/map-collection-settings.json` and
  `data/map-collections.json`. Keep archive articles separate from current
  guide notes and image numbering. Preserve complete per-collection directories,
  timestamps, category labels and individual body verification status. The
  collection script serializes pagination/article API calls at >=7s (8s default),
  reuses snapshots for 6h, stops on captcha/login/HTTP rate limits and pauses
  body checks for 24h after a verification challenge; never retry around it.
- Before resuming archive body checks, read `docs/guide-collection-checkpoint.md`
  and the persisted `articleRetryAfter`; update the checkpoint after continuation.

- Public `#/maps` displays the ground-map atlas. Canonical map metadata
  lives in `data/ground-maps.json`; keep the page lazy and do not load country data.
  User-provided map imagery is an exception to the official-image rule: archive it in
  the existing GitHub `MrTreasure/oss-files` image repository, pin full commit IDs
  in raw/CDN URLs and keep the existing R2 addresses as fallback sources.
  Keep raw exports and contour-coordinate JSON out of Git and QMuse uploads.
- Ground-map base, contour SVG and briefing points share the original normalized
  coordinate system after projection. Original textures have +worldZ towards the
  top: canonical point v=(maxZ-worldZ)/(maxZ-minZ); reflect source crops likewise.
  Source contour SVGs still use +Z-down; reflect that image layer exactly once
  using the shared `ground-map-projection.ts` matrix in SVG and PNG export.
  Keep base textures, icons, letters and existing user annotations unreflected.
  DOM composites in the original upload share the wrong projection; rebuild their
  77 matching layouts from the original terrain and native point icons, retain
  original DOM hashes, and never reuse the wrong composites as image fallbacks.
  Mission cropping clips the map layer only; it must never clip custom annotations. Reference
  grids are not verified runtime grids; world Y is not verified sea-level height.
  Guide links must disclose layout/version differences; preserve old guide data.

- Ground-map details use the public independent `#/maps/$mapId` route, without an
  outer query gate. Preserve old `#/maps?map=...&side=...` links by redirecting.
  Treat all `/maps/` paths as maps in the shared header/provider so they never
  start loading vehicle data. Keep list query/guide filters in route search for
  back/forward and return links. Ground-map details must not use a modal dialog.
- Ground-map detail identity, return link and controls share one compact toolbar.
  Desktop `.ground-workspace` fills the viewport below the persistent app header;
  the map takes the remaining grid row with no fixed 780px height cap. Keep
  legends and related guides after the workspace in the normal page scroller.

- Ground-map route editing uses SVG annotations and Canvas PNG export. Keep
  annotation coordinates in full-map normalized UV space, independent of crop,
  pan and zoom. Original mission marks and contours remain read-only layers.
- Editor drafts use isolated `wt-map-editor-v1:<map>:<layout>:<team>` keys. Never
  evict them with data caches or touch carts, lineups or research state. Finish
  pending strokes before changing layout/team; preserve undo/redo per context.
- `data/map-editor-icons.json` is the allowlisted registry of original game SVG
  icons in the existing `oss-files` image repository. Preserve original files;
  standalone compatibility derivatives may add missing namespace/viewBox root
  metadata while preserving drawing geometry, with source SHA and normalization
  recorded in the registry. Keep
  asset commits pinned and stable icon IDs for saved drafts. Never import image
  URLs, HTML or executable content from user project files.
- Editable `.wtmap.json` downloads are user-generated documents, not published
  standalone JSON assets. Validate schema, map/layout/team, IDs, finite geometry,
  text and point limits before importing; confirm replacement of a target draft.
- PNG export must use CORS-approved Image loads and report errors rather than
  silently omitting failed layers. Keep cancellation, 2K/4K options, source
  fallbacks and the original map/annotation coordinate projection aligned.
- Run `pnpm run check:map-editor` with the routine verification gate. Editing is
  immersive below the persistent application header: reserve fixed tracks for the
  main tool rail, canvas and status. Secondary tools/properties are dismissible floating
  panels on desktop and mobile. Opening, closing or switching a panel must not
  resize the SVG, change the camera or move the map; do not allocate a panel grid
  column/row. Mobile panels float above the bottom tool dock.
- Keep the main map tool rail to select, pan, tactical lines, pen, shapes, markers
  and text. Straight/curved lines, arrows and defense presets live in the tactical
  floating panel. Danger regions live in shapes; sniper markers live in markers.
  Keep creation, direct point editing, undo and saved geometry compatible.
- Lines/arrows complete on drag release (or a start/end click pair) and become
  selected immediately. Drag endpoints to edit, drag hollow midpoint handles to
  insert bends; support deleting bends and keyboard/numeric point editing. Do not
  restore the multi-click route plus distant confirmation workflow. Preserve
  project version 1 and existing path geometry; one completed drag is one undo.
- Editor palette defaults live in `data/map-editor-palette.json`; keep original
  game asset colors and existing theme colors identified separately. Selection
  handles use screen-sized targets, independent of map zoom and viewport size.

- The map is one layer on a larger drawing canvas. The map/layout frame alone
  clips terrain, contours and native marks; the annotation host must be a sibling
  outside that clip. Draw and select over the entire canvas, including blank areas.
  Canvas coordinates may extend beyond map-relative 0–1 (bounded finite -32–32).
  Pan/zoom changes the canvas camera, not annotation coordinates. The map retains
  its aspect ratio and never stretches to fill the viewport. PNG export shares
  the camera, map-only clip and outside-map annotation positions.
- Main editor toolbar has one-click clear of all custom annotations in the current
  context, including hidden/locked entries, with undo. Do not require a confirmation
  dialog for this reversible action; do not remove the map or native mission data.
- Map annotations include optional smooth-curve and tactical line styles plus
  rectangle/ellipse/polygon areas. Keep legacy version-1 paths importable.
  Shared geometry in `map-editor-model.ts` drives SVG and Canvas export, including
  curve midpoints, arrow tangents, defensive/obstacle marks and area hatching.
  Validate area sizes, opacity, captions and point limits before storing/importing.
- Tactical line presets are illustrative, not certified military symbology.
  `data/map-editor-symbols.json` contains project-drawn tactical marker geometry,
  displayed separately from the original game icon library. The same trusted
  symbol registry drives SVG, PNG export and import ID validation. Do not claim
  these are official game icons or accept arbitrary URLs/geometry from imports.
- Map editor confirmation/import dialogs use content height, centered fixed inset
  and bounded vertical scrolling on desktop and mobile; never inherit the full
  research calculator height.

- Military line presets carry their research sources in `data/map-editor-lines.json`.
  FORTL-inspired defense uses rectangular teeth with default ally green; distinguish
  scalloped front lines, triangular antitank teeth, obstacles and hollow advance
  arrows. Share body/decoration geometry across live SVG, picker previews and PNG.
  Preserve legacy paths; validate new style/head/flip fields and finite extended coordinates.

- Hollow advance-arrow outlines follow a joined/rounded centerline with continuous
  offset normals. Do not offset separate segments independently across corners;
  this causes returning inner spurs and abrupt outer joins. Preserve straight-line
  width when redundant or duplicate anchors are present; use the same path for
  SVG previews, live annotations and PNG export.

- Use `GameSelect` for shared game-themed dropdowns, including expanded options.
  Preserve grouped/disabled choices, numeric value conversions and keyboard access.
  Menus use the Popover top layer inside their owning native dialog when present;
  do not replace them with browser-native option menus or body portals behind dialogs.
- Selecting an annotation or finishing a new one opens its floating properties.
  Keep the close control visually compact and never resize the canvas for the panel.

- Named map plans and their working drafts live only in the dedicated OPFS
  `wt-map-plans-v1` directory, scoped by map/layout/team. Migrate legacy
  `wt-map-editor-v1:*` localStorage drafts into the default plan once, retaining
  the original keys. Do not put new named plans in localStorage or evict them as
  cached data. Serialize writes, commit through createWritable/close, and use
  Web Locks plus fresh reads to preserve changes from other tabs. Report quota,
  corruption or unsupported OPFS without overwriting the previous file.
- Finish and save before switching plans or routes. Keep undo history separated
  by plan. Imports create a new named plan, never silently replace an existing
  one; deletion requires confirmation and keeps at least one plan per context.
- Text uses allowlisted `map-editor-fonts.ts` families with optional font weight
  and italic fields. Preserve old version-1 text defaults and use identical
  typography for SVG and PNG export. Never accept arbitrary CSS/font URLs from
  imported plans; load the required same-origin font before PNG rendering.

- 2026-10-23 用户明确例外：战雷独立 Worker `war-thunder-workbench` 保持原名，不添加 `c137-` 前缀，不为命名迁移或重新创建它。

## 源码提交与本地研究资料约束

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

## 效率计算运行组件

- 前端效率统一使用 `data/player-efficiency-wasm.json` 指定的 Wasm；不得另写 JS 公式或回退到旧分数。模式、军种、载具、战报、导出及本地资料复用同一入口。
- 用户已授权公开该正式运行二进制及其授权声明，存放于既有 `MrTreasure/oss-files` 仓库，通过完整提交 ID 固定 CDN 版本，并校验字节数与 SHA-256。这是运行产物的例外，不授权公开源码、研究资料、样本或推导。
- 授权维护源码与编译材料只在本机 `artifacts/private-efficiency-runtime/` 保存，不得打包或上传。维护与分析 Agent 应使用获授权的本地源码；未经作者授权不得对受许可约束的二进制进行反向工程、反编译或重建，适用法律允许的情形除外。
- 二进制适用独立授权声明，不适用本仓库的 MIT 授权。不得宣称 Wasm、参数混淆或上述声明能够保证算法保密或强制其他工具遵守。
- 后端 AI 事实需要评分时仅在本机服务执行同一已校验 Wasm，不信任客户端提交的评分，不公开或上传后端实现。

## 昵称与战报内容安全（2026-10-23 更新）

- 游戏昵称仅使用静态词典和规则审核，不调用 AI；命中明确违规或疑似风险均改为 UID 展示。战报风格及生成文案独立审核：静态规则优先，疑似内容才进行语义审核。保留词库许可证、固定版本与游戏术语排除规则，不在线自动导入未核验的新词表。
- 风险昵称显示为“玩家 #UID”，保留战绩查询；不得在候选、榜单、历史、战报、导出、头像说明或复制内容中泄露原昵称。未确认 UID 的风险榜单条目暂不展示，不能猜测 UID。
- 战报提示词和生成文案独立审核，不能以隐藏昵称为由放行注入、色情、现实暴力等违规内容。战报模型不接收真实昵称。
- 缓存及历史内容仍经过当前显示审核。审核暂不可用时，疑似昵称按 UID 隐藏；提示词和生成文案不放行。旧版未审核的本机档案或内置榜单不得回退展示。
- Redis 仅作缓存，审核结论使用规则版本及哈希隔离；额度与持久任务以数据库为准。查询任务必须校验所属账号，旧快照降级保留实际采集时间，不冒充强制刷新成功。
- 后端及词库实现仅保留本地，不复制到前端仓库或发布包。用户已于 2026-10-23 明确授权迁移 Go 并优化队列；迁移在独立后端项目内执行，保持后端源码不上传的边界。

## 战报图片导出与静态素材（2026-10-23）

- 战报及载具卡片图片只在浏览器合成，不上传、不保存导出成品到服务器；仅用户主动下载或复制到剪贴板。导出不得请求 NAS `/media/*` 图片代理，也不得带账号凭据读取公共素材。
- 用户明确允许将缺少 CORS 的官方原始背景及国旗托管现有 `MrTreasure/oss-files` 静态图床；这是“官方图片只用原地址”规则的例外。保留原始字节、来源、SHA-256、字节数及固定提交 ID，浏览器校验后使用。不得将玩家数据、生成战报或后端源码放入素材仓库。
- 任务状态轮询采用分阶段递增间隔，页面隐藏时暂停，恢复可见立即获取状态；暂停不消耗前台等待预算。保留取消、鉴权、任务恢复和失败提示。

- 账号用户名允许可见 Unicode 标点、符号及不含控制字符的 Emoji；保留长度与唯一性约束，拒绝换行、不可见控制字符及静态违规内容。不得把本站账号规则冒充官方完整字符白名单。查询昵称不套用注册字符白名单，保留符号及后缀原文发送官方接口。
- 昵称静态审核版本为 `content-safety-v3`；浏览器旧审核缓存不得作为回退展示。此次前后端版本变更须配套发布。

## 公共低频数据缓存

- 日历、金鹰/礼包载具目录、公共配置及加载背景使用匿名版本索引＋SHA-256 内容地址，读取时校验哈希/字节数；不可混入用户资料、登录、额度余额或任务状态。
- 日历首屏同步显示上次快照，再异步读取新版本；失败保留旧内容及核对时间。载具目录按国家读取，搜索/类别/等级过滤在本地进行。
- 公共资源 OPFS 使用独立 `wt-public-resources-v1` 目录，localStorage 降级只写同前缀缓存；禁止清理购物车、关注列表、账号和队列。源 JSON 构建仍须遵守不发布独立 JSON 文件的原规则；运行时公共 API 响应不属于静态源文件发布。
- 不可变哈希对象必须保留旧版本，变更内容必须生成新哈希。私人 API 不得进入共享边缘缓存；含玩家昵称的榜单不作为长期不可变公共资源。

## 地图完成记录（2026-10-24 用户明确授权）

- 点击地图编辑器“完成”时，静默、异步提交当前方案的 JSON 绘制快照及地图/布局/队伍/视图信息到独立后端数据库。成功失败均不向用户弹提示，不阻塞完成；不采集逐笔过程，不上传或保存图片。
- 原 OPFS 本地方案保持独立；上传待办使用隔离的 IndexedDB `wt-map-completion-outbox-v1`，最多 20 条，按原登录身份重试，不得跨账号归属。不得清理本地方案、购物车或其他状态。
- 控制台只读预览复用 `MapAnnotation` / `MapDrawingPreview`，底图及图标只使用现有 CDN 原素材。只有选中记录才加载绘制详情；支持单条/批量删除，删除不能被旧上传重试恢复。

## 账号云端状态与游戏账号关联（2026-10-24 用户确认）

- 登录用户的研发计划、载具研发购物车和出击队列保存至独立 Go 后端；游客保留原本地存储键，不自动上传、覆盖或清除游客记录。首次迁移须显式选择导入，跨账号隔离待同步数据。
- UID 关联只做防误绑，使用空输入框中的 UID placeholder，要求重新输入相同 UID；不宣称官方身份认证。不要求玩家的 Gaijin 密码。
- 用户明确确认：游戏原始黑桃图标在本站仅表示“已拥有”，不表示改装全满。用关联车库自动跳过已拥有载具的研发点，不据此清零改装研发点。原图来源及固定版本见 data/account-workspace.json。
- 解除入口位于用户名菜单；弹窗要求逐字输入“我再也不绑定别人的账号了”。后端必须严格比较原文，不能 trim、只在前端校验或使用普通确认框代替。
- 登录/注册及云端功能首次使用需要明确确认当前版本的用户协议与数据说明；后台提供账号计划、游戏关联和协议确认管理。私人接口不进入公共缓存；后端源码仍仅本机维护。

## Account sync and garage presentation

- After agreement confirmation, account saves are automatic and silent. Never open the cloud-data/import panel merely because a user logged in, and do not show successful sync status in the header or menu. The panel remains available on explicit request.
- First account use may automatically import valid guest plans only into missing cloud keys. Cloud documents, deletion tombstones and pending account edits win; retain the guest originals and prevent automatic import into another account once claimed.
- Full garages live under 出击队列 → 我的车库 at `#/lineups/garage`, require login on both frontend and backend, and use the exact shared stats vehicle-card component with filters, modes, sorting and pagination. Default to the linked game account; unlinked users get a stats/binding entry. Old stats garage links redirect. Garage and its details use page content, not dialogs; anonymous local lineups remain available. Do not load country trees on the garage route.
- Owned spades use the original `item_icon_elite_slot.png` card-body watermark and game colors recorded in `data/account-workspace.json`, behind vehicle art/text. Do not restore a boxed corner badge. Keep original HTTPS asset URLs and provenance.

## 贴花查询暂缓（2026-10-24）

- 当前无官方可用 CDN 资源，贴花查询计划暂时搁置。隐藏桌面及移动入口，直接访问旧路由返回科技树，不加载贴花目录或发起查询。
- 保留现有实现和本地数据；未确认可用的官方资源前，不重新开放入口，不猜测或拼接图片地址。

## QMuse WASM 发布清单（2026-10-24）

- 效率运行时使用 `src/assets/player-efficiency.v3.wasm`，作为用户要求修复平台声明问题的明确例外，允许发布已公开的同一 911 字节二进制；源码和研究材料仍不得上传。
- `data/player-efficiency-wasm.json` 记录本地路径和固定来源、SHA-256、字节数；QMuse CLI 生成的源码清单必须包含该文件的路径/大小/哈希。Vite 使用显式本地 `?url` 引用，浏览器不下载远程 WASM。
- 构建验证仅允许一个与声明哈希一致的 WASM，保留加载前校验；不得混淆、隐藏 WebAssembly 调用或绕过平台审核。

## 载具与榜单展示（2026-10-24）

- 联队载具依据 canonical `kind=squadron` 分类，使用 `data/vehicle-card-theme.json` 记录的原游戏绿色调，并明确显示“联队载具”；不可将活动／礼包载具凭外观改成联队载具。
- 排行榜入口显示官方 Top 30，桌面三列。六种模式／军种的榜单必须逐项核验 1–30 名；不能补造玩家，刷新失败保留既有来源与采集时间。前后端排名输入上限保持一致。
- 共用 `Chevron` SVG 表示下拉／展开状态，避免字体字符造成箭头过小、错位或缺失。
- 仓库文档和截图不得包含本机凭据存储位置、凭据索引、登录邮箱、密码、会话或令牌。需要凭据的维护脚本由本机私有环境注入位置，不硬编码到公开源码。

## 文档示例账号（2026-10-24）

- 普通测试账号显示名为 `WT_Workbench_Demo`，仅用于登录验证与 README 实站截图，不授予管理员权限。
- 经用户指定，示例关联游戏昵称 `starfall21740`（联队标签 `[Kflan]`），游戏 UID `129393650`；这是防误绑关联，不代表官方身份认证。
- 登录凭据仅保存在本机私有凭据中。公开文档仅记录显示名、用途和公开游戏资料，不记录登录邮箱、密码、会话、凭据位置或索引。
- 截图使用真实公开数据，不手填或改写战绩；仅更新实际补拍图片的采集时间和来源，保留旧图原始记录。
