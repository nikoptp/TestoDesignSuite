# MVP Spec v1

## Scope
Desktop-only, single-user game design workspace with:
- node-based organization
- noteboard canvas
- markdown document authoring
- local-first persistence and project files

## Information Architecture
- Tree-based node hierarchy (`CategoryNode[]`) with unlimited nesting.
- Editor type chosen at node creation time.
- Shared per-node workspace data in `nodeDataById`.

## Implemented Modules

### 1) Noteboard (Implemented)
- Canvas cards with text/image/link content paths.
- Card interactions: create, edit, drag, resize, delete, duplicate.
- Selection model: single, ctrl/cmd multi-select, marquee rectangle.
- Camera model: pan + zoom with world bounds and adaptive grid.
- Clipboard flows:
- internal copy/paste of selected cards
- system clipboard text/image paste into cards
- image drop/paste persisted to project assets
- Drawing layer:
- pen/brush/eraser
- brush styles, size, opacity, preset colors
- stroke persistence per node

### 2) Document Editor for Non-Noteboard Nodes (Implemented)
- Non-noteboard editor types currently map to shared markdown editor.
- Edit + preview modes with split-pane resize in edit mode.
- Formatting quick-actions (headings, list, checklist, quote, code).
- Template insertion (GDD, quest spec, lore entry, level brief).
- Generated table-of-contents for markdown headings.

## Attachments and Embedded Content
- Implemented:
- image assets (project asset library + drag/drop)
- links and markdown content
- Not implemented:
- audio asset workflows

## Persistence Model (Current)
- Tree state: `<userData>/data/tree-state.json`
- User settings: `<userData>/data/user-settings.json`
- Backup snapshots: `<userData>/data/backups/*.bak`
- Project image assets: `<userData>/workspace/project-assets/images/*`
- Autosave in renderer for tree + settings.
- Menu-driven project bundle import/export (`.testo`) includes:
- tree state
- user settings
- embedded project images (base64 in bundle)

## Out of Scope (Current)
- Cloud sync / multi-user collaboration
- Global cross-project search
- Audio pipeline
- Simulation/prototype gameplay mode
