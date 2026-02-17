# Auto-Update Plan (GitHub Releases + Electron Forge)

## Goal
Ship safe, reliable app auto-updates using GitHub as source of truth for builds and releases.

## Current Baseline
- Build system: Electron Forge (`forge.config.ts`)
- Makers include Windows Squirrel (`MakerSquirrel`) and packaging targets
- Release handling target: GitHub Releases

## 1. Repository Metadata (Required)
1. In `package.json`, set:
- `repository` with correct `owner/repo`
- stable `name` and `productName`
- semantic `version` strategy
2. Keep repository public if using `update.electronjs.org` with `update-electron-app`.

## 2. Forge Publishing to GitHub Releases
1. Install publisher:
- `npm i -D @electron-forge/publisher-github`
2. Update `forge.config.ts`:
- import and configure `PublisherGithub`
- set `owner` and `name`
- start with `draft: true` for first pipeline runs

## 3. App-side Auto-update Wiring
1. Install runtime helper:
- `npm i update-electron-app`
2. Initialize in main process startup (`src/index.ts`):
- call `updateElectronApp(...)` once on app launch
3. First rollout behavior:
- check on startup
- periodic background checks
- prompt user to restart after download

## 4. Code Signing / Notarization (Before Public Release)
1. Windows:
- Authenticode signing certificate in CI secrets
2. macOS:
- Developer ID signing + notarization credentials in CI secrets
3. Add matching `packagerConfig` signing/notarization settings in Forge config.

## 5. GitHub Actions Release Workflow
1. Add `.github/workflows/release.yml`
2. Trigger on version tags (`v*`)
3. Matrix build:
- `windows-latest`
- `macos-latest`
4. Pipeline steps:
- `npm ci`
- `npm run lint`
- `npm test`
- `npm run publish` (Forge publish to GitHub Releases)
5. Use GitHub token and signing secrets from repo/org secrets.

## 6. Release Policy
1. Tag format:
- `vX.Y.Z`
2. Immutable assets:
- never replace/reupload binaries for an existing version
3. Channels:
- stable: normal releases
- beta: prereleases (`v1.2.0-beta.1`)
4. Maintain clear release notes and update expectations.

## 7. End-to-End Validation (Mandatory)
1. Install older public version (e.g. `v1.0.0`) on clean machine
2. Publish next version (`v1.0.1`)
3. Validate:
- update detection
- background download
- restart/apply flow
- version bump verified after restart
- user data preserved

## 8. Optional Hardening
1. Add updater telemetry/logging events
2. Add manual “Check for updates” UI action
3. Add staged rollout support if needed later

## Suggested Implementation Order
1. Repo metadata cleanup
2. Forge publisher config
3. Main-process updater wiring
4. CI release workflow
5. Signing/notarization
6. End-to-end validation run
