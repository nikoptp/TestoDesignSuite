# Kanban MVP Implementation Checklist

## Scope
- [x] Confirm MVP requirements and interactions
- [x] Keep personal-first UX and lightweight UI
- [x] Keep architecture compatible for future team flows

## Data Model
- [x] Add `kanban-board` to `EditorType`
- [x] Add Kanban types (`KanbanColumn`, `KanbanCard`, `KanbanPriority`) to shared types
- [x] Add node-local Kanban payload in `NodeWorkspaceData`
- [x] Add optional shared global backlog payload to `PersistedTreeState`
- [x] Ensure migrations preserve existing project files

## State Helpers
- [x] Add Kanban defaults (Backlog, To Do, Doing, Done)
- [x] Add `ensureKanbanData` normalization helper
- [x] Add helpers for reading board + shared backlog from state
- [x] Add helpers for move/reorder/create/migrate operations to reduce app component complexity

## Persistence Validation
- [x] Extend `isPersistedTreeState` / `isNodeWorkspaceData` guard for Kanban payloads
- [x] Add contract coverage for Kanban state shape acceptance/rejection

## UI + UX
- [x] Add `KanbanBoard` React component
- [x] Render Kanban editor when selected node has `editorType === 'kanban-board'`
- [x] Minimal card UI with `#taskNumber` + title
- [x] Priority border colors: gray/yellow/orange/red
- [x] Column CRUD with fully custom columns
- [x] Default template columns on board creation
- [x] Double-click empty column area creates new card
- [x] Drag/drop card reordering within and across columns

## Shared Backlog Rules
- [x] Treat Backlog as global shared pool across Kanban boards
- [x] Show shared backlog cards in every board Backlog column
- [x] Ensure cards exist in one board at a time except shared Backlog behavior

## Migration Flow
- [x] Add top toolbar `Migrate` button in Kanban editor
- [x] Show target board selector when other boards exist
- [x] Move all non-completed cards to selected board
- [x] Completion rule: cards in column named exactly `Done`
- [x] Keep Backlog cards unaffected by migrate action

## Integration
- [x] Add Kanban to create-node dialog via editor type options
- [x] Wire history snapshots for Kanban actions (`pushHistory` before mutations)
- [x] Keep autosave flow unchanged via shared state updates

## Testing + Validation
- [x] Add unit tests for Kanban helpers (normalization/move/migrate)
- [x] Add interaction contract checks for key keyboard/mouse hooks if needed
- [x] Run `npm run lint`
- [x] Run `npm run test:contracts`
- [ ] Manual sanity checks: create, drag, migrate, reopen project
