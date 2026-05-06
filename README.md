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
- Widget data is mocked client-side, **except weather** which now hits the
  OpenWeather API directly using browser geolocation (with a Tokyo Station
  fallback). The other four widgets — store rating, feedback, performance,
  tasks — are still mocked and will be wired up as Issues #2–#5 progress,
  eventually behind an MCP-style tool layer ("OpenClaw").
- Header `ToolsBadge` reflects which MCP tools are actually connected via a
  small `useSyncExternalStore` in `src/state/toolConnections.ts`. Today only
  OpenWeather flips to "connected" once the first fetch succeeds.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
npm run lint:fix     # oxlint --fix
```

To enable the live weather widget, drop a free
[OpenWeather](https://openweathermap.org/api) API key into `.env.local`:

```env
VITE_OPENWEATHER_API_KEY=...
```

Without it, the weather widget shows a skeleton and the header reports
OpenWeather as disconnected — that's the intended fallback.

## Origin

The visual design was prototyped in [Claude Design](https://claude.ai/design)
through extended back-and-forth iteration, then handed off and ported here as
a real React app. The full design conversation lives in the design tool, not
in this repo.

## Status

Personal, in-progress. Most widgets still show mocked data; weather is the
first to be connected to a real source. Expect rough edges and opinionated
decisions that only make sense for me.
