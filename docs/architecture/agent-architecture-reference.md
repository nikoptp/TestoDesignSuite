# Agent Architecture Reference

## Purpose
This document is the code-first architecture map for AI/code agents.  
Use this before making cross-cutting changes.

## Runtime Boundaries
- Main process: `src/index.ts`
- Owns window lifecycle, application menu, filesystem persistence, `.testo` project bundle import/export, asset protocol registration, and privileged dialogs.
- Hosts external local Agent API server (`127.0.0.1`) for capabilities/docs/nodes access.
- Preload bridge: `src/preload.ts`
- Exposes typed and limited API on `window.testoApi`.
- Renderer: `src/renderer.ts` -> `src/mount.tsx` -> `src/app.tsx`
- Owns all UI state transitions and editor interactions.
- Shared contracts: `src/shared/*`
- Keep process-agnostic types/constants/helpers here.

## Feature Ownership Map
- App composition and global wiring:
- `src/app.tsx`
- `src/features/app/app-model.ts`
- `src/features/app/hooks/use-history-controller.ts`
- Project lifecycle and status:
- `src/features/project/hooks/use-project-lifecycle.ts`
- `src/features/project/hooks/use-project-status-controller.ts`
- Navigation/tree/settings actions:
- `src/features/navigation/hooks/use-tree-actions.ts`
- `src/features/navigation/hooks/use-settings-dialog-controller.ts`
- Noteboard domain behavior:
- `src/features/noteboard/hooks/*`
- Noteboard UI composition:
- `src/components/noteboard-canvas.tsx`
- `src/components/noteboard/*`
- Document editor behavior:
- `src/features/document/hooks/use-document-editor-actions.ts`
- `src/components/document-editor.tsx`
- Theme runtime and editor:
- `src/features/theme/hooks/use-theme-runtime.ts`
- `src/features/theme/hooks/use-theme-studio-controller.ts`
- `src/features/theme/theme-schema.ts`

## Canonical Data Flow
1. Renderer bootstraps defaults (`app-model`) and mounts `App`.
2. `useProjectBootstrap` loads persisted tree/settings/assets through `window.testoApi`.
3. UI mutations update in-memory React state.
4. Autosave hooks debounce and persist state/settings via preload IPC.
5. Main process writes JSON with backup-on-write.
6. File menu actions (`new/open/save/save-as`) operate through main process and emit status events back to renderer.

## Persistence Model (Authoritative)
- Tree state: `<userData>/data/tree-state.json`
- User settings: `<userData>/data/user-settings.json`
- Backups: `<userData>/data/backups/*.bak`
- Project image assets: `<userData>/workspace/project-assets/images/*`
- Project bundle file: `*.testo` (JSON bundle containing tree/settings/images)

## IPC Contract Inventory
- Request/response (`ipcRenderer.invoke`):
- `tree:load`, `tree:save`
- `settings:load`, `settings:save`
- `assets:save-image`, `assets:list-images`, `assets:delete-image`
- `themes:export-custom`, `themes:import-custom`
- Event channels:
- Main -> renderer:
- `project:request-snapshot`
- `menu:open-settings`
- `menu:project-status`
- Renderer -> main:
- `project:snapshot-response`
- Source of truth for renderer typings:
- `src/global.d.ts`
- External HTTP agent API contract:
- `docs/architecture/agent-api.md`

## Critical Invariants
- Do not call Node/Electron APIs directly in renderer components/hooks.
- Do not bypass `window.testoApi`; preload is the only renderer bridge.
- Do not use `window.prompt` / `window.alert` in renderer flows.
- Keep noteboard/document data under `PersistedTreeState.nodeDataById`.
- When importing project bundles:
- Null tree/settings means clear stale local files.
- Assets must stay under `userData/workspace/project-assets/images`.
- For theme token handling:
- sanitize unknown/unsafe token names and values.

## Agent Change Playbooks
- Add new persisted setting:
1. Extend `UserSettings` in `src/shared/types.ts`.
2. Add default + sanitizer + validator in `src/features/app/app-model.ts`.
3. Load/save through `useProjectBootstrap` and autosave hooks.
4. Expose editor control in relevant UI component/hook.
5. Add/extend tests in both contract and unit suites.
- Add new main-process capability:
1. Implement handler in `src/index.ts`.
2. Expose typed bridge method in `src/preload.ts`.
3. Update `src/global.d.ts`.
4. Use from renderer hook/controller.
5. Add API parity test coverage.
- Add new editor mode:
1. Extend `EditorType` and metadata in shared modules.
2. Route editor branch in `src/app.tsx`.
3. Add feature hooks/components.
4. Ensure persistence shape compatibility and guards.

## Fast Validation Commands
- `npm run lint`
- `npm run test:contracts`
- `npm run test:unit`
- `npm test`
