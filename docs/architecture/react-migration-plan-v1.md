# React Migration Plan (v1)

## Goal
Migrate the renderer from imperative DOM updates to React + TypeScript without breaking existing desktop behavior.

## Current rollout status
- React dependencies are installed.
- TypeScript supports JSX via `react-jsx`.
- Renderer bootstrap is React-only by default.
- Legacy renderer module has been removed.
- React navigation slice is active (tree + node dialogs + sidebar resize).
- React noteboard slice is active:
  - card CRUD and text editing
  - single/multi selection
  - drag movement and world clamping
  - wheel zoom and middle-mouse pan
  - context-menu create-card
  - internal copy/paste and keyboard delete

## Migration phases
1. Foundation
- Keep existing preload/main IPC contracts unchanged.
- Define a shared React state layer around existing state shapes (`PersistedTreeState`, `UserSettings`).
- Add integration tests/smoke checks for renderer boot and persistence.

2. Navigation slice (completed)
- Sidebar layout, tree rendering, node selection, rename, create dialog, and delete dialog migrated to React.
- Parity checks still needed for keyboard controls, selection behavior, and persisted state edge cases.

3. Noteboard slice (completed)
- Noteboard rendering and interactions migrated:
  - card CRUD
  - selection/multi-select/marquee
  - drag, pan, zoom, context menu
  - copy/paste, duplicate, delete, undo/redo
- Preserve world bounds and persistence format (verified against current schema).

4. Stabilization (active)
- Run full lint/package checks and manual regression checklist.
- Add focused tests around noteboard interactions and persistence snapshots.
- Continue extracting reusable logic into shared library modules where duplication appears.

## Safety constraints
- Do not change persisted JSON schema during migration.
- Keep main/preload boundary unchanged.
- Preserve keyboard shortcuts and pointer interactions.
- Ship in small slices with feature parity checks after each slice.

## Suggested next implementation task
Add React-focused regression coverage (tree operations, dialog flows, noteboard interaction edge cases) and tighten module boundaries for reusable utilities.
