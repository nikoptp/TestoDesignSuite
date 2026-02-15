# AGENTS.md

## Project Snapshot
- Name: `TestoDesignSuite`
- Goal: Electron-based game design workspace with note-taking and organization features similar to OneNote.
- Tech stack: Electron Forge + Webpack + TypeScript.

## Current Structure
- Main process entry: `src/index.ts`
- Preload script: `src/preload.ts`
- Renderer entry: `src/renderer.ts`
- React app root: `src/app.tsx`
- React mount entry: `src/mount.tsx`
- React components: `src/components/*`
- Renderer markup/styles: `src/index.html`, `src/index.css`
- Shared reusable modules: `src/shared/types.ts`, `src/shared/editor-types.ts`, `src/shared/tree-utils.ts`
- Legacy renderer modules: removed
- Build/config: `forge.config.ts`, `webpack.*.ts`, `tsconfig.json`, `.eslintrc.json`
- User settings file (runtime): `%APPDATA%/../Local/<app>/data/user-settings.json` (Electron `userData`)

## Development Commands
- Install deps: `npm install`
- Start app: `npm start`
- Lint: `npm run lint`
- Package app: `npm run package`
- Build distributables: `npm run make`

## Working Agreements
- Keep main/preload/renderer boundaries strict.
- Use TypeScript for all new source files.
- Prefer small, composable modules over monolithic files.
- Separate views and components into separate files when possible.
- Move reused functions into library files so they are easy to access across the application.
- Run lint before finalizing code changes.
- Avoid destructive git commands unless explicitly requested.

## Known Renderer Pitfalls
- Do not use `window.prompt` / `window.alert` in renderer flows. Use in-app UI controls (modals, panels, inputs) instead.
- In delegated event handlers, always guard `event.target` with `instanceof Element` before calling DOM methods like `closest`.
- Prefer explicit, typed state-driven UI for node creation over browser dialog APIs.
- Do not nest editable inputs inside clickable `<button>` containers; render editable mode as a non-button container to avoid blocked typing/focus issues.

## Product Discovery Files
- Vision notes: `docs/vision/product-vision.md`
- Architecture notes: `docs/architecture/system-notes.md`
- MVP spec: `docs/architecture/mvp-spec-v1.md`
- Feature map: `docs/features/feature-map.md`

## Change Log
- 2026-02-10: Electron Forge project initialized and moved to repository root.
- 2026-02-10: Root project install verified (`npm install`, `npm run lint`, `npm start`).
- 2026-02-10: Implemented app shell with category/subcategory navigation and placeholder naming in renderer UI.
- 2026-02-10: Refactored navigation to nested node tree with editor-type-per-node creation flow.
- 2026-02-10: Fixed renderer click delegation bug caused by non-Element event targets when using `closest`.
- 2026-02-10: Removed unsupported `prompt()` dependency and replaced with sidebar editor-type selector UI.
- 2026-02-10: Added JSON tree persistence with `ipcMain` + preload bridge (`tree:load`, `tree:save`) and renderer bootstrap/autosave.
- 2026-02-10: Added node rename (inline) and delete with mandatory in-app confirmation dialog.
- 2026-02-10: Added Font Awesome icon library and switched node actions to compact icon buttons.
- 2026-02-10: Fixed rename input bug by moving edit input out of selectable button structure.
- 2026-02-10: Added resizable sidebar with drag handle + scrollbar, persisted to `user-settings.json` via preload/main IPC.
- 2026-02-10: Replaced top category dropdown with per-create category picker modal; node category is now represented by icons in the tree.
- 2026-02-10: Introduced reusable shared modules for types, editor metadata, and tree operations; renderer/main/preload now consume shared contracts.
- 2026-02-10: Split renderer UI into reusable component modules (layout, node-tree, dialogs) while keeping state/events centralized in `src/renderer.ts`.
- 2026-02-10: Updated rename UX: double-click node to rename, removed rename confirm buttons, commit rename on outside click.
- 2026-02-10: Implemented first Noteboard editor slice with per-node card CRUD (add/edit/delete) and JSON persistence via `nodeDataById`.
- 2026-02-10: Upgraded Noteboard to positioned canvas cards with drag movement and click-on-canvas card creation.
- 2026-02-10: Added Noteboard viewport interactions: wheel zoom, middle-mouse pan, and full-area grid canvas rendering.
- 2026-02-10: Refined Noteboard to full-bleed canvas view (title/type text removed) and grid moved to world coordinates so it stays aligned with pan/zoom.
- 2026-02-10: Migrated Noteboard to symmetric world bounds (negative coordinates supported) and clipped viewport rendering to prevent grid spill outside visible screen area.
- 2026-02-10: Removed aggressive noteboard camera reset behavior; camera now relies on clamping with visible world boundary markers.
- 2026-02-10: Added adaptive multi-level noteboard grid (minor/major lines) that scales by zoom to keep grid visibility when zooming out.
- 2026-02-10: Switched noteboard quick-create flow to a custom right-click context menu and refined card visuals/spacing for a more organic look.
- 2026-02-10: Added noteboard card selection model (single, ctrl multi, marquee rectangle), group drag movement for multi-selected cards, and duplicate-selected action.
- 2026-02-10: Added app-level command history snapshots with undo/redo shortcuts and internal noteboard copy/paste for selected cards.
- 2026-02-10: Added keyboard delete action for selected noteboard cards (`Delete`) with undo support.
- 2026-02-11: Added React renderer bootstrap with opt-in mode (`?ui=react` or `localStorage.testo.ui=react`) while keeping legacy renderer as default.
- 2026-02-11: Migrated navigation slice to React (tree view, rename, create/delete dialogs, sidebar resize, persistence load/save).
- 2026-02-11: Migrated core noteboard interactions to React (card CRUD, drag, pan, zoom, context create, selection, copy/paste, keyboard delete).
- 2026-02-11: Added React noteboard marquee selection rectangle and app-level undo/redo history shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`).
- 2026-02-11: Promoted React renderer files to `src` root (`src/app.tsx`, `src/mount.tsx`, `src/components/*`) and removed legacy renderer module.

## Open Questions
- Single-window only for MVP, or multi-window support early?
- Offline-first sync planned for MVP or later phase?
