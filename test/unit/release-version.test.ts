import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertReleaseTagMatchesPackageVersion,
  parsePackageVersion,
  validateReleaseTagMatchesVersion,
} from '../../src/shared/release-version';

describe('release version checks', () => {
  it('parses the package version from package.json content', () => {
    expect(parsePackageVersion(JSON.stringify({ version: '0.1.7' }))).toBe('0.1.7');
  });

  it('rejects package content without a usable version', () => {
    expect(() => parsePackageVersion(JSON.stringify({ version: '' }))).toThrow(
      'package.json is missing a valid version string',
    );
  });

  it('accepts matching release tags', () => {
    expect(validateReleaseTagMatchesVersion('v0.1.7', '0.1.7')).toEqual({
      ok: true,
      packageVersion: '0.1.7',
      tagName: 'v0.1.7',
    });
  });

  it('reports a clear mismatch error when the tag is wrong', () => {
    expect(validateReleaseTagMatchesVersion('v0.1.8', '0.1.7')).toEqual({
      ok: false,
      packageVersion: '0.1.7',
      tagName: 'v0.1.8',
      message: 'Tag/version mismatch: tag=v0.1.8 package=0.1.7',
    });
  });

  it('enforces tag and package version parity in CI when GITHUB_REF_NAME is set', () => {
    const tagName = process.env.GITHUB_REF_NAME;

    if (!tagName) {
      expect(true).toBe(true);
      return;
    }

    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    expect(() => assertReleaseTagMatchesPackageVersion(tagName, packageJsonPath)).not.toThrow();
  });
});
