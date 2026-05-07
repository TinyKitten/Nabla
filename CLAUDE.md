# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nabla is a **personal, single-user** frontend AI assistant tool. Not a product, not multi-tenant, not deployable. Treat it like a dotfile. Avoid adding generalisation, configuration surface, or abstractions that only make sense for multi-user software.

The visual design originated as a Claude Design (claude.ai/design) prototype that was iterated extensively, then ported here. The bundle exported several layout variants (workbench/timeline/variant-d/variant-e/design-canvas); only the merged "ChatLayout" was kept. If you find references to those names in chat history, ignore them — the code does not.

## Commands

```bash
npm run dev          # concurrently runs Vite (web :5173) and the proxy (:5174)
npm run build        # builds both apps/web and apps/proxy
npm run typecheck    # tsc -b --noEmit on both workspaces
npm run lint         # oxlint on apps/web (oxlint defaults, no plugin overrides)
npm run lint:fix     # oxlint --fix on apps/web
```

Per-workspace overrides are available via `npm run <script> -w @nabla/web` / `-w @nabla/proxy`.

There are no tests. Don't propose adding a test framework unless asked.

## Workspace layout

`npm` workspaces, two apps:

- `apps/web/` — the Vite + React UI (everything that used to be at the repo root). `index.html`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `src/` all live here.
- `apps/proxy/` — a tiny Node http server on `:5174` that holds the App Store Connect API key (the browser must not see it) and aggregates ratings across all Apple storefronts. Vite's `server.proxy` forwards `/api/*` to it, so the front-end always calls same-origin URLs.

The web Vite config sets `envDir: '../../'` so both apps read the same root `.env.local`. Don't move secrets into `apps/web/.env.local` — they'd get bundled into the client.

## Architecture

The app is one screen. Top-level state lives in `src/components/ChatLayout.tsx`, which threads everything through props. Three things matter:

**1. Two widget buckets, mirrored by type.**
- `pinned` — the horizontal strip above the chat (small, always visible).
- `widgets` — the right-side widget panel grid (mixed `sm` / `md` / `lg`).

Pinning a widget from the grid adds a *mirror* to `pinned`; it does **not** remove it from the grid (the grid tile then shows a `PinnedBadge`). Conversely, unpinning removes from `pinned` and re-adds to the grid only if no widget of that type is already there.

Duplicate prevention is **by widget `type`, not `id`** — there can only ever be one weather widget pinned. The `pinWidget` / `acceptInlineToPin` paths both check this.

**2. HTML5 drag-and-drop with three custom MIME types.**
The drop target inspects `dataTransfer.types` to decide what to do:

| MIME | Source | Effect on drop into pinned strip |
| --- | --- | --- |
| `application/x-pinned-id` | a pinned widget being reordered | reorder within strip |
| `application/x-widget-id` | a widget from the grid panel | mirror it into strip (`pinWidget`) |
| `application/x-inline-type` | an inline widget rendered in a chat message | add new pinned entry of that type |

`dataTransfer.getData()` is empty during `dragover` for security reasons, so widget *type* is also stashed on `window.__draggingGridWidgetType` / `__draggingInlineWidgetType` to drive the "blocked / already pinned" hover state. Don't try to read values from `dataTransfer` during `dragover`; it won't work.

The grid panel itself is also a drop target — dropping a pinned widget there unpins it.

**3. `useChat` is fake — mostly.**
`src/hooks/useChat.ts` matches user input against `QUICK_REPLIES` (regex intent detection: 天気/評価/フィードバック/パフォーマンス/ウィジェット追加), runs simulated tool calls with timeouts, then character-streams the canned reply. There is no model call. Each canned `text` can be a static string or an async function — the `weather` reply is the latter and pulls from `getCachedWeather()` / `fetchWeather()` so it stays in sync with what the widget shows.

Most `WIDGET_DEFS[type].fetch()` are stubbed and return mock data with light randomness. The connected fetchers live in `apps/web/src/data/`:

