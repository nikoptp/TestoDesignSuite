# System Notes

## Current Stack
- Electron Forge + Webpack + TypeScript
- React 19 renderer (`src/app.tsx`, `src/components/*`, `src/features/*`)
- Markdown rendering via `react-markdown` + `remark-gfm`

## Application Shape
- Main process (`src/index.ts`) handles:
- window lifecycle + application menu
- secure file persistence for tree/settings with backup-on-write
- project file open/save/new (`.testo` bundle import/export)
- image asset storage + listing + deletion (`<userData>/workspace/project-assets/images`)
- custom theme import/export file dialogs
- `testo-asset://` protocol for safe image serving
- Preload script (`src/preload.ts`) exposes a typed IPC bridge on `window.testoApi`.
- Renderer (`src/renderer.ts` -> `src/mount.tsx`) mounts React app and feature hooks.

## Data Model Summary
- Tree data: `PersistedTreeState` with nested `CategoryNode[]`, selected node, and `nodeDataById` editor payloads.
- User settings: sidebar width, active theme/custom theme, drawing defaults, card templates.
- Node workspace payload:
- Noteboard data: cards, strokes, viewport transform.
- Document data: markdown string.
- Steam achievement data: batch entries, crop transforms, and border/background styling.
- Steam marketplace data: entry list, logo asset references, and per-preset output/crop/overlay state.

## Implemented Editor Behavior
- `noteboard` nodes render the canvas editor.
- `story-document` nodes render the markdown `DocumentEditor`.
- `kanban-board` nodes render the Kanban board editor.
- `spreadsheet` nodes render the spreadsheet editor.
- `steam-achievement-art` nodes render the Steam achievement export editor.
- `steam-marketplace-assets` nodes render the Steam marketplace asset editor.

## Steam Asset Pipeline
- Source images are stored in the project image asset workspace under `<userData>/workspace/project-assets/images`.
- The Steam achievement editor composes framed 256x256 output from project assets and can export paired color/grayscale PNG files.
- The Steam marketplace editor reuses project images plus optional logo assets to render multiple Steamworks-sized outputs with per-preset crop and overlay state.
- Export execution happens in the main process via IPC handlers for achievement-set and marketplace-asset export requests.

## Design Constraints
- Desktop-first UX.
- Local-first data storage.
- Strict main/preload/renderer boundaries.
- Keep reusable contracts in `src/shared/*`.
