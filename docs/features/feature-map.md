# Feature Map

## Implemented Features
- Node tree with nested nodes and per-node editor type selection.
- Noteboard canvas:
- text cards + markdown-style content
- image and link card creation flows
- drag/resize, multi-select, marquee selection
- duplicate/copy/paste/delete with undo/redo
- pan + zoom with adaptive world grid
- Drawing mode on noteboard:
- pen/brush/eraser
- brush presets, size, opacity, color presets
- per-node stroke persistence and erase interaction
- Document editor for all non-noteboard node types:
- markdown edit/preview
- toolbar quick formatting actions
- template insertion (GDD, quest, lore, level brief)
- generated table of contents
- Spreadsheet editor (phase 1):
- 50x26 grid with cell selection and keyboard navigation
- formula bar and cell edit mode
- formula evaluation (`+ - * /`, refs, `SUM/AVG/MIN/MAX`, cycle/error states)
- single-cell copy and range paste (TSV/plain text)
- Theme system:
- built-in themes
- custom theme overrides (token-based Theme Studio)
- custom theme import/export
- Image asset pipeline:
- save/list/delete project images via main process
- project-local workspace storage in `<userData>/workspace/project-assets/images`
- menu and canvas integration for assets
- Project lifecycle actions from File menu:
- new/open/save/save-as project files (`.testo`)
- project status messages in UI

## Planned / Partial Features
- Spreadsheet editor phase 2 (multi-sheet workflows, structural row/column ops, import/export).
- Expanded behavior-test coverage for controllers/hooks (current tests are mostly style/theme guards).

## Deferred Features
- Global search.
- Multi-user collaboration and cloud sync.
- User-defined custom categories.
- Audio attachment workflow.
- Map simulation/prototype mode (trigger logic/playthrough systems).

## Open Product Questions
- What minimum audio support is required for MVP+1 (formats, preview UX, storage limits)?
- How far should template systems go (node templates, project templates, importable bundles)?