- **weather** → OpenWeather, browser-direct.
- **storeRating** → `/api/store-rating` → `apps/proxy` → iTunes Lookup across ~155 Apple storefronts for headline numbers + App Store Connect Customer Reviews API for trend / breakdown / delta. App Store only — Google does not expose aggregate ratings count/breakdown through any official API, and scraping is out of scope.
- **feedback** → `/api/feedback` → `apps/proxy` → three sources merged into a single `FeedbackEntry[]` (sorted by recency, each entry tagged with `source: 'github' | 'appStore' | 'googlePlay'`):
  - **GitHub Issues** in the private `TrainLCD/Issues` repo, filtered by the `🙏 Feedback` label. The proxy fetches one 100-item page; the response's `hasMore` reflects the `Link: rel="next"` header (the widget renders "100+" / "99+" when truncated). GitHub items have no rating, so `stars: 0` and the widget hides the star row.
  - **App Store Connect Customer Reviews** (text + title + reviewer + territory).
  - **Google Play `androidpublisher` Reviews** (text + author). Google Play *is* used here because the per-review API returns text, unlike the missing aggregate ratings endpoint.
  - The `unread` count is the number of GitHub items only — store reviews have no unread concept (parent issue #3 plans localStorage-based last-seen for the GitHub side).

`performance` and `tasks` are still mocked (Issues #4 / #5).

The eventual plan, per the design intent, is an MCP-style tool layer ("OpenClaw") wired in behind the chat. Until each widget moves over, anything *not* under `src/data/` that looks like an API call is a `setTimeout`.

**4. Tool connection state.**
`apps/web/src/state/toolConnections.ts` is a `useSyncExternalStore`-backed module keyed by MCP tool name. Keys today: `openWeather`, `appStoreConnect`, `googlePlayConsole`, `github`. `ToolsBadge` derives its count and per-tool dot colors from this store, and real data fetchers in `apps/web/src/data/` are responsible for calling `setToolConnected(name, true|false)` on success / failure. The proxy endpoints return per-source flags (e.g. `sources.appStore`, `sources.googlePlay`, `sources.github`) and the client fetcher mirrors them into the store. Add a new key here only when an actual connection lands.

## Component map (only the non-obvious parts)

- `WidgetShell` (in `Widgets.tsx`) owns all widget chrome: title row, hover-revealed drag indicator, the `more` menu (refresh / pin / delete), and a global "only one menu open at a time" enforcement via a `widget-menu-open` `CustomEvent` on `window`. The menu is portalled with `position: fixed` so it can escape `overflow: hidden` parents (the pinned strip's horizontal scroller in particular).
- `WidgetGrid` and `PinnedStrip` both render `<Widget>` and pass `dragHandleProps`. The whole widget surface is the drag handle (no separate handle icon — the user explicitly rejected the grid-icon variant).
- `MessageRow` renders inline widgets when an AI reply has a `widget` field. Inline widgets are themselves draggable into the pinned strip via `application/x-inline-type`, but only if the type isn't already pinned (otherwise a "ピン済み" badge shows and drag is disabled).
- `TweaksPanel` has a built-in floating toggle button — the design tool's host-message protocol was stripped during the port, so it activates itself.

## Conventions

- **Strict TypeScript.** All `.ts` / `.tsx`, `apps/web/tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`; the proxy uses an equivalent `apps/proxy/tsconfig.json`. Shared types live in `apps/web/src/types.ts`. Window augmentations (the `__dragging*` globals) are in `apps/web/src/global.d.ts`; Vite env-var typing (e.g. `VITE_OPENWEATHER_API_KEY`) is in `apps/web/src/vite-env.d.ts`.
- **Inline styles, not CSS-in-JS.** Theming is via CSS variables defined in `apps/web/src/styles/base.css` (`--accent`, `--ink`, `--bg-elev`, etc.) plus `[data-theme="dark"]` overrides. Don't pull in styled-components / Tailwind / CSS modules.
- **Oxlint with default rules only.** `apps/web/.oxlintrc.json` is intentionally near-empty (just `$schema` + `ignorePatterns`). **Do not add plugins or `rules` overrides without explicit user agreement.** A previous setup added react-perf / unicorn / jsx-a11y plugins and then needed many `"off"` overrides to silence false positives — that churn is what we're avoiding.
- **Japanese UI strings.** Most user-facing copy is Japanese. Match the existing tone (です/ます). Code comments and identifiers stay English.
- **Don't restore removed variants.** `variant-d`, `variant-e`, `layout-timeline`, `layout-workbench`, `design-canvas` from the original design bundle were intentionally not ported.
- **Local secrets in root `.env.local`.** Both the browser-side keys (`VITE_OPENWEATHER_API_KEY`) and the proxy-only keys (`APP_STORE_CONNECT_*`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH`, `GITHUB_TOKEN`) live in the repo root's `.env.local`. The proxy reads it via Node's `--env-file`; Vite reads it via `envDir: '../../'`. Type any new client-side key in `apps/web/src/vite-env.d.ts`. Missing key → the widget shows skeleton and the relevant tool stays disconnected; that's the intended fallback, not a bug.
- **Branch naming.** Use the full word `feature/` (not `feat/`) as the prefix for feature branches — e.g. `feature/issue-1-weather`. Same expectation likely applies to other prefixes (`fix/`, `chore/`).
- **PR assignee.** When opening a PR, assign it to `@TinyKitten` (pass `--assignee TinyKitten` to `gh pr create`). This is a single-maintainer repo; assignment makes the PR show up on the author's dashboard.
- **Keep the PR description in sync with the diff.** Whenever new commits are pushed to an existing PR (or its scope shifts), update the PR body with `gh pr edit <num> --body ...` so the description always reflects what's actually in the PR. Don't let description and diff drift apart.
