# War Thunder Workbench

- This is the canonical source for `/muse/war-thunder-trees/`. The old
  `../war-thunder-trees/` project is a legacy snapshot.
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
- Publish only this existing Muse route. Upload hashed JS/CSS/data before HTML,
  keep old hashed assets for open sessions, and back up entry files.

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
- Both pages share `PageNavigation` for 科技树 / 出击队列. Keep this navigation
  outside the tree's collapsible filter panel on every screen size. Categories
  are filters, not page links. Use menu.csv's mainmenu/* Simplified Chinese
  entries for category labels, with localization provenance in canonical JSON.
- Render `AppHeader` once in the shared `_workbench` route, outside the Outlet.
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

- User-facing previews mean the actual built app served by the existing Nginx
  URL `https://render.mrtreasure.cc/muse/war-thunder-trees/`. Use the checked
  build and existing `pnpm run publish` flow when preview deployment is requested.
  A LAN Vite URL or an image gallery does not satisfy this preview requirement.
  QMuse import still requires explicit confirmation.

- Preview performance: HTML stays `no-store`; hashed JS/CSS/font/country assets
  use `deploy/nginx-war-thunder-assets.inc` for immutable caching and precompressed
  gzip delivery, including proxied requests. Preserve old hashes on publication.
- Keep the lightweight file-route adapters eager with `codeSplitGroupings: []`
  to avoid a serial startup waterfall. Country payload imports must remain lazy.

- The redesigned route guide page is hidden by default. Only the exact outer
  query flag `guides=1` enables `#/maps` and its navigation entry; reject direct
  access without it. A root visit with this flag opens the guide page. Keep
  normal tree/lineup navigation unchanged and preserve the outer query flag.
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
