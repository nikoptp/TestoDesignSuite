# GitHub Release: v0.1.0

## One-time setup
- Set repository secret/variable expectations as needed for your publish flow.
- Set `TESTO_UPDATE_REPO` in your runtime environment to `<owner>/<repo>` so in-app update checks resolve to this GitHub repo.
- Confirm workflow file exists: `.github/workflows/release.yml`.

## Release checklist
1. Ensure local branch is clean and up to date.
2. Run `npm run lint`.
3. Run `npm run test:unit`.
4. Run `npm run make` and smoke-test generated installer/artifacts.
5. Commit any pending release changes.
6. Create and push tag:
   - `git tag v0.1.0`
   - `git push origin v0.1.0`
7. Verify GitHub Actions `Release` workflow completes and publishes artifacts.
8. Open the GitHub release page and review generated notes + attached files.

## Project-file compatibility policy
- Keep `PersistedTreeState` backward compatible for at least one major cycle.
- Add migration logic in `src/shared/project-file-migrations.ts` when schema changes.
- Never remove legacy support without a migration path.
- Add/adjust unit tests in `test/unit/project-file-migrations.test.ts` for each schema/editor-type change.
