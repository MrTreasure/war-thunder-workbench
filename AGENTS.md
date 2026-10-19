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
- Place `CreatorFooter` inline at the right of the existing research-tree
  explanatory row, and in the lineup help row. Use the supplied QMuse logo and
  invite link. Never add a separate full-width footer beneath the application.
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
