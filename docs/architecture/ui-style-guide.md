# UI Style Guide

## Glass Surface Language

Use the shared glass tokens from `src/index.css` for container surfaces:

- `--glass-surface-bg`
- `--glass-surface-bg-soft`
- `--glass-surface-border`
- `--glass-surface-shadow`
- `--glass-surface-blur`

### When to use

- Primary editor shells, sidebars, dialogs, and major content containers use the primary glass surface.
- Secondary cards/inputs/embedded panels use the soft glass surface.
- Dense canvases (for example noteboard drawing layer itself) should remain crisp and avoid heavy blur.

### Contrast and readability

- Keep body text and code text at high contrast over glass (`var(--app-text)` foreground baseline).
- Avoid stacking multiple heavy-blur layers directly on top of each other in small regions.
- Terminal and code-like surfaces can use translucent backgrounds but must preserve legibility first.

### Motion and interaction

- Hover/active states should modify border tint and background mix values, not replace the glass system.
- Keep interaction cues clear: focus rings and selected states must remain distinct against blur.

### Theming

- Theme overrides should tune only token values; component selectors should reuse shared tokens.
- New themes must define all glass tokens to avoid fallback mismatches.
