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
- Feature hooks/controllers: `src/features/*`
- Renderer markup/styles: `src/index.html`, `src/index.css`
- Shared reusable modules: `src/shared/types.ts`, `src/shared/editor-types.ts`, `src/shared/tree-utils.ts`, `src/shared/noteboard-constants.ts`, `src/shared/pointer-session.ts`, `src/shared/noteboard-coordinate-utils.ts`, `src/shared/drag-payloads.ts`, `src/shared/project-file-migrations.ts`, `src/features/app/workspace-node-updaters.ts`, `src/features/noteboard/noteboard-dom-selectors.ts`
- Shared reusable hooks: `src/shared/hooks/use-outside-pointer-dismiss.ts`, `src/shared/hooks/use-global-keydown.ts`
- Legacy renderer modules: removed
- Build/config: `forge.config.ts`, `webpack.*.ts`, `tsconfig.json`, `.eslintrc.json`
- Runtime persistence:
- Tree state: `%APPDATA%/../Local/<app>/data/tree-state.json` (Electron `userData`)
- User settings: `%APPDATA%/../Local/<app>/data/user-settings.json` (Electron `userData`)
- Backups: `%APPDATA%/../Local/<app>/data/backups/*.bak`
- Project image assets: `%APPDATA%/../Local/<app>/workspace/project-assets/images/*`

## Development Commands
- Install deps: `npm install`
- Start app: `npm start`
- Lint: `npm run lint`
- Test: `npm test`
- Package app: `npm run package`
- Build distributables: `npm run make`

## Working Agreements
- Keep main/preload/renderer boundaries strict.
- Use TypeScript for all new source files.
- Prefer small, composable modules over monolithic files.
- Separate views and components into separate files when possible.
- Move reused functions into library files so they are easy to access across the application.
- For editors and interactive views, implement quick actions and action history by default where applicable (keyboard shortcuts, context actions, and undo/redo-safe mutations).
- Prefer shared interaction primitives for editor UX:
- Use `startWindowPointerSession` for pointer drag/resize sessions (`pointermove` + `pointerup`/`pointercancel` + body class cleanup).
- Use `useOutsidePointerDismiss` for outside-click dismissal patterns (context menus, popovers, selection sidebars).
- Use `useGlobalKeydown` for window-level keyboard shortcuts instead of ad-hoc `keydown` listeners.
- Use `noteboard-coordinate-utils` for center/world/viewport conversions to keep zoom/pan math consistent.
- Use `drag-payloads` helpers/constants for cross-surface drag data (`tree node` and `image asset` payloads) instead of hardcoded MIME strings.
- Use `workspace-node-updaters` to mutate `nodeDataById` slices (`noteboard` / `kanban`) to reduce repeated immutable boilerplate.
- Use `noteboard-dom-selectors` constants for blocked interaction selectors to keep pointer/cursor/drop logic aligned across hooks.
- Run lint before finalizing code changes.
- Avoid destructive git commands unless explicitly requested.

## Refactor Playbook
- Extract shared logic when a pattern appears in 3+ places or crosses feature boundaries.
- Extract shared logic when behavior must stay identical across surfaces (pointer flow, keyboard shortcuts, drag payloads, selectors).
- Keep extracted modules narrow and composable; avoid creating monolithic "god helpers".
- Prefer pure utilities for deterministic transforms and hooks for lifecycle/event wiring.

## Shared Primitives Index
- Pointer sessions: `src/shared/pointer-session.ts`
- Outside dismiss hook: `src/shared/hooks/use-outside-pointer-dismiss.ts`
- Global keydown hook: `src/shared/hooks/use-global-keydown.ts`
- Noteboard coordinates: `src/shared/noteboard-coordinate-utils.ts`
- Drag payloads/contracts: `src/shared/drag-payloads.ts`
- Project-file migrations: `src/shared/project-file-migrations.ts`
- Workspace node-data updaters: `src/features/app/workspace-node-updaters.ts`
- Noteboard interaction selectors: `src/features/noteboard/noteboard-dom-selectors.ts`

## State Update Rules
- For `nodeDataById` writes, use `workspace-node-updaters` (`updateNodeWorkspaceData`, `updateNodeNoteboardData`, `updateNodeKanbanData`) by default.
- If direct immutable updates are used instead, add a short code comment explaining why helper usage is not appropriate.
- Preserve undo/redo semantics when refactoring state updates; never bypass history behavior inadvertently.

