# Testing Plan v1

## Goals
- Prevent regressions in packaged builds.
- Validate cross-process behavior (main/preload/renderer).
- Cover high-risk workflows: project lifecycle, persistence, canvas interactions, and theme import/export.

## Test Pyramid

### 1) Unit Tests (Fast, high volume)
- Target:
- `src/features/app/app-model.ts` pure sanitizers/parsers.
- `src/shared/tree-utils.ts` tree mutation helpers.
- `src/features/theme/theme-schema.ts` token validation and limits.
- `src/renderer/persistence-guards.ts` persisted payload guards.
- Add cases for:
- invalid/partial settings payloads
- max-limit edges (themes/templates/token overrides)
- malformed project/theme JSON
- tree deletion and descendant cleanup

### 2) Hook/Controller Tests
- Target:
- `use-tree-actions`
- `use-theme-studio-controller`
- `use-project-lifecycle`
- `use-noteboard-global-events`
- `use-document-editor-actions`
- Add assertions for:
- history push only on effective mutations
- theme creation at max limit (no dangling draft id)
- autosave debounce behavior
- keyboard shortcuts (`Ctrl/Cmd+Z`, `Delete`, `Tab` draw toggle)

### 3) Main Process Integration Tests
- Run Electron main in test mode with temp `userData`.
- Validate:
- image save/list/delete paths resolve under `userData/workspace`
- project bundle open/save/new semantics
- `applyProjectBundle` null behavior clears previous tree/settings files
- custom theme import/export schema guards
- `testo-asset://` path traversal rejection

### 4) End-to-End UI Tests (Packaged-focused)
- Use Playwright for Electron.
- Core flows:
1. Create nodes, rename/delete, restart app -> state restored.
2. Noteboard card create/drag/resize/copy/paste/delete + undo/redo.
3. Paste image/link/text to canvas and verify persisted asset references.
4. Theme Studio create/edit/import/export, relaunch, verify token application.
5. File menu new/open/save/save-as with `.testo`, verify status messages.

### 5) Packaged Build Smoke Suite
- Per-OS matrix: Windows first, then macOS/Linux.
- Validate on packaged binary:
- first launch, create/edit/save cycle
- write permissions (no install-dir writes)
- project open/save with larger image payloads
- protocol asset loading and missing-file handling

## Recommended Tooling
- Test runner: Vitest (unit/hook/integration).
- UI/E2E: Playwright (Electron mode).
- Temporary filesystem isolation per test:
- set `app.setPath('userData', tempDir)` in test harness.
- CI artifacts:
- upload failing E2E screenshots/videos and `.testo` bundle fixtures.

## Coverage Priorities
- P0:
- project file open/save/new
- autosave + restore
- noteboard destructive actions + undo/redo
- theme import/export + runtime apply
- P1:
- document editor quick actions
- image sidebar drag/drop
- protocol security edge cases
- P2:
- visual-regression snapshots for key screens

## CI Pipeline
1. `npm run lint`
2. Unit + hook tests
3. Main-process integration tests
4. Electron E2E smoke tests
5. Nightly packaged build smoke on all target OSes

## Exit Criteria
- All P0 tests automated and enforced in CI.
- No direct writes outside `userData` in packaged runs.
- Known regressions reproduce via tests before fixes and pass after fixes.
