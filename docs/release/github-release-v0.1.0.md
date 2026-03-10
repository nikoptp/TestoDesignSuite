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
4. Ensure `package.json` `version` matches intended tag (`vX.Y.Z`).
5. (Recommended) Run local packaging smoke check:
   - `npm run build:windows:custom-installer`
6. Commit any pending release changes.
7. Create and push tag:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
8. Verify GitHub Actions `Release` workflow completes and publishes installer + checksum assets.
9. Open the GitHub release page and review generated notes + attached files.

## CI workflow behavior
On tag push (`v*`), `.github/workflows/release.yml` does:
1. `npm ci`
2. `npm run lint`
3. `npm run test:unit`
4. Verify tag/version alignment (`GITHUB_REF_NAME === v${package.json version}`)
5. Install NSIS via Chocolatey
6. `npm run build:windows:custom-installer` (custom NSIS installer)
7. Generate SHA-256 checksum file(s) for installer artifacts
8. Upload release assets from:
   - `out/custom-installer/**/*`

## Update channels
- Windows releases use the custom NSIS installer channel (`out/custom-installer`) only.
- `update-electron-app` is disabled on Windows and can be used for packaged non-Windows targets.
- Manual update checks on Windows can run an in-app silent installer flow when a release installer asset is available.
- Manual update check UI remains available from app menu (`Check for updates`) and links to release download page.

## Project-file compatibility policy
- Keep `PersistedTreeState` backward compatible for at least one major cycle.
- Add migration logic in `src/shared/project-file-migrations.ts` when schema changes.
- Never remove legacy support without a migration path.
- Add/adjust unit tests in `test/unit/project-file-migrations.test.ts` for each schema/editor-type change.
