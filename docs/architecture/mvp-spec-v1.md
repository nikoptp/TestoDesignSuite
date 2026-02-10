# MVP Spec v1

## Scope
Desktop-only, single-user game design tool with three core modules:
- Noteboard (canvas cards)
- Storyboard/Story (documents + presentation view)
- Map editor (sketch workflow)

## Information Architecture
- Node-based tree structure.
- Each node selects an editor type at creation time.
- Nodes can be nested to multiple levels.
- Sub-nodes are rendered under parent nodes in one navigation tree.

## Module Specs

### 1) Noteboard
- Canvas-based workspace.
- Card primitives:
  - text card
  - image card
  - link card
  - mixed media card (text + image/link)
- Core interactions:
  - create card quickly (double-click / shortcut)
  - drag and reposition cards
  - edit card inline
  - delete/archive card

### 2) Storyboard/Story
- Multi-document long-form writing.
- Rich text editor optimized for fast typing first, formatting second.
- Story presentation mode:
  - scene/slide sequence
  - linear playback/navigation
  - intended for "movie script / pitch deck" style storytelling

### 3) Map Editor
- Sketchbook-style 2D editor for fast ideation.
- v1 tools:
  - freehand drawing
  - shape placement
  - note annotations on map
- v1 excludes simulation/play mode and triggerbox logic.

## Attachments and Embedded Content
- Supported in MVP:
  - images
  - sound files
  - links
- Storage strategy:
  - metadata in JSON documents
  - binary files stored in app project asset folders
  - JSON references use relative paths

## Persistence Model
- JSON-first local persistence.
- Suggested structure:
  - `data/projects/<project-id>/project.json`
  - `data/projects/<project-id>/documents/*.json`
  - `data/projects/<project-id>/assets/images/*`
  - `data/projects/<project-id>/assets/audio/*`
- Autosave required for all core editors.

## Out of Scope (Explicit)
- Global search
- Cloud sync / collaboration
- Custom category system
- Map simulation/prototype mode

## First Implementation Slices
1. App shell with node-based tree navigation and nested children. (Implemented)
2. JSON project load/save service in main process + preload bridge. (Implemented)
3. Noteboard card editor with basic card CRUD. (Implemented)
4. Story document editor with multiple documents.
5. Story presentation mode prototype.
6. Map editor sketch tools (draw/shapes/notes).
