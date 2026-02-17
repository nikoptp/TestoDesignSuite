# AI Prototype Module

This folder keeps the paused BYOK AI prototype code for future reactivation.

Current app build has this module disconnected on purpose.

## Main-process prototype entry
- `main-byok.ts`
- Exposes `registerByokAiPrototypeIpc(...)` for AI IPC channels.

## Renderer prototype entry
- `settings-panel.tsx`
- Contains the archived BYOK settings UI section used in the temporary prototype.

To re-enable later:
1. Register the IPC module from `src/index.ts`.
2. Restore preload/global bridge methods.
3. Restore renderer UI wiring (settings panel or dedicated AI panel).
