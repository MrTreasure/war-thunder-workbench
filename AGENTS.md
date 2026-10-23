# War Thunder Workbench

## 指令文件与站点约定（2026-10-23 更新）

- 本文件 `AGENTS.md` 是 Codex 的唯一项目指令入口；原 `AGENT.md` 规则已合并到本文件，不再维护第二份指令。`AGENT.md` 不得提交或上传，必须保持 Git 忽略。
- 正式站：`https://render.qmuse.pub/p/muse/8645013411493394`，只更新既有 QMuse 应用。
- 国际站：`https://wt.mrtreasure.cc/`，部署独立 Workers Static Assets，Worker 保持 `war-thunder-workbench` 原名。
- 禁止访问、部署、预览、重定向或新增链接到域名 `render.mrtreasure.cc`，包括任何子路径。上级或历史文档中的旧 Render 发布指令不适用于本项目。
- `deploy:qmuse` 用于正式站；`deploy:cf` 用于国际站。禁止运行旧 `deploy:preview`、`publish`、`release` 及共享 Render 发布流程；不得将其当作正式站或国际站的发布步骤。
- 验收使用用户明确授权的 QMuse 或国际站部署；尚未发布的本地构建不能宣称已在线。发布前保留构建、Git 版本及必要回滚材料。
- 国际站 SEO canonical 与 Web Analytics 继续对应 wt 域名；后台“页面分析”保持直达该站统计。
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

## 昵称与战报内容安全（2026-10-23 紧急要求）

- 查询昵称、返回昵称、战报自定义风格和生成文案必须经过服务端安全审核，覆盖涉政、色情、现实暴力、仇恨辱骂及提示词注入；正常游戏战斗术语不能仅因军事词汇被屏蔽。
- 缓存及历史战报不能绕过审核。审核失败或暂不可用时不展示未经审核内容，不回退到未审核的本机档案或内置玩家榜单。
- 战报风格服从服务端内容安全规则；AI 不应接收真实昵称作为可执行指令。后台实现仅保留本地，不复制到前端仓库或发布包。
