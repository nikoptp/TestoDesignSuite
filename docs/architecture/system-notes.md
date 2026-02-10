# System Notes

## Current Stack
- Electron Forge
- Electron + Webpack + TypeScript

## Application Shape
- Main process handles window lifecycle and privileged app actions.
- Preload script defines secure renderer bridge.
- Renderer process hosts the user interface.

## Design Constraints
- Desktop-first UX.
- Local-first data storage.
- Clear module boundaries between UI, domain logic, and storage.
