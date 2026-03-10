import { describe, expect, it } from 'vitest';
import {
  parseChecksumManifest,
  pickChecksumAssetForInstaller,
  pickWindowsInstallerAsset,
  type ReleaseAsset,
} from '../../src/main/update-utils';

describe('pickWindowsInstallerAsset', () => {
  it('picks custom installer exe and skips squirrel setup exe', () => {
    const assets: ReleaseAsset[] = [
      {
        name: 'TestoDesignSuite Setup.exe',
        downloadUrl: 'https://example.com/setup.exe',
      },
      {
        name: 'testo-design-suite-0.1.4.exe',
        downloadUrl: 'https://example.com/custom.exe',
      },
    ];

    const installer = pickWindowsInstallerAsset(assets);
    expect(installer?.name).toBe('testo-design-suite-0.1.4.exe');
  });

  it('returns null when no matching installer asset exists', () => {
    const assets: ReleaseAsset[] = [
      {
        name: 'testo-design-suite-0.1.4.zip',
        downloadUrl: 'https://example.com/custom.zip',
      },
    ];

    expect(pickWindowsInstallerAsset(assets)).toBeNull();
  });
});

describe('pickChecksumAssetForInstaller', () => {
  it('picks installer checksum file', () => {
    const installerAsset: ReleaseAsset = {
      name: 'testo-design-suite-0.1.4.exe',
      downloadUrl: 'https://example.com/custom.exe',
    };
    const assets: ReleaseAsset[] = [
      installerAsset,
      {
        name: 'testo-design-suite-0.1.4.exe.sha256',
        downloadUrl: 'https://example.com/custom.exe.sha256',
      },
    ];

    const checksum = pickChecksumAssetForInstaller(assets, installerAsset);
    expect(checksum?.name).toBe('testo-design-suite-0.1.4.exe.sha256');
  });

  it('matches checksum names case-insensitively', () => {
    const installerAsset: ReleaseAsset = {
      name: 'Testo-Design-Suite-0.1.4.exe',
      downloadUrl: 'https://example.com/custom.exe',
    };
    const assets: ReleaseAsset[] = [
      installerAsset,
      {
        name: 'testo-design-suite-0.1.4.exe.SHA256.TXT',
        downloadUrl: 'https://example.com/custom.exe.sha256.txt',
      },
    ];

    const checksum = pickChecksumAssetForInstaller(assets, installerAsset);
    expect(checksum?.name).toBe('testo-design-suite-0.1.4.exe.SHA256.TXT');
  });
});

describe('parseChecksumManifest', () => {
  it('extracts sha256 from common checksum format', () => {
    const parsed = parseChecksumManifest(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  app.exe',
    );
    expect(parsed).toBe(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  });

  it('returns null for invalid checksum input', () => {
    expect(parseChecksumManifest('not-a-hash app.exe')).toBeNull();
  });
});