## DnD Contract
- Use drag MIME constants and payload helpers from `src/shared/drag-payloads.ts`; do not hardcode custom MIME strings in components/hooks.
- Tree node drag data must use the shared tree payload helper.
- Image asset drag data must use the shared image payload helper.
- Keep payload shape changes backward-safe for any existing drop handlers.

## Selector Constants Rule
- Reused selector groups (blocked targets, ignored zones, interaction boundaries) must live in shared selector modules.
- For noteboard interactions, prefer `src/features/noteboard/noteboard-dom-selectors.ts` constants over inline selector strings.
- When adding new blocked/allowed zones, update selector constants first and then adopt at call sites.

## Testing Requirement Per Extraction
- Any new shared utility/hook requires unit tests in `test/unit`.
- Extraction refactors must preserve existing behavior; add regression tests when touching interaction contracts.
- Minimum validation for shared extraction changes: `npm run lint` and `npm run test:unit`.

## Performance Guardrails
- Pointer move handlers should minimize allocations and avoid unnecessary state writes.
- Prefer early returns in high-frequency handlers (`pointermove`, `wheel`, `dragover`) when no meaningful work is needed.
- Global listeners must always be cleaned up in effect teardown.
- Keep selector checks and hit-tests centralized and cheap in hot paths.

## Definition Of Done
- Shared logic extracted to the right layer (utility vs hook vs feature module).
- Call sites updated consistently with no drift in behavior.
- Lint and relevant tests pass.
- `AGENTS.md` updated (index + changelog) when conventions or shared primitives change.

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
- Agent architecture reference: `docs/architecture/agent-architecture-reference.md`
- Agent change checklist: `docs/architecture/agent-change-checklist.md`
- Testing strategy: `docs/architecture/testing-plan-v1.md`

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
- 2026-02-17: Documentation refreshed after repository scan; README and architecture/feature docs now reflect implemented project file workflows, theme studio, image assets, and current editor/runtime behavior.
- 2026-02-22: Extracted shared pointer session helper (`src/shared/pointer-session.ts`) and refactored sidebar resize, document splitter resize, and noteboard template drag to use it.
- 2026-02-22: Added shared interaction hooks (`use-outside-pointer-dismiss`, `use-global-keydown`) and applied them to app/noteboard/kanban outside-click and keyboard shortcut flows.
- 2026-02-22: Added shared noteboard coordinate utilities (`src/shared/noteboard-coordinate-utils.ts`) and refactored wheel/context/clipboard center calculations to use shared conversions.
- 2026-02-22: Added `src/shared/drag-payloads.ts` and refactored tree/image/canvas drag-and-drop to use shared MIME constants + payload helpers.
- 2026-02-22: Added `src/features/app/workspace-node-updaters.ts` and refactored kanban + noteboard state writes to reduce duplicated `nodeDataById` immutable update boilerplate.
- 2026-02-22: Added `src/features/noteboard/noteboard-dom-selectors.ts` and refactored noteboard hooks to consume centralized blocked-target selector constants.
- 2026-02-22: Expanded AGENTS governance with refactor playbook, shared primitive index, state/DnD/selector rules, extraction testing requirements, performance guardrails, and definition-of-done checklist.
- 2026-02-23: Added spreadsheet editor phase-1 foundation: new `spreadsheet` node type, persisted spreadsheet workspace data, formula/addressing utilities, React spreadsheet grid editor with selection/editing/formula bar/copy-paste, and unit coverage for spreadsheet helpers.
- 2026-03-10: Reduced active editor types to `noteboard`, `kanban-board`, `spreadsheet`, and `story-document`; removed legacy unimplemented editor type references.
- 2026-03-10: Added persisted tree-state migration primitive (`src/shared/project-file-migrations.ts`) with schema version stamping and legacy editor-type normalization for backward compatibility.
- 2026-03-10: Added compatibility regression coverage (`test/unit/project-file-migrations.test.ts`) to guard older project files from breaking on updates.
- 2026-03-10: Added GitHub tag-based release workflow (`.github/workflows/release.yml`) and release playbook (`docs/release/github-release-v0.1.0.md`).

## Open Questions
- Single-window only for MVP, or multi-window support early?
- Offline-first sync planned for MVP or later phase?
