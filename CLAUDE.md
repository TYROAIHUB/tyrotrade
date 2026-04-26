# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173/TYROInternationalTrade/
npm run build     # tsc -b (composite project typecheck) then vite build
npm run preview   # Serve the built dist
npm run lint      # tsc --noEmit (no separate ESLint configured)

python scripts/build-mocks.py   # Regenerate src/mocks/projects.ts from Excel
```

There is no test runner configured. `npm run lint` runs the TypeScript compiler in noEmit mode — that is the contract for "did I break anything."

## What this app is

TYRO International Trade ("tyrotrade") — a dashboard for Tiryaki's international commodity trade operations: buying grain / oilseed at one port, shipping it to another via vessel or truck, tracking budget vs. actuals across the voyage. Mirrors the data model of the Dynamics 365 F&O **TRYK Projeler** module (project header + vessel plan + project lines + cost estimate + actuals).

Sibling app **tyrostrategy** lives at `C:\Users\Cenk\Desktop\tyrostrategy-repo\tyrostrategy-app` and shares the brand palette (gold logo gradient `#c8922a → #e0ad3e`, "Blue Gradient" sidebar theme `#1e3a5f → #2a4f7f → #3b6ba5`, Plus Jakarta Sans). Keep these in sync — don't drift.

## Architecture

**Stack:** React 19 + TypeScript 5.7 + Vite 6 + Tailwind v4 (`@tailwindcss/vite`, `@theme` tokens in `src/globals.css` — no `tailwind.config.js`) + shadcn/ui new-york style + react-router 7 + TanStack Query + MapLibre GL via `react-map-gl/maplibre` + Turf for sea-route geometry.

Path alias: `@/*` → `src/*` (set in `vite.config.ts` and `tsconfig.app.json`).

### Routing model — GitHub Pages constraints

- `vite.config.ts` has `base: "/TYROInternationalTrade/"`. Every asset URL must respect `import.meta.env.BASE_URL`.
- `main.tsx` uses **HashRouter**, not BrowserRouter — this avoids the GH Pages 404.html dance and works under the sub-path.
- Routes are wrapped in `<AppShell>` (sidebar + topbar layout) except `/login` which is a standalone full-screen page. See `src/App.tsx`.

### The mock data pipeline (critical)

`src/mocks/projects.ts` is **auto-generated** (~1.6 MB, 437 projects). Do not edit it by hand. Workflow:

1. Source: `C:/Users/Cenk/Downloads/TRYK Projeler_639126704967068109.xlsx` (real F&O export, header rows only).
2. Generator: `scripts/build-mocks.py` reads the Excel, parses vessel names from project titles via regex (last `MV`/`MT` match wins — quantity markers like "30.000 MT" come earlier), infers ports + commodity + supplier from heuristic keyword matching, synthesizes milestone dates by mapping `(today - projectDate)` to a stage (at-loading / loading / in-transit / at-discharge / discharged), and writes the TS file.
3. Reference date: `TODAY = datetime(2026, 4, 25)` inside the script. Progress states are stable as long as this matches `useRouteProgress`'s default `now`.

When entity types in `src/lib/dataverse/entities.ts` change, **both** the script's TS emitter and the type definitions must be updated together, then re-run the script.

### Sea-route waypoint corridors

`src/lib/routing/seaRoute.ts` builds a `LineString` from origin → optional waypoints → destination using `@turf/great-circle` for each segment. **Never use a single great-circle pair for routes that cross continents** — it cuts across land. Instead, projects supply explicit waypoints through known maritime corridors. The reusable corridors live in `scripts/build-mocks.py` (`ARG_TO_GULF`, `BRAZIL_TO_GULF`, `BLACK_SEA_TO_MED`, `MED_TO_SUEZ`, `SUEZ_TO_GULF`, `TURKEY_TO_EGYPT`) and are emitted as part of each project's `vesselPlan.waypoints`. New routes need a waypoint list that hugs straits/canals (Bosphorus, Gibraltar, Suez, Hormuz, Bab-el-Mandeb).

### Route progress logic

`src/lib/routing/progress.ts` maps `VesselMilestones` + `VesselStatus` + `now` → `progress` (0..1) and a `stage` label. The animated vessel marker on the map uses `@turf/along` keyed by `progress * totalKm`. The completed segment of the route is `lineSliceAlong(line, 0, completedKm)`.

### Map paint colors must be hex/rgba — not OKLCH

MapLibre's paint validator rejects `oklch(...)` in `line-color` / `fill-color`. Use hex or `rgba()` for any `<Layer paint={{...}}>` value, even though the rest of the codebase uses OKLCH for CSS.

### Map tooltips and Radix portals

Radix `<Tooltip>` rendered as a child of `<Marker>` from `react-map-gl` will throw — Marker mounts via portal and breaks the TooltipProvider context chain. For marker hover text, use the native HTML `title` attribute. Tooltips on map controls (zoom buttons in the corner glass panel) work fine because they render inline.

### Glass / brand design tokens

All glass surfaces and brand colors are CSS classes in `src/globals.css`:

- `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-noise` — light frosted surfaces (white-tinted)
- `.sidebar-dark` — blue gradient sidebar surface (mirrors tyrostrategy's "Blue Gradient" theme)
- `.text-gold-gradient` — used for the "trade" half of the wordmark and accent text
- `.text-prism-gradient`, `.text-warm-gradient` — alt gradients (still defined; default trade wordmark uses gold)
- CSS custom props: `--tyro-gold`, `--tyro-gold-light`, `--tyro-blue-deep/dark/mid/light`

The wordmark is always lowercase: "tyro" (black on light, white on dark) + "trade" (gold gradient). See `src/components/brand/Wordmark.tsx` and `Logo.tsx`. The `Logo` accepts an `onDark` prop but currently uses the same all-gold palette regardless — kept for API symmetry with the sibling app.

### Sidebar behavior

`src/components/layout/sidebar-context.tsx` tracks `pinned` (persisted in `localStorage` under `tyro:sidebar:pinned`) and `hovering`. Effective expanded state = `pinned || hovering`. Mouse enter/leave on the sidebar slot in `AppShell.tsx`'s `DesktopSidebarSlot` component drives `hovering` with a 180ms close delay to avoid flicker. The pin button in the sidebar header toggles `pinned`. Mobile uses a shadcn `Sheet` drawer instead of hover.

### Phasing / project plan

The end-to-end plan (Phase A scaffold → Phase H Copilot Studio embed) lives at `C:\Users\Cenk\.claude\plans\web-uygulamas-yapaca-m-mobil-gentle-coral.md`. Currently complete: A (scaffold + glass + dashboard) and B (MapLibre + sea routes + animated marker). Pending: C (real-data integration when user provides full schema), D (MSAL login + tyro-interactive-login Globe), E (real Dataverse / D365 F&O client — see "Veri erişimi" section in the plan for the three options), F (Dashboard polish), G (Data Management CRUD), H (Copilot Studio chat widget).

## Conventions specific to this repo

- Turkish + English mix is intentional (UI labels Turkish, code English). Don't translate either way without being asked.
- The user prefers to drive the browser preview themselves. Don't run `preview_screenshot` / `preview_eval` for verification unless explicitly asked.
- When changing brand colors, update `globals.css` tokens — don't hardcode hex values in component files. Existing hardcoded references (sidebar gradient stops in `.sidebar-dark`, logo SVG fills) are intentional copies of the tyrostrategy palette and should match exactly.
