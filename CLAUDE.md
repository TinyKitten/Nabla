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
- `apps/proxy/` — a tiny Node http server on `:5174` that holds the App Store Connect API key (the browser must not see it) and fetches ratings from the JP App Store. Vite's `server.proxy` forwards `/api/*` to it, so the front-end always calls same-origin URLs.

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

**3. Chat is wired to a local OpenClaw gateway.**
`src/hooks/useChat.ts` POSTs the conversation (with a small system prompt) to `/api/chat`, which the proxy forwards to OpenClaw's OpenAI-compatible `POST /v1/chat/completions` (`http://127.0.0.1:18789` by default, bearer token in `OPENCLAW_GATEWAY_TOKEN`). The reply is read from the SSE stream (`data: {choices:[{delta:{content}}]}` chunks, terminated by `data: [DONE]`) and appended to the AI message in real time. The bearer token never reaches the browser; only the proxy holds it. `setToolConnected('openclaw', …)` updates `ToolsBadge` based on whether the call succeeded.

Two things still run client-side without going through OpenClaw:
- `タスク追加 X` / `add task: X` short-circuits to `addLocalTask()` and skips the model call.
- A small `detectWidget()` regex on the user input drives the AI message's `widget` field so the matching widget auto-attaches (天気/評価/フィードバック/パフォーマンス/タスク/時計). The text itself comes from OpenClaw — only the widget hint is local.

Stopping a streaming reply aborts the underlying `fetch` via `AbortController`, so the proxy's relay loop also closes.

Most `WIDGET_DEFS[type].fetch()` are stubbed and return mock data with light randomness. The connected fetchers live in `apps/web/src/data/`:

- **weather** → `/api/weather` → `apps/proxy` → OpenWeather (current + forecast + reverse geocode). The browser only sends the user's lat/lon; the API key stays server-side.
- **storeRating** → `/api/store-rating` → `apps/proxy` → iTunes Lookup against the JP storefront for headline numbers + App Store Connect Customer Reviews API for trend / breakdown / delta. App Store only — Google does not expose aggregate ratings count/breakdown through any official API, and scraping is out of scope.
- **feedback** → `/api/feedback` → `apps/proxy` → GitHub Issues in the private `TrainLCD/Issues` repo, filtered by the `🙏 Feedback` label. The proxy fetches one 100-item page; the response's `hasMore` reflects the `Link: rel="next"` header (the widget renders "100+" / "99+" when truncated). GitHub items have no rating, so `stars: 0` and the widget hides the star row. The `unread` count is the number of GitHub items (parent issue #3 plans localStorage-based last-seen).
- **reviews** → `/api/reviews` → `apps/proxy` → App Store Connect Customer Reviews (text + title + reviewer + territory) and Google Play `androidpublisher` Reviews (text + author), merged by recency. Google Play *is* used here because the per-review API returns text, unlike the missing aggregate ratings endpoint.
- **tasks** → `/api/tasks` → `apps/proxy` → Linear GraphQL for all open (`unstarted` / `started`) issues in the workspace, merged with localStorage local tasks + done overrides. The query is workspace-wide (not scoped to `viewer.assignedIssues`) because Nabla is a single-user tool — restricting to assignees would hide unassigned issues that the user is still tracking.

- **performance** → `/api/performance` → `apps/proxy` → Sentry. Single React Native project model: Sessions API (`crash_free_rate(session)` / `sum(session)` over `statsPeriod=7d&interval=1d`) supplies the crash-free rate, the sparkline, the day-over-day `delta`, and the latest 24h session count; a second sessions call with `query=session.status:abnormal` gives the ANR rate; the Events API with `avg(measurements.app_start_cold)` gives cold-start time (ms → s). Project slug → numeric ID is resolved on first call and cached for the proxy lifetime. When env is missing or Sentry fails, the proxy returns `sources.sentry: false`, the widget keeps showing the skeleton, and `sentry` shows as disconnected in `ToolsBadge`.

The tasks fetcher merges Linear and local entries into a single list. Local tasks are persisted under `nabla.tasks.v1` in `localStorage` (records with stable ids). Done state is stored two ways: for `local:` ids it lives on the record itself; for `linear:` ids it's a per-issue override map (Linear write-back is intentionally out of scope). Mutations dispatch a `nabla-tasks-changed` `CustomEvent` on `window`, which the tasks instance of `useWidget` listens to so the widget refreshes immediately after a chat-driven add.

