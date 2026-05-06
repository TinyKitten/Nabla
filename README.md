# Nabla

**A personal frontend AI assistant tool — built for one user (me).**

Nabla is not a product. It is a private, single-user assistant UI for keeping
the things I care about — the weather where I am, the App Store rating of
[TrainLCD](https://github.com/TrainLCD), unread feedback, crash-free rate,
today's tasks — one glance away from a chat window.

It is intentionally **not** designed to be multi-tenant, deployable, or shared.
Treat this repository as a personal dotfile rather than a piece of software
meant for general use.

## What's inside

A single-page React app with three zones:

- **Left rail** — minimal nav: logo, new chat, settings, avatar.
- **Center** — chat with streaming responses, simulated tool calls, shortcut
  chips, and a mic button that opens a voice-input overlay. A pinned widget
  strip sits above the conversation; it can be collapsed to just its title bar.
- **Right panel** — a grid of widgets in `sm` / `md` / `lg` sizes (weather,
  store rating, feedback, performance, tasks). Drag a widget into the pinned
  strip to keep it always-visible; drag from the strip back into the panel to
  unpin. On mobile, the panel slides in as an overlay.

A floating **Tweaks** button toggles light/dark mode and the accent color.

## Stack

- React 18 + Vite
- TypeScript (strict, project references)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) for fast linting
- Plain CSS variables (no CSS-in-JS, no Tailwind)
- HTML5 drag-and-drop for widget reordering and pinning
- Widget data is mocked client-side, **except weather** (browser-direct to
  OpenWeather using geolocation with a Tokyo Station fallback) and **store
  rating** (App Store Connect + Google Play, fetched via a tiny local proxy
  that holds the credentials so the browser never sees them). The remaining
  three — feedback, performance, tasks — are still mocked and will be wired up
  as Issues #3–#5 progress, eventually behind an MCP-style tool layer
  ("OpenClaw").
- Header `ToolsBadge` reflects which MCP tools are actually connected via a
  small `useSyncExternalStore` in `apps/web/src/state/toolConnections.ts`.
  Today: `openWeather`, `appStoreConnect`, `googlePlay`.

## Running it

```bash
npm install
npm run dev          # web on http://localhost:5173, proxy on :5174 (concurrent)
npm run build        # builds both apps/web and apps/proxy
npm run typecheck    # tsc -b --noEmit on both
npm run lint         # oxlint (web only)
npm run lint:fix     # oxlint --fix
```

The repo is a small `npm` workspaces monorepo:

- `apps/web/` — the Vite + React UI (the only thing you see in the browser).
- `apps/proxy/` — a tiny Node http server on `:5174` that holds API keys the
  browser must not see. Vite forwards `/api/*` to it.

All secrets live in **one** root `.env.local` (Vite reads it via
`envDir: '../../'`, the proxy via `node --env-file`):

```env
# browser-direct (Vite exposes anything VITE_*-prefixed)
VITE_OPENWEATHER_API_KEY=...

# proxy-only — never bundled into the client
APP_STORE_CONNECT_KEY_ID=...
APP_STORE_CONNECT_ISSUER_ID=...
APP_STORE_CONNECT_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXXX.p8
APP_STORE_CONNECT_APP_ID=...
GOOGLE_PLAY_PACKAGE_NAME=me.tinykitten.trainlcd
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=./keys/play-service-account.json
```

Missing keys → the affected widget shows a skeleton and the header reports the
relevant tool as disconnected. That's the intended fallback, not a bug.

## Origin

The visual design was prototyped in [Claude Design](https://claude.ai/design)
through extended back-and-forth iteration, then handed off and ported here as
a real React app. The full design conversation lives in the design tool, not
in this repo.

## Status

Personal, in-progress. Two widgets (weather, store rating) are connected to
real sources; the other three are still mocked. Expect rough edges and
opinionated decisions that only make sense for me.
