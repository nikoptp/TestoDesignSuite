import { readFileSync } from 'node:fs';

export type ReleaseTagValidationResult =
  | { ok: true; packageVersion: string; tagName: string }
  | { ok: false; packageVersion: string; tagName: string; message: string };

export function parsePackageVersion(packageJsonContent: string): string {
  const parsed = JSON.parse(packageJsonContent) as { version?: unknown };

  if (typeof parsed.version !== 'string' || parsed.version.trim().length === 0) {
    throw new Error('package.json is missing a valid version string');
  }

  return parsed.version;
}

export function readPackageVersion(packageJsonPath: string): string {
  return parsePackageVersion(readFileSync(packageJsonPath, 'utf8'));
}

export function validateReleaseTagMatchesVersion(
  tagName: string,
  packageVersion: string,
): ReleaseTagValidationResult {
  const expectedTagName = `v${packageVersion}`;

  if (tagName === expectedTagName) {
    return {
      ok: true,
      packageVersion,
      tagName,
    };
  }

  return {
    ok: false,
    packageVersion,
    tagName,
    message: `Tag/version mismatch: tag=${tagName} package=${packageVersion}`,
  };
}

export function assertReleaseTagMatchesPackageVersion(tagName: string, packageJsonPath: string): string {
  const packageVersion = readPackageVersion(packageJsonPath);
  const result = validateReleaseTagMatchesVersion(tagName, packageVersion);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return `Tag/version check passed for ${result.tagName}`;
}
