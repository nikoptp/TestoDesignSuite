# Custom Theme System Plan

## Goals
- Let users create and save custom themes safely.
- Keep built-in themes as stable presets.
- Apply custom tokens at runtime without changing app code.
- Support import/export for sharing themes.

## Data Model (Phase 1 complete scaffolding)
- `UserSettings.customThemes[]` stores user-defined themes.
- A custom theme includes:
  - `id`, `name`
  - `baseTheme` (preset to inherit from)
  - `tokens` (CSS variable overrides)
  - `createdAt`, `updatedAt`
- Validation/sanitization exists in settings load path.

## Runtime Token Resolution (Phase 2)
- Build `resolveThemeTokens(activeTheme, customThemes)`:
  - start from preset tokens
  - merge selected custom overrides
  - validate final set
- Apply tokens via `document.documentElement.style.setProperty(...)`.
- Keep `data-theme` for preset identity and CSS fallback behavior.

## Theme Selection UX (Phase 3)
- In Settings:
  - add `Theme Source` selector:
    - Preset theme
    - Custom theme
  - list custom themes with duplicate/rename/delete actions
- Persist selected custom theme id in settings.

## Theme Editor UX (Phase 4)
- Add in-app Theme Editor panel:
  - grouped tokens (app/chrome/accents/canvas)
  - color pickers for color-like tokens
  - text input for advanced tokens
  - live preview and reset actions
- Save as new custom theme or update existing.

## Import/Export (Phase 5)
- Export one theme to JSON.
- Import JSON with:
  - schema version check
  - strict sanitization
  - id conflict handling

## Safety and Compatibility
- Keep max limits on:
  - number of custom themes
  - number of token overrides
  - token name/value length
- Unknown tokens are ignored.
- Invalid values are dropped, not applied.
- Future migration path:
  - add `themeFormatVersion`
  - migration function on load.