The chat path itself now goes through OpenClaw (see point 3 above), but the widgets still fetch directly. The eventual plan, per the design intent, is to expose each widget's data as an OpenClaw / MCP tool so the agent can fetch and reason over it. Until each widget moves over, anything *not* under `src/data/` that looks like an API call is a `setTimeout`.

**4. Tool connection state.**
`apps/web/src/state/toolConnections.ts` is a `useSyncExternalStore`-backed module keyed by MCP tool name. Keys today: `openWeather`, `appStoreConnect`, `googlePlayConsole`, `github`, `linear`, `sentry`. `ToolsBadge` derives its count and per-tool dot colors from this store, and real data fetchers in `apps/web/src/data/` are responsible for calling `setToolConnected(name, true|false)` on success / failure. The proxy endpoints return per-source flags (e.g. `sources.appStore`, `sources.googlePlay`, `sources.github`, `sources.linear`, `sources.sentry`) and the client fetcher mirrors them into the store. Add a new key here only when an actual connection lands.

## Component map (only the non-obvious parts)

- `WidgetShell` (in `Widgets.tsx`) owns all widget chrome: title row, hover-revealed drag indicator, the `more` menu (refresh / pin / delete), and a global "only one menu open at a time" enforcement via a `widget-menu-open` `CustomEvent` on `window`. The menu is portalled with `position: fixed` so it can escape `overflow: hidden` parents (the pinned strip's horizontal scroller in particular).
- `WidgetGrid` and `PinnedStrip` both render `<Widget>` and pass `dragHandleProps`. The whole widget surface is the drag handle (no separate handle icon — the user explicitly rejected the grid-icon variant).
- `MessageRow` renders inline widgets when an AI reply has a `widget` field. Inline widgets are themselves draggable into the pinned strip via `application/x-inline-type`, but only if the type isn't already pinned (otherwise a "ピン済み" badge shows and drag is disabled).
- `TweaksPanel` has a built-in floating toggle button — the design tool's host-message protocol was stripped during the port, so it activates itself.

## Conventions

- **Strict TypeScript.** All `.ts` / `.tsx`, `apps/web/tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`; the proxy uses an equivalent `apps/proxy/tsconfig.json`. Shared types live in `apps/web/src/types.ts`. Window augmentations (the `__dragging*` globals) are in `apps/web/src/global.d.ts`; Vite env-var typing lives in `apps/web/src/vite-env.d.ts` (currently empty — there are no client-side env vars).
- **Inline styles, not CSS-in-JS.** Theming is via CSS variables defined in `apps/web/src/styles/base.css` (`--accent`, `--ink`, `--bg-elev`, etc.) plus `[data-theme="dark"]` overrides. Don't pull in styled-components / Tailwind / CSS modules.
- **Oxlint with default rules only.** `apps/web/.oxlintrc.json` is intentionally near-empty (just `$schema` + `ignorePatterns`). **Do not add plugins or `rules` overrides without explicit user agreement.** A previous setup added react-perf / unicorn / jsx-a11y plugins and then needed many `"off"` overrides to silence false positives — that churn is what we're avoiding.
- **Japanese UI strings.** Most user-facing copy is Japanese. Match the existing tone (です/ます). Code comments and identifiers stay English.
- **Don't restore removed variants.** `variant-d`, `variant-e`, `layout-timeline`, `layout-workbench`, `design-canvas` from the original design bundle were intentionally not ported.
- **Local secrets in root `.env.local`.** All keys are proxy-only — nothing ships to the browser. Current keys: `OPENWEATHER_API_KEY`, `APP_STORE_CONNECT_*`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH`, `GITHUB_TOKEN`, `LINEAR_API_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`, `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`. The proxy reads `.env.local` via Node's `--env-file`; Vite still reads it via `envDir: '../../'` for any future client-side flag, but no `VITE_*` secret is currently used. Missing key → the widget shows skeleton (or, for tasks, only the local list) and the relevant tool stays disconnected; that's the intended fallback, not a bug.
- **Branch naming.** Use the full word `feature/` (not `feat/`) as the prefix for feature branches — e.g. `feature/issue-1-weather`. Same expectation likely applies to other prefixes (`fix/`, `chore/`).
- **PR assignee.** When opening a PR, assign it to `@TinyKitten` (pass `--assignee TinyKitten` to `gh pr create`). This is a single-maintainer repo; assignment makes the PR show up on the author's dashboard.
- **Keep the PR description in sync with the diff.** Whenever new commits are pushed to an existing PR (or its scope shifts), update the PR body with `gh pr edit <num> --body ...` so the description always reflects what's actually in the PR. Don't let description and diff drift apart.
