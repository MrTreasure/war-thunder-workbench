# War Thunder Workbench

## Wiki 数据资源更新（2026-10-24 用户确认）

- 科技树资料允许发布到既有 Git 图床，固定入口 `war-thunder/catalog/manifest.js`，各国数据文件名包含内容哈希。通过公共版本索引取得完整提交 ID，校验字节数、SHA-256、国家及 schema，按文本解析固定 JSON 字面量，不执行远程 JavaScript。保留本地国家模块和已验证缓存作为回退，canonical 数据仍在 data/*.json。
- 后台管理员手动采集 Wiki 当前值并点击更新资料；后续资料发布不重复部署页面，不创建自动同步任务。计划表不直接覆盖现行值，新增及结构冲突保留待核对。
- 载具详情增加基础资料、获取与价格，以及 RP/银狮获取百分比；配件信息继续在配件研发中展示。匿名读取公开 Wiki，不携带用户登录态。2026-10-24 用户明确要求采集默认并发 10、随机等待：各工作线程随机等待 6～10 秒，同域名请求入口按 0.8～1.2 秒错峰；遇限流、登录或验证停止，不绕过验证。已有且完整的字段与来源时间必须复用，缺少配件布局或 RP/银狮收益倍率时才补采；同一辆车的缺失项共用一次页面读取。来源倍率与玩家作战效率评分分别保存，未知不补零。


### 下次 Wiki 采集：飞机挂载（2026-10-25 用户要求）

- 下一次手动 Wiki 采集必须同时采集飞机挂载资料；本次约定不授权立即启动采集或新建定时任务。执行前先读 `docs/wiki-collection-next-run.md`，补齐解析及校验，再启动原有采集入口。
- 范围包含可用武器／吊舱／副油箱、挂载数量或组合、挂点兼容表、重量、总挂载及左右翼载重限制，以及页面实际提供的武器参数与官方图片来源。武器解锁配件与实际挂载选项分别存储，不将配件研发记录冒充完整挂载资料。
- 调整本地脚本与后台采集的完整性判断：缺少挂载资料的飞机不能因配件、布局及收益倍率齐全而跳过。同一页面读取同时补齐缺失字段；优先解析可验证的已存页面，禁止重新抓取已经完整且有来源证明的资料。
- 每条记录保留载具唯一 ID、来源 URL、实际采集时间、原始页面哈希与解析版本；区分确实无挂载、Wiki 未提供、解析失败、尚未采集，未知值不得补零。仅保留官方公开的挂点与限制，不推断完整游戏挂载互斥规则。
- 保持匿名读取、默认并发 10、线程随机 6～10 秒和同域名 0.8～1.2 秒错峰；遇限制立即暂停。后台采集入口及日志需明确包含挂载范围，资料发布仍由管理员手动确认。

## 指令文件与站点约定（2026-10-23 更新）

- 本文件 `AGENTS.md` 是 Codex 的唯一项目指令入口；原 `AGENT.md` 规则已合并到本文件，不再维护第二份指令。`AGENT.md` 不得提交或上传，必须保持 Git 忽略。
- 正式站：`https://render.qmuse.pub/p/muse/8645013411493394`，只更新既有 QMuse 应用。
- 国际站：`https://wt.mrtreasure.cc/`，部署独立 Workers Static Assets，Worker 保持 `war-thunder-workbench` 原名。
- 2026-10-24 用户澄清：独立 Render 预览站并未停用，已迁至 Cloudflare Workers。预览地址为 `https://render.mrtreasure.cc/war-thunder-trees/`，可用于用户验收；不得将其当作正式站或国际站。先前对 Render 域名的全面禁用已撤销。
- `deploy:qmuse` 用于正式站；`deploy:cf` 用于国际站。`deploy:preview` 仅发布独立 Render 预览；遵循 CF Workers 现行资源先于 HTML、哈希资源保留、鉴权及边缘校验流程，不恢复 NAS 对外托管。
- 用户要求预览时，先发布独立 Render 预览并等待明确验收；确认前禁止更新 QMuse、国际站、线上图床资料索引及后端现行数据。尚未发布的本地构建不能宣称已在线。发布前保留构建、Git 版本及必要回滚材料。
- 国际站 SEO canonical 与 Web Analytics 继续对应 wt 域名；后台“页面分析”保持直达该站统计。
- 国际站发布使用 `feat/seo-localized-pages` 的多语言工作区，合并 main 后补充英、俄、日文案，不得以中文 main 构建覆盖国际站。
- 2026-10-24 QMuse 90800278 曾因「未声明 WASM」被拒；按用户要求补充结构化用途清单、文件 NOTICE、加载入口注释及官方 CLI 清单核对后，仅重试一次，90800422 / 部署 36900195 的最终审核为 PASSED、部署为 DEPLOYED，已验证线上版本；静态子扫描仍保留 WASM 告警，不能声称所有扫描均通过。此为历史发布记录；后续用户已改为后端原生计算，当前前端不得包含 WASM。
- 旧 `../war-thunder-trees/` 和 NAS Muse 目录仅作历史存档，不是发布目标。

## 项目实现约束

- React + Vite + TypeScript 7, using the supplied QMuse template configuration,
  TanStack file routes and Tailwind v4. Use pnpm and keep exact dependency versions.
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:data`, and
  `pnpm run build` for routine verification. UI acceptance includes Playwright screenshot verification for this project,
  explicitly authorized by the user on 2026-10-25. Preserve manual native-client
  acceptance for capabilities that Browser Mock cannot prove.
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
  pages. Use the supplied QMuse logo and invite link; do not duplicate its full promotion block in other content. The shared page footer
  carries the separately requested QMuse Vibecoding platform attribution. Keep it responsive without horizontal overflow.
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

## 效率计算运行组件（2026-10-24 更新）

- 效率统一由私有 Go 后端原生计算，随玩家快照、载具扩展统计及战报持久化版本缓存；缓存命中不得重复计算，历史记录首次读取时仅升级派生评分，不刷新官方采集时间或消耗查询额度。
- 前端只展示服务端评分，禁止发布计算公式、JS 回退、WASM/WAT、源码或研究材料；构建与 QMuse 导入均检查无浏览器计算运行时。
- 评分源码受作者创作保护，只在本机私有服务维护，维护 Agent 不得公开、反向破解或上传实现。已有退休二进制及授权维护资料保留在忽略的本地 artifacts 中。
- 生涯、军种、模式、载具、战报与导出复用同一后端版本；不信任客户端提交的评分。

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
- Full garages live under 出击队列 → 我的车库 at `#/lineups/garage`, require login on both frontend and backend, and use the shared VehicleTile from the research tree with filters, modes, sorting and pagination. Statistical vehicle cards are reserved for explicit battle-performance views. Default to the linked game account; unlinked users get a stats/binding entry. Old stats garage links redirect. Garage and its details use page content, not dialogs; anonymous local lineups remain available. Do not load country trees on the garage route.
- Owned spades use the original `item_icon_elite_slot.png` card-body watermark and game colors recorded in `data/account-workspace.json`, behind vehicle art/text. Do not restore a boxed corner badge. Keep original HTTPS asset URLs and provenance.

## 贴花查询暂缓（2026-10-24）

- 当前无官方可用 CDN 资源，贴花查询计划暂时搁置。隐藏桌面及移动入口，直接访问旧路由返回科技树，不加载贴花目录或发起查询。
- 保留现有实现和本地数据；未确认可用的官方资源前，不重新开放入口，不猜测或拼接图片地址。

## QMuse 效率组件发布（2026-10-24 更新）

- 用户已改为后端计算，旧 WASM 声明重试仅为历史记录；当前发布不得包含 WASM/WAT、计算实现或研究材料。
- 先发布并验证后端版本及持久化评分缓存，再发布前端；前端与导出仅消费接口中的评分。

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

## 黑盒工坊小程序（2026-10-24 最新确认）

- 2026-10-25 用户确认：小程序不提供头像修改或头像选择入口，始终展示小黑盒已授权头像；网页独立提供头像选择，网页选定头像不得覆盖小程序头像。已关联游戏账号的网页头像采用可信游戏快照头像。
- 小程序保留载具研发、配件研发、战绩查询、账号参考估值与个人战报；使用独立 apps/war-thunder-heybox 构建，网页两站的发布绑定不改变。
- 小程序 UI 按用户指定 finesse-ui 重做移动端壳和操作层；科技树画布及样式以主分支另一位 agent 的最终改动为准，不在此分支另做一套树样式。
- 效率统一后端计算和缓存由另一位 agent 负责，本分支不修改评分服务、公式或运行组件；按其最终接口和前端改动接入。
- 黑盒授权支持创建普通账号或验证双方身份后绑定已有账号，不能按昵称或邮箱自动合并。官方文档当前仅提供小程序内授权，网页使用登录账号菜单中的关联码绑定入口，不展示未经证实的网页 OAuth 登录。
- 用户已完成 CLI 登录并授权创建远端小程序、申请网络能力及完整接入；远端项目由官方 CLI 管理绑定。服务端密钥仅保存私有凭据，不能进入前端环境、包或 Git。发布前完成真实能力验证，审核／权限等待不能冒充通过。
- 小程序平台资料要求本地图片文件，图标和封面允许对既有官方素材作裁切、缩放和合成；来源及哈希写入 data/heybox-branding.json。此例外仅适用于平台资料，不改变网页及载具原图地址规则。

## 科技树字体与折叠组（2026-10-24 更新）

- 科技树使用游戏字体索引中列出的 Fira Sans Condensed，常规字重 400，保留 OFL 授权；不要再用官网 Roboto Condensed 冒充游戏字体。中文优先已安装的 Microsoft YaHei，不分发未获授权的专有中文字体。
- 折叠组展开/收起保留关闭动画，隐藏内容 inert；卡片、等级行和等拓扑连线使用一致过渡，支持快速反向操作及减少动态效果。不可通过重载国家数据或整棵树重挂载实现动画。
- 联队卡片维持绿色边框；禁止使用未定义 CSS 变量导致 border-color 回落到 currentColor 的旧规则。
- 用户要求彻底撤下远端 WASM。保留旧静态哈希的部署规则不适用于评分 WASM，发布归档与当前静态目录都须剔除；本地私有研究副本仍保留。Git 固定历史链接能否失效必须真实验证，不得将当前分支删除等同于历史对象删除。

## 自动登录与配件展示（2026-10-24）

- 回访用户通过后端 HttpOnly/Secure/SameSite=None/Partitioned 会话 Cookie 恢复短期 Bearer；Cookie 绑定受信 Origin、签名设备票据及原浏览器会话。浏览器本地只保存非敏感登录提示，不落盘 Bearer。退出须撤销对应浏览器和恢复凭据。旧登录 Cookie 仅作一次不显示登录表单的静默跳转迁移，失败返回原页面，避免循环。
- “适应窗口”只用图标按钮，提供 title/aria-label。科技树箭头复用核验的官方 arrow_simple.svg 几何和原始轴宽，连线持续随折叠组过渡。
- 配件图标、官方 Wiki 每车栏目/行列位置信息保存在 data/modification-presentation.json，并合入既有按国家懒加载模块。仅使用官方 CDN；未核实格位的载具不补造等级/依赖。图标因国家/载具不同的，优先使用每车来源，不把德国乘员图标套用到其他国家。
- 配件图形选择必须复用原 RP、完成勾选、单价、购物车和浏览器保存逻辑，不改变数值来源或将未知价格/RP 当零。

## 统一载具规范与页脚（2026-10-25 用户确认）

- 科技树已验收的载具样式是通用载具规范。`src/VehicleTile.tsx` 为唯一通用载具展示组件；科技树、拥有状态、载具研发、研发前置、搜索与筛选结果、目标下拉候选、出击队列与乘员槽位、我的车库、账号估值、折扣关注均复用它，不复制 JSX 或单独再造一种载具卡。
- `PlayerVehicleCards` 仅用于明确展示战绩的场景；我的车库默认展示拥有清单，不使用战绩卡片。点击载具主体可进入现有战绩详情，不额外添加“查看战绩”按钮。详情大图与导出的战报图片保留其用途。
- 通用载具使用原游戏图片、WTSymbols 特殊符号、Fira Sans Condensed 400 字重，统一 228×76 主体；常规研发点、金鹰、礼包整包人民币、护身符与 GJN 图标遵循科技树现行规则。场景补充信息放在组件外围，不修改主体比例或覆盖其名称、图标、配色。
- 黑桃只表示真实已拥有。已配置队列、曾出击、推算前置不作为拥有证据。其他玩家的车库、估值必须传入该玩家的拥有状态，不混用当前登录账号的车库。
- 组件适配已知资料；字段缺失保持未知，不补零、不臆造 BR／币价，不因渲染单个组件请求数据或全量加载十国资料。载具稳定 ID、已有本地存储键、分享码、筛选与排序行为保持兼容。
- 估值第三种场景统一显示“参考价值”；原 API、缓存及规则键 `secondHand` 保留，金额、费率与估值算法不因文案修改而改变。
- 科技树隐藏共享页脚，其余页面由 `AppFooter` 在正常滚动内容底部展示精简入口，完整声明见独立免责声明页；不得做成固定遮挡条或改变地图编辑器画布尺寸。
- 页脚明确显示“本应用通过 QMuse Vibecoding 平台搭建”，链接为 `https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB`，带外跳符号、新窗口与 `noopener noreferrer`。顶部共享 CreatorLink 保留；本项是用户要求的独立平台署名，不重复整块推广组件。
- `style.md` 是本应用视觉方案与组件使用规范；新增或修改界面应先读取。两站视觉组件保持一致，国际站新增文案及名称、数值格式必须补齐英／俄／日。

## 公共载具元数据与本地筛选（2026-10-25）

- 统一使用 `src/vehicle-catalog.ts` 与按国家的 `vehicles-*` 公共资源补全名称、等级、获取类型、RP、BR、载具类型及整包价格；数据由同一份 canonical 科技树生成。页面／列表集中请求，组件仅订阅内存数据；同一 canonical 数据按国家另生成小型 `vehicle-facts-*` JS 展示投影作哈希核验回退，完整科技树与配件仍按原模块懒加载；复用公共资源内容哈希、OPFS 与请求合并。不得为了显示车库或估值加载全量科技树／配件。
- 科技树已加载的核验国家资料也登记到公共展示目录；资料完整的科技树对象保留其当前核验字段。未指定模式时采用历史 RB，已指定模式则保留该模式，不臆造 BR。
- 已有可核验的礼包人民币报价必须传给共用组件，不同时显示金额和“暂无报价”；只展示整包价格与核对日期，金鹰和人民币分别处理。
- 科技树国家、军种、模式、特殊载具筛选与搜索保留在 `wt-workbench-selection-v1`，兼容原两字段记录；回访优先恢复本地选择，前进后退保留路由语义。Logo 返回 `#/tree`。
- 通用列表默认每页 24 辆，数量选择采用 24／48／96；车库按 6／4／3／2／1 列响应，不额外展示战绩按钮。折扣选车只保留弹窗一层滚动，列表不得增加内层滚动条。
- 页面 CSS 不得用宽泛的后代 img/span 规则修改共享载具内部的图标、字体或布局；队列预览省略连续末尾空槽，但不得改变真实槽位、分享码或配置页的全部槽位。

- 2026-10-25 预览修订：队列、车库与折扣载具的等级和国家通过 `VehicleTile.showRank`、`countryLabel` 按上下文配置，固定于主体下方右侧，与左侧礼包整包价格共用一行，不因礼包额外换行。折扣选车关注按钮固定于每项右上角，使用明确按钮外观；卡片外不重复显示载具名、等级及原价金鹰金额，只保留核对日期等补充信息。

## 折扣关注的账号保存（2026-10-25 用户确认）

- 已注册且登录的用户，`wt-sale-watch-v1` 使用现有账号工作区保存到服务器，按用户隔离、版本号检查冲突；匿名用户继续保存在本地。账号切换不得沿用另一个账号的关注数据。
- 浏览器中旧的有效关注首次登录时按 ID 去重并入账号列表；使用独立迁移标记与归属记录，不因旧研发计划已迁移而跳过关注迁移，不恢复云端已清空／删除的列表，不覆盖本地原件。
- 关注条目逐条校验；缺少或过时的图片用统一官方媒体规则恢复，单条异常不得导致整份关注被丢弃。服务器只接受现行目录中的可关注载具，以服务端公共目录重建名称、图片和报价，不信任客户端价格。
- 保留账号同步待办、刷新恢复、失败提示、跨设备版本冲突与云端导出／删除。关注保存失败须在选车弹窗内可见，不能仅显示“已关注”造成已保存的误解。不得将私人关注列表加入共享 CDN 缓存。

- 2026-10-25 特殊载具状态：非高级、非联队的活动／特殊与市场载具，未拥有时由公共 `VehicleTile` 使用与礼包相同质感的暗红色哑光底板和顶部金属边线（无拉丝纹理、无斜向高光）；已拥有时沿用原拥有底色与真实黑桃。金鹰／礼包、高级及联队配色不受影响。该暗红色是应用自定义状态，不表示研发禁止或虚构拥有。

## 宣传与文档截图入口（2026-10-25 用户指定）

- 后续宣传帖、README 与功能说明截图统一使用国际站 `https://wt.mrtreasure.cc/`，按需切换为中文；不使用 QMuse 或 Render 作为截图来源。遇国际站验证／访问问题应说明并处理，不能悄悄换站。
- 截图前除等待字体与可见 `<img>` 外，必须确认科技树计算后的 CSS 背景包含有效官方 URL，并完成对应背景图片解码；不可通过注入背景、改 DOM 数据或拼造玩家进度替代真实页面截图。保留截图来源、时间及版本。

## 官方壁纸与更新版本目录（2026-10-25）

- 后台背景预览使用完整原图等比显示，不以 cover 裁掉画面；背景位置参数只影响应用内背景裁切。展示原图地址、官方来源页、已核对的版本与日期。
- 历年壁纸通过 `scripts/collect-wallpapers.mjs` 手动读取官方新闻站点地图、版本发布公告和壁纸分页，串行随机等待 6–10 秒，匿名读取；遇验证或限流停止，复用 6 小时内的页面快照。不建定时任务，不批量下载／转存原图。
- 默认只在忽略的 artifacts 中生成候选资料；`--apply` 才写入 canonical 目录及战报素材目录，不自行发布。图片只使用页面明确提供的官方 HTTPS 下载链接，保留原 ID、来源、版本证据和分辨率；无法确认的版本标为待核对，不能声称历史目录完整。

## 紧凑页脚（2026-10-25 用户更新）

- 科技树 `/tree` 不挂载公共页脚。其余页面使用紧凑页脚，仅显示非官方提示、免责声明、反馈、主站／国际站链接及 QMuse 平台署名；识别当前站点，不携带账号或会话参数切站。
- 完整来源、非官方关系、版权归属、参考性质及权益联系说明放在独立 `#/disclaimer` 页面。此页面不得触发国家资料加载。国际站功能说明和语言链接移入该页面，新增文案补齐英、俄、日。

## 小程序交互与图标（2026-10-25 用户确认）

- 小程序整体遵循 `style.md` 的工作台视觉；导航、账号、筛选与返回等使用 `data/workbench-ui-assets.json` 登记的战雷原版图标和官方 HTTPS 地址，不另画一套线性图标。载具继续复用最新 `VehicleTile`，等级置于右下页脚。
- 小程序详情、筛选、协议及关联确认使用带返回的独立详情页面，保留来源页滚动和草稿，不用弹窗／底部抽屉。返回研发首页清除载具选择，载具研发与配件研发输入分别管理。
- 顶部按官方 SDK 窗口安全区域避让状态栏与宿主胶囊，窗口变化时更新；测量前保留顶部空间。前台同账号复核不重挂页面或中断查询，真实切号仍须丢弃旧私人响应。
- 小程序保留“体验工作台完整能力”入口，指向现有 QMuse 主站；外部网页打不开时提供可选中、可复制的真实地址，不使用未文档化的宿主跳转协议。

## 截图验收授权（2026-10-25，仅本项目）

- 用户明确允许本项目在开发和交付时使用 Playwright 进行浏览器交互、布局检查与截图验收；不再需要为本项目每轮截图重复询问。此授权不扩展到其他项目。
- 网页和黑盒小程序的 Browser Mock 应按实际可用环境分别验证；报告须标明浏览器／SDK Mock／真机环境，不把模拟授权、测试资料或浏览器截图冒充小黑盒真实登录和真机通过。
- 截图、日志与最终验收报告保存在本机忽略的 `artifacts/`，对敏感身份、凭据与开发票据做隔离，截图不包含调试二维码或原始鉴权日志。汇总通过项、缺陷修复、未通过项及验证范围后交付用户。

## 小程序正式 API 通道（2026-10-25 用户明确要求）

- 正式小程序的业务请求固定使用 `https://api.mrtreasure.cc/wt-stats/v1/`，只走 Cloudflare 转发通道；严禁使用 NAS 直连域名、局域网地址、个人直连入口或 `15432` 端口，不能配置成超时回退。
- 本机官方 SDK Browser Mock 的回环调试地址与开发进程 IPv4 优先设置仅用于本地工具，不得成为正式业务 API 地址。发布构建必须检查正式网关及禁止的直连地址。

## 飞机空陆权重展示（2026-10-25）

- 飞机详情分别列出空战 AB/RB/SB 与陆战 RB/SB（`trb`/`tsb`）；陆战 AB 的机库飞机不参与，缺少陆战字段不得回退成空战权重。陆战 SB 数值展示不能替代活动允许名单。
- 出击队列的已存预览、乘员槽位、当前槽位下拉与候选使用同一 `lineupCardRating` 展示上下文权重，继续复用 `VehicleTile`；排除军种不显示无关权重，不改变保存、分享码与队列计算规则。

- 2026-10-25 载具辅助信息按上下文配置：共享 `VehicleTile.showRank` 与 `countryLabel` 分别控制等级和国家。筛选已指定等级／国家、或分组标题已标明时省略相应标签；跨等级／跨国家列表才补充。辅助信息固定在主体下方右侧，与左侧礼包价格共用一行，不另起等级行；不以军种（如空军）替代国家，不在卡片外重复等级／国家。保留独立的状态与来源说明。

- 2026-10-25 查询额度展示：战绩页外部只展示当前角色、剩余次数与该账号额外查询点；使用规则及普通／匿名用户每日免费次数统一放入可点击的额度说明弹窗。每日次数取公开后台角色配置，余额和扣点比例取当前私有会话，不硬编码比例、不将余额加入公共缓存。后台加点提供 5／10／20 和自定义正整数，使用现有版本校验累加总额，不清空已用或预占。

- 2026-10-25 用户修正额度展示：角色／剩余次数及额外查询点入口必须为可点击纯文字，不带按钮底色、边框或信息图标。额外可用点数为 0、未启用或未知时，外部额外点数与弹窗内整段额外点数规则均隐藏；弹窗仍可显示每日免费次数。服务端明确不限的额外点数仍可显示。

## 账号估值展示（2026-10-25）

- 估值弹窗分为“估值总览 / 载具明细”，明细复用 `VehicleTile`。66 个已核实研发与购买均免费的初始载具，按 canonical 政策 ID 从全部估值清单及展示计数中过滤，不列入零价值或排除清单；展示过滤不改服务端金额或原始缓存。
- 低门槛赠送载具仅按已核实的获取依据设置三个口径均为零；无可靠依据的隐藏载具不臆造单车价格，保留已有管理员明确配置。
- GJN 载具保留官方市场“查看市场详情”外链，使用官方市场已有浏览器登录态；本站不自动采价或轮询，不展示人工市场均价，也不将 GJN 混入人民币合计。

- 估值明细：单载具（含单载具礼包、金鹰、特殊及赠送）每行两个横排条目；仅多载具礼包独占一行、内部最多三列。卡片外不重复载具名称及金鹰数量。共用 `VehicleTile.href` 支持只读列表以链接打开官方 Wiki；未传链接的现有选择与详情行为保持原样。

## 小程序战报与科技树（2026-10-25）

- 小程序与 PC 共用 `buildReportRequest`、`createVehicleCard`、`createStatsReportImage` 及战报风格目录；不得再建立移动端独立的战报算法、图片排版或风格定义。仅在客户端生成图片，评分及文案继续走同一私有后端。
- 原生分享使用公开 SDK `share.screenshot`，声明 share 权限；深色图选择 dark 水印，截图底部保留至少 57 逻辑像素（当前 64px）。水印区延伸成就背景并在接缝处柔和模糊；不拉伸文字、载具或数据。不根据 SDK 不透明返回值宣称已保存／发帖；Browser Mock 与真机结果分别记录。
- 小程序科技树使用双指缩放，单指滚动；全屏隐藏其他应用 UI，保留退出图标及返回退出。查询本地记录仅保存有界 UID／快照引用，恢复经服务端审核，不能回放未经当前审核的本地昵称或完整资料。

## 队列大厅与分享（2026-10-26）

- 大厅发布仅接受稳定载具编码、明确的战斗类型／模式、空战 RB 出击飞机和注册表中的标签 ID；不得公开私人队列名称、自由标题、附言或上传图片。服务端重新核对国家、槽位、重复载具、8 辆上限、标签与模式权重，不信任客户端 BR。
- 发布后的方案保持快照，配置／标签变化生成新 ID，不转移原赞踩；重复提交同一配置幂等。赞踩按账号互斥、可撤销，作者不能自评；下架验证所有者，读和写均按现行昵称规则隐藏风险原文。分享不调用官方查询、不扣查询额度。
- 分享图最多 8 辆、按官方队列样式三列排列；原个人队列 11 槽与 24 位大小写敏感分享码、空槽顺序及追加式码本保持兼容。超过 8 辆时提示另存精简方案，不能静默截断。
- 分享图统一显示拥有黑桃是用户指定的场景例外；大厅实际拥有状态仍来自当前浏览者的车库。图像附言只在当前弹窗内存中，关闭清除；发送到后端作安全检查，并按用户后续明确要求单独留存提交原文、账号／设备、结果及时间，仅供管理员查看；不公开到大厅、不持久化在浏览器、不保存图片成品。说明经检查后才进入预览，修改后重新检查，下载／复制前再次核对。分享图保留研发点／金鹰或礼包／特殊类型标记，隐藏外部礼包人民币报价和等级，分享码和分享者位于右下角。
- 预览通过隔离社区服务和数据库提供完整功能，只读验证现有账号与绑定；不能为预览替换正式后端或顺带部署未获批准的账号／额度变更。静态预览确认后才启用正式站社区服务与多语言发布。后端实现仍只留在私有后端项目。

- 2026-10-26 补充：队列分享仅提供街机 AB 与历史 RB，不新增全真分享／导出；分房可能范围按队列 BR ±1.0 计算，不能把这个总体范围冒充单场房间跨度。个人队列的原有全真资料保持兼容。

## 地图推荐走线（2026-10-26）

- 地图详情“推荐走线”按钮、列表推荐角标、只读图层及 PNG 导出叠加仅 `session.role === "superadmin"` 可用，超管默认开启；未确认身份、普通用户及匿名用户不请求路线 SVG。移除地图左下角的推荐来源与参考说明浮层，加载／缺失／重试状态放在超管按钮的状态与提示中；按 canonical 地图／任务布局／己方队伍精确匹配，不把其他布局或对面路线作为回退。当前无匹配时禁用超管按钮并提供提示；切换该图层不重置摄像机，不写入用户 OPFS 方案或完成快照。
- 数据在 `data/map-recommendations.json` 与可信 `data/map-recommendations/*.svg`；源码攻略与原始配准材料仍只在本机 artifacts。用导入脚本校验底图哈希、点位与出生方向，SVG 仅允许静态几何和内部箭头引用。构建为 JS 索引与同源哈希 SVG，不发布独立 JSON 或原始素材包。
- SVG 像素至完整地图的矩阵与 PNG 导出共用，不再做 Y 反射；跟随布局裁切与地图缩放。来源与版本资料保留于 canonical 索引及关联攻略，不再显示左下角说明。导出当前开启的图层，加载失败必须报错，不能静默漏掉推荐走线。
- `pnpm run check:map-routes` 已加入常规 check；检查双向完整性、唯一队伍映射、现行布局、非反射矩阵与可信 SVG 引用。2271 号测试基地未收录到现有地图目录前不映射到其他地图。

- 2026-10-26 内容审查补充：后台独立记录提交原文与真实提交身份，管理员可查看并通过统一账号系统封禁／解封整个工作台应用权限，保留操作人、原因与时间。不封禁其他应用，不删除历史数据。匿名设备不得冒充注册账号；后台审查接口必须同时验证可信反向代理和现行超级管理员会话。

- 2026-10-26 分享图紧凑布局：顶部的分房范围、游戏模式、国家平铺三列，避免三行文字留下右侧空白。标签统一使用独立的 `src/components/GameTag.tsx` 与 `game-tag.css`，队列标签由 `LineupTag` 按注册表适配；通用标签不依赖队列 API。保留官方吊牌尖角、孔洞与金属底纹，支持银灰／暗金／暗红／深蓝及键盘可用的选中／禁用状态，不复制各场景标签皮肤。

- 2026-10-26 标签验收更新：皮肤按青铜／白银／黄金／翡翠／钻石／王者／七彩闪烁扩展，登记于 `data/game-tag-theme.json`，与文案独立选择。`#/tag-preview` 为独立样式验收页，不启动账号会话或国家数据加载（公共外观配置可照常读取）。官方原版用原始底纹与 RGB 乘色复现，不使用灰度／色相滤镜改造；本轮不修改大厅标签协议或暗示自选皮肤已存到后端。

- 2026-10-26 标签后续修订：皮肤选择必须保留官方原色与官方红色；自定义七档具有分别对应的材质层，原版不叠加。用户明确要求七彩为持续播放的特权效果，不设暂停／静态入口，并允许该特效覆盖现有全局减少动态效果规则。验收必须比较真实前后帧及色彩变化，不能仅检查 animation-name；皮肤预览不代表已实现账号特权授权或大厅配色持久化。

- 2026-10-26 标签验收继续修订：补充独立基本颜色组（按最新选择为黄、绿、蓝、紫、粉、橙、黑7色；去掉基础红，官方红色另组保留），保留官方原版组和七档材质组。材质保留明显的镜面／拉丝／切面效果，全部材质层沿原始 alpha 轮廓连续覆盖至前端尖角，使用 overlay 保住黑色外框和透明孔洞，不使用矩形裁切造成左侧断层，也不在轮廓外画出亮线；七彩特权动效保持连续。官方称号文案按官方公告来源持续扩充（现有78条），保持来源、语言和稳定ID，提供本地搜索，不冒充当前客户端全量目录。

- 2026-10-26 七彩补充：标签全宽显示完整鲜艳色谱，整体持续变色，左端同步变化；禁止放大渐变造成局部黄色占大面积。保留低强度扫光，减少白色遮盖，必须验证实际帧与左端像素变化。

- 2026-10-26 标签权限接入：独立 `TagSelector` 受控组件将文案和外观分开，由调用方提供选项、上限及服务端可选样式。官方原版和7种基础色默认可选；青铜1／白银25／黄金50／翡翠75／钻石100级逐级累加，王者还需历史RB总战斗满1000次，七彩只复用现有超级管理员权限。按当前绑定UID的最新服务端快照实时派生，绑定／资料更新后刷新，不额外查询官方或扣额度；解绑换绑不得沿用旧UID资格。发布与本地导出均后端复核，历史发布快照保留原配色。`#/tag-preview` 本轮按用户最新要求接入共享账号和选择组件，允许启动会话，但不得加载国家载具资料。正式站保持不更新，仅隔离社区后端及独立Render预览更新。

- 2026-10-26 载具打标：科技树详情底部展示当前大版本标签并提供打标操作，仅注册用户提交、匿名可看。同一载具与注册文案累计次数，普通样式取最后提交；有材质时取最高档，同档再取最后一次。后台按身份设置每日免费打标额度（注册用户默认5次、游客0），北京时间恢复；用完后扣累计额外点数，默认1点/次、可配比例。重复打同车计次，网络重试按操作ID幂等，标签、免费次数和点数同事务提交，失败不扣费。版本注册表为 `data/game-tag-versions.json`，大版本升级追加并切换current，历史记录保留、默认只展示新版本。队列只有作者选标签，其他用户仅赞踩；配色跟随发布快照。预览标签和额度在隔离数据库，正式启用社区服务时必须与现行额度共用同一数据库，不能另造正式点数余额。

## 折扣日历原价与历史隔离（2026-10-26 用户确认）

- 载具卡片、科技树资料、购物车展示及合计始终使用资料原价；金鹰使用常规GE价，礼包使用整包常规人民币原价。活动售价和历史价格采集不得覆盖载具原价或改变购物车合计。
- 历史观测及已记录最低独立展示，通过“历史价格”查看实际价格记录与趋势；不在购物车加入活动价选择、正在优惠／目标价筛选或目标价设置。历史数据读取失败不影响原价展示与合计。

- 2026-10-26 标签选择器修订：外层“队列标签／官方称号”两个分类默认收起，点击分类才展开文案；样式独立按需展开。单标签可直接替换，多标签可点击移除。超级管理员拥有全部可用标签样式，不受游戏绑定、等级或RB次数限制；普通用户沿用等级解锁。稳定构成ID all-ge／mixed-ge 的文案分别为“金鹰队列／金银混合”，保留服务端自动判定。后台新增、删除和恢复文案，按队列／载具指定范围；删除仅退出新选择，保留历史文案ID、累计次数与已发布快照。公开文案使用匿名SHA版本索引和不可变内容对象，核对字节数和哈希，缓存隔离在wt-public-resources-v1；新提交必须重新验证现行文案与样式权限。

- 2026-10-26 标签表单组件再次修订：外层仅展示已确认标签列表，点击字段打开编辑弹层；弹层使用独立本地草稿，文案为纯文字列表、样式另选，确认才触发onChange，取消／Esc保持原值并恢复焦点。相同值确认不产生变更。文案只按“队列标签／官方称号”两类，取消细分分组；队列文案扩至49条，稳定ID保留。手机全屏编辑，采用VisualViewport高度/偏移适配键盘，单一内容滚动区，头部退出与底部取消/确认保持可达。验收页首屏展示带两条演示标签的真实表单字段。

- 2026-10-26 嵌套弹层：共享Modal的cancel事件须停止冒泡，科技树全局键盘快捷键在存在dialog[open]时让给弹层，Esc只关闭最上层。保留编辑草稿取消语义和关闭后焦点回到表单字段。

- 2026-10-26 标签表单更新：队列可选标签最多5个（系统构成标签另计）；样式先于文案常驻选择框，只分基础标签（含官方原版）与等级标签。文案使用互斥手风琴、平滑展开收起并遵循减少动态效果偏好，移除重复效果预览。确认回填与取消保留规则不变。
