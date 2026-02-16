# App Orchestrator Overhaul Plan

## Objective
- Break the current god-orchestrator pattern in `src/app.tsx` while keeping behavior stable.
- Reduce coupling between UI shells, domain logic, and side effects.
- Create clear module boundaries that support easier testing and lower regression risk.

## Current Findings To Address
1. `App` is a god-orchestrator with too many responsibilities (`src/app.tsx`).
2. `NoteboardCanvas` has a very wide prop contract and mixed concerns (`src/components/noteboard-canvas.tsx`).
3. Theme validation/sanitization logic is duplicated across renderer model, theme schema, and main process.
4. `onImportCustomTheme` uses fragile external mutable flags around state updaters.
5. Tests are mostly CSS/style guards; core behavior hooks have minimal direct coverage.

## Target Architecture

### 1) Thin App Shell
- `App` should only:
  - wire top-level providers/composed controllers
  - render layout shells
  - route selected node/editor mode
- Move orchestration into focused controllers/hooks.

### 2) Feature Controllers
- Introduce top-level controllers:
  - `useAppController` (global wiring only)
  - `useThemeStudioController`
  - `useProjectStatusController`
  - `useHistoryController`
  - `useSettingsDialogController`
- Each controller owns a narrow state/action surface and returns typed view-models.

### 3) Noteboard Boundary Split
- Split `NoteboardCanvas` into:
  - `NoteboardViewport` (world transform, grid, pointer entry points)
  - `NoteboardCardsLayer` (cards render/edit/select)
  - `NoteboardDrawingLayer` (strokes + draw cursor)
  - `NoteboardContextMenus` (canvas/card/quick-color/template menus)
  - `NoteboardToolPanels` (draw/template/image sidebars)
- Replace long callback lists with grouped action props:
  - `cardActions`, `drawActions`, `templateActions`, `clipboardActions`.

### 4) Shared Theme Contracts
- Create shared module(s), e.g.:
  - `src/shared/theme-contract.ts`
- Move to a single source of truth:
  - `isAppTheme`
  - token key/value validation rules
  - import/export payload schema guards
  - token limits/constants.
- Main/renderer/theme schema all import this contract.

### 5) Deterministic State Update Patterns
- Remove side-channel mutation in state updaters.
- For async actions (import/export/theme edits):
  - compute next state in pure helper
  - apply once
  - derive UI/status events from explicit result object.

### 6) Test Pyramid Expansion
- Keep current CSS guards.
- Add behavior tests for:
  - project lifecycle hooks
  - tree actions
  - noteboard clipboard/card actions
  - theme studio import/export/token changes.
- Add contract tests for shared theme validation used by both main and renderer.

## Phase Plan

## Phase 0: Baseline and Safety Nets
- Add architecture checkpoints and measure:
  - `app.tsx` lines, `NoteboardCanvas` props count, hook test coverage.
- Add smoke test checklist for:
  - noteboard edit/drag/resize
  - theme apply/import/export
  - settings save/load
  - project open/save/new.

Exit criteria:
- Baseline metrics recorded in this doc.
- Manual smoke checklist documented and repeatable.

## Phase 1: Extract Theme + Settings Controllers
- Create `useThemeStudioController`:
  - create/rename/delete/edit/import/export
  - status messaging
  - deterministic result objects.
- Create `useSettingsDialogController`:
  - draft values, open/cancel/save behavior.
- `App` consumes controller outputs instead of inline logic.

Findings addressed:
- #1, #3, #4.

Exit criteria:
- `app.tsx` shrinks by at least 20%.
- No inline theme-studio mutation logic remains in `App`.

## Phase 2: History and Project Status Controllers
- Extract history stack and snapshot application into `useHistoryController`.
- Extract transient status handling into `useProjectStatusController`.
- Unify status publishing for import/export/save/open/new.

Findings addressed:
- #1, #4.

Exit criteria:
- `App` no longer directly manages history stack refs or status timer mechanics.

## Phase 3: Noteboard Component Decomposition
- Split `NoteboardCanvas` into layers/panels/menus.
- Introduce grouped action interfaces and small focused prop surfaces.
- Keep current hook logic, but route through grouped interfaces.

Findings addressed:
- #2 (primary), #1 (secondary).

Exit criteria:
- `NoteboardCanvas` replaced by composed subcomponents.
- Top-level noteboard shell prop count reduced substantially.

## Phase 4: Shared Theme Validation Contract
- Implement `shared/theme-contract`.
- Remove duplicated validators from:
  - `src/index.ts`
  - `src/features/app/app-model.ts`
  - `src/features/theme/theme-schema.ts` (retain only UI grouping/edit schema).

Findings addressed:
- #3.

Exit criteria:
- Single import path for theme validation rules.
- Contract tests cover both import/export and settings load sanitization.

## Phase 5: Test Coverage Expansion
- Add unit tests per controller/hook.
- Add regression tests for deterministic update results (no mutable side-channel).
- Keep CSS tests as style guard layer.

Findings addressed:
- #5 (primary), #4 (secondary).

Exit criteria:
- Hook/controller test suite added and run by `npm test`.
- Critical interaction paths have at least one direct behavioral test each.

## Phase 6: Final Cleanup and Documentation
- Remove dead helpers and duplicate paths.
- Update architecture notes:
  - data flow diagram
  - state ownership map
  - extension guidelines for new features.

Exit criteria:
- No duplicate contracts for themes.
- `App` reads as shell/composition only.

## Proposed Ownership Map (Post-Overhaul)
- `App`: composition + top-level layout only.
- `features/project/*`: persistence lifecycle and project events.
- `features/theme/*`: theme runtime and theme studio controller.
- `features/noteboard/*`: domain behavior + subcomponent rendering layers.
- `features/navigation/*`: tree operations and node CRUD flows.
- `shared/*`: cross-process contracts/validation/types.

## Risks and Mitigations
- Risk: behavior regressions during large extraction.
  - Mitigation: phase-by-phase extraction with smoke checks and tests after each phase.
- Risk: temporary duplicate logic while migrating.
  - Mitigation: strict “remove old path in same phase” rule for migrated slices.
- Risk: over-abstraction.
  - Mitigation: controller boundaries must map to existing user-visible feature areas.

## Success Metrics
- `src/app.tsx` reduced to shell-level size target (< 500 lines).
- Noteboard shell prop count reduced by at least 40%.
- Theme validation logic has one authoritative source.
- `npm test` includes both style guards and behavior/controller tests.
