# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nabla is a **personal, single-user** frontend AI assistant tool. Not a product, not multi-tenant, not deployable. Treat it like a dotfile. Avoid adding generalisation, configuration surface, or abstractions that only make sense for multi-user software.

The visual design originated as a Claude Design (claude.ai/design) prototype that was iterated extensively, then ported here. The bundle exported several layout variants (workbench/timeline/variant-d/variant-e/design-canvas); only the merged "ChatLayout" was kept. If you find references to those names in chat history, ignore them — the code does not.

## Commands

```bash
npm run dev          # vite dev server on :5173
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint (oxlint defaults, no plugin overrides)
npm run lint:fix     # oxlint --fix
```

There are no tests. Don't propose adding a test framework unless asked.

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

**3. `useChat` is fake.**
`src/hooks/useChat.ts` matches user input against `QUICK_REPLIES` (regex intent detection: 天気/評価/フィードバック/パフォーマンス/ウィジェット追加), runs simulated tool calls with timeouts, then character-streams the canned reply. There is no model call. `WIDGET_DEFS[type].fetch()` is also stubbed — it returns mock data with light randomness on each refresh.

The eventual plan, per the design intent, is an MCP-style tool layer ("OpenClaw") wired in behind the chat. Until then, anything that *looks* like an API call is a setTimeout.

## Component map (only the non-obvious parts)

- `WidgetShell` (in `Widgets.tsx`) owns all widget chrome: title row, hover-revealed drag indicator, the `more` menu (refresh / pin / delete), and a global "only one menu open at a time" enforcement via a `widget-menu-open` `CustomEvent` on `window`. The menu is portalled with `position: fixed` so it can escape `overflow: hidden` parents (the pinned strip's horizontal scroller in particular).
- `WidgetGrid` and `PinnedStrip` both render `<Widget>` and pass `dragHandleProps`. The whole widget surface is the drag handle (no separate handle icon — the user explicitly rejected the grid-icon variant).
- `MessageRow` renders inline widgets when an AI reply has a `widget` field. Inline widgets are themselves draggable into the pinned strip via `application/x-inline-type`, but only if the type isn't already pinned (otherwise a "ピン済み" badge shows and drag is disabled).
- `TweaksPanel` has a built-in floating toggle button — the design tool's host-message protocol was stripped during the port, so it activates itself.

## Conventions

- **Strict TypeScript.** All `.ts` / `.tsx`, `tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`. Shared types live in `src/types.ts`. Window augmentations (the `__dragging*` globals) are in `src/global.d.ts`.
- **Inline styles, not CSS-in-JS.** Theming is via CSS variables defined in `src/styles/base.css` (`--accent`, `--ink`, `--bg-elev`, etc.) plus `[data-theme="dark"]` overrides. Don't pull in styled-components / Tailwind / CSS modules.
- **Oxlint with default rules only.** `.oxlintrc.json` is intentionally near-empty (just `$schema` + `ignorePatterns`). **Do not add plugins or `rules` overrides without explicit user agreement.** A previous setup added react-perf / unicorn / jsx-a11y plugins and then needed many `"off"` overrides to silence false positives — that churn is what we're avoiding.
- **Japanese UI strings.** Most user-facing copy is Japanese. Match the existing tone (です/ます). Code comments and identifiers stay English.
- **Don't restore removed variants.** `variant-d`, `variant-e`, `layout-timeline`, `layout-workbench`, `design-canvas` from the original design bundle were intentionally not ported.
- **Branch naming.** Use the full word `feature/` (not `feat/`) as the prefix for feature branches — e.g. `feature/issue-1-weather`. Same expectation likely applies to other prefixes (`fix/`, `chore/`).
