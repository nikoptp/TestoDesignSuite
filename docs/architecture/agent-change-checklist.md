# Agent Change Checklist

## Before Editing
- Read:
- `AGENTS.md`
- `docs/architecture/agent-architecture-reference.md`
- `docs/architecture/system-notes.md`
- Confirm target layer:
- Main (`src/index.ts`)
- Preload (`src/preload.ts`)
- Renderer/features/components (`src/features/*`, `src/components/*`)
- Shared contracts (`src/shared/*`)

## During Editing
- Keep process boundaries strict.
- Prefer small hook/helper edits over growing `src/app.tsx`.
- Reuse existing sanitizers/validators in `src/features/app/app-model.ts` and `src/features/theme/theme-schema.ts`.
- Preserve userData workspace paths for persisted assets.
- Avoid destructive git commands and unrelated file churn.

## Mandatory Checks by Change Type
- IPC/API changes:
- Update `src/preload.ts`
- Update `src/global.d.ts`
- Add/adjust `test/api-contracts.test.js`
- Persistence changes:
- Validate backup/write semantics in `src/index.ts`
- Add/adjust `test/persistence-workflow-contracts.test.js`
- Theme changes:
- Validate limits/sanitization paths
- Add/adjust `test/unit/theme-import-state.test.ts` and/or `test/unit/theme-runtime.test.tsx`
- History/interaction changes:
- Validate shortcut and undo/redo behavior
- Add/adjust `test/interaction-contracts.test.js` and `test/unit/history-stack.test.ts`

## Test Execution Sequence
1. `npm run lint`
2. `npm run test:contracts`
3. `npm run test:unit`
4. `npm test`

Notes:
- In restricted environments, `test:unit` may require elevated execution due to esbuild worker spawn.

## Release Readiness Gate
- No direct writes outside `userData` for runtime data.
- No renderer usage of `window.prompt` / `window.alert`.
- IPC contracts remain typed and in sync.
- New behavior has at least one automated test.
