# TestoDesignSuite
Desktop-first game design workspace built with Electron, React, and TypeScript.

## Current Capabilities
- Node-based project tree with nested nodes and per-node editor types.
- Noteboard canvas with:
- text/image/link cards
- drag, resize, multi-select, marquee selection
- duplicate, copy/paste, delete, undo/redo
- wheel zoom and middle-mouse pan
- drawing layer (pen/brush/eraser, brush presets, opacity/size, clear ink)
- Document editor for non-noteboard node types with:
- markdown edit + preview
- quick formatting toolbar
- table-of-contents sidebar
- starter templates (GDD, quest spec, lore entry, level brief)
- Local persistence and autosave for tree and settings.
- Project file workflow from app menu:
- `New Project`
- `Open Project File...` (`.testo`)
- `Save Project File` / `Save Project File As...`
- Theme system with base themes and Theme Studio custom token overrides (import/export supported).
- Project image asset library with drag/drop integration.

## Tech Stack
- Electron Forge + Webpack
- React 19 + TypeScript
- Motion (`motion/react`) for UI transitions
- `react-markdown` + `remark-gfm` for document rendering

## Development
- Install: `npm install`
- Start app: `npm start`
- Lint: `npm run lint`
- Tests: `npm test`
- Package app: `npm run package`
- Build distributables: `npm run make`

## Runtime Data Locations
- Tree state: `<userData>/data/tree-state.json`
- User settings: `<userData>/data/user-settings.json`
- Automatic backups: `<userData>/data/backups/*.bak`
- Project image assets: `<userData>/workspace/project-assets/images/*`

## Architecture Docs
- System notes: `docs/architecture/system-notes.md`
- Agent architecture reference: `docs/architecture/agent-architecture-reference.md`
- Agent change checklist: `docs/architecture/agent-change-checklist.md`
- Testing plan: `docs/architecture/testing-plan-v1.md`
