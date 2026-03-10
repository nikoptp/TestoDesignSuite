# GitHub Release Workflow

## One-time setup
- Confirm workflow file exists: `.github/workflows/release.yml`.
- Confirm repository releases are enabled and Actions has permission to write release assets.
- Ensure repo slug is correct in app update config:
  - default fallback is `nikoptp/TestoDesignSuite`
  - optional override via `TESTO_UPDATE_REPO=<owner>/<repo>`

## Release checklist
1. Ensure local branch is clean and up to date.
2. Run `npm run lint`.
3. Run `npm run test:unit`.
4. (Recommended) Run local packaging smoke check:
   - `npm run make`
   - `npm run build:windows:custom-installer`
5. Commit any pending release changes.
6. Create and push tag:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
7. Verify GitHub Actions `Release` workflow completes and publishes both artifact sets.
8. Open the GitHub release page and review generated notes + attached files.

## CI workflow behavior
On tag push (`v*`), `.github/workflows/release.yml` does:
1. `npm ci`
2. `npm run lint`
3. `npm run test:unit`
4. Install NSIS via Chocolatey
5. `npm run make` (Electron Forge distributables, including Squirrel artifacts)
6. `npm run build:windows:custom-installer` (custom NSIS installer)
7. Upload release assets from:
   - `out/make/**/*`
   - `out/custom-installer/**/*`

## Update channels
- Automatic in-app updates (packaged app) use `update-electron-app` with GitHub release feed and depend on Forge/Squirrel release artifacts (`out/make`).
- Custom NSIS installer is a manual installer channel and is published in parallel for users who prefer explicit install/upgrade flows.
- Manual update check UI remains available from app menu (`Check for updates`) and links to release download page.

## Project-file compatibility policy
- Keep `PersistedTreeState` backward compatible for at least one major cycle.
- Add migration logic in `src/shared/project-file-migrations.ts` when schema changes.
- Never remove legacy support without a migration path.
- Add/adjust unit tests in `test/unit/project-file-migrations.test.ts` for each schema/editor-type change.
