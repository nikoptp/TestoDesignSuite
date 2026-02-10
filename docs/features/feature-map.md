# Feature Map

## Confirmed Features
- OneNote-style noteboard for fast note capture and organization.
- Story-focused editor for long-form narrative and lore writing.
- 2D map editor for level design/blockout workflows.
- Game-specific content model (not generic notes only).
- Support for images, sound files, and links in notes/documents.
- Node-based workspace where each node has an editor type and can be nested under another node.
- Single-user local-first MVP (no sync in MVP).
- User-defined grouping via nested nodes in MVP.
- JSON-based local persistence in MVP.

## Candidate Features
- Rich text editing with fast default input flow.
- Per-category editor layouts and interaction patterns:
  - Noteboard
  - Story
  - Lore
  - Maps
  - Levels
- Storyboard as a dedicated view/module (named as must-have by product owner).
- Story presentation mode similar to slides/powerpoint for narrative flow.

## Deferred Features
- Global search.
- Multi-user collaboration and cloud sync.
- User-defined custom categories.
- Paper prototype mode in map editor (playthrough simulation + triggerboxes linked to story/lore/items).

## Open Product Questions
- Finalize category names and each category's exact content schema.
- Decide how rich text customization is exposed (toolbar-first, slash commands, shortcuts, or mixed).
- Define category/subcategory default set for initial release.
- Define minimum attachment handling for sound files (preview/playback behavior and allowed formats).

## MVP Must-Haves (Locked)
- Noteboard
- Storyboard/Story writing workflow
- Map editor

## Interaction Decisions (Locked)
- Noteboard uses cards on a canvas.
- Story module includes:
  - Long-form document editor with multiple documents.
  - Script-like presentation mode for story flow.
- Map editor v1 behaves like a sketchbook for fast iteration:
  - drawing
  - shape placement
  - note annotations
- Node hierarchy supports multiple nested levels.
- Sub-nodes are shown under their parent in a single tree view.
