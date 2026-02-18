# TestoDesignSuite

TestoDesignSuite is a desktop-first game design workspace built with Electron, React, and TypeScript. It combines a hierarchical project tree, a visual noteboard canvas, and markdown-based document editing in one app.

## Highlights

- Nested node tree for organizing game design content by feature/area.
- Noteboard canvas for spatial ideation with cards, drawing, and selection tools.
- Document editor with markdown preview, templates, and quick formatting tools.
- Local-first persistence with autosave and project file workflow (`.testo`).
- Theme Studio for custom UI token overrides (import/export supported).
- Project image asset library with drag and drop support.

## Current Features

### Project Tree
- Node-based project tree with nested nodes and per-node editor types.
- App menu workflow:
  - `New Project`
  - `Open Project File...` (`.testo`)
  - `Save Project File`
  - `Save Project File As...`

### Noteboard
- Text, image, and link cards.
- Drag, resize, multi-select, and marquee selection.
- Duplicate, copy/paste, delete, and undo/redo.
- Wheel zoom and middle-mouse pan.
- Drawing layer with pen/brush/eraser, brush presets, opacity/size, and clear ink.

### Document Editor
- Markdown editing with live preview.
- Quick formatting toolbar.
- Table of contents sidebar.
- Starter templates:
  - GDD
  - Quest spec
  - Lore entry
  - Level brief

### Persistence
- Autosave for tree and settings.
- Automatic backups.

## Tech Stack

- Electron Forge + Webpack
- React 19 + TypeScript
- Motion (`motion/react`) for UI transitions
- `react-markdown` + `remark-gfm` for markdown rendering

## Getting Started

### Requirements
- Node.js 20+ (recommended)
- npm 10+

### Local Development

```bash
npm install
npm start
```

### Quality Checks

```bash
npm run lint
npm test
```

### Packaging

```bash
npm run package
npm run make
```

## Runtime Data Paths

- Tree state: `<userData>/data/tree-state.json`
- User settings: `<userData>/data/user-settings.json`
- Backups: `<userData>/data/backups/*.bak`
- Project image assets: `<userData>/workspace/project-assets/images/*`

`<userData>` is Electron's app-specific user data directory.

## Architecture References

- `docs/architecture/system-notes.md`
- `docs/architecture/agent-architecture-reference.md`
- `docs/architecture/agent-change-checklist.md`
- `docs/architecture/testing-plan-v1.md`
- `docs/architecture/public-release-followups.md`
- `docs/features/feature-map.md`

## Licensing

This project is licensed under `Apache-2.0`. See `LICENSE` for details.
