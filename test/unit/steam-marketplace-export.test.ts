import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { writeSteamMarketplaceExportSet } from '../../src/main/steam-marketplace-export';
import { createDefaultSteamMarketplaceOutputState } from '../../src/features/steam-marketplace/steam-marketplace-assets';

describe('steam marketplace export writer', () => {
  it('writes filtered preset output and counts skipped targets', async () => {
    const writeResult = await writeSteamMarketplaceExportSet(
      {
        nodeName: 'Steam Assets',
        outputDir: path.join(os.tmpdir(), `steam-marketplace-export-${Date.now()}`),
        entryIds: ['entry-1'],
        presetIds: ['header-capsule', 'app-icon'],
        data: {
        entries: [
          {
            id: 'entry-1',
            name: 'capsule-art',
            presetId: 'header-capsule',
            sourceImageRelativePath: 'images/base.png',
            logoImageRelativePath: null,
            outputsByPresetId: {
                'header-capsule': createDefaultSteamMarketplaceOutputState(),
                'app-icon': createDefaultSteamMarketplaceOutputState(),
              },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
      {
        renderEntryPreset: vi
          .fn()
          .mockResolvedValueOnce(new Uint8Array([1, 2, 3])),
      },
    );

    expect(writeResult.exportedEntryCount).toBe(1);
    expect(writeResult.skippedEntryCount).toBe(0);
    expect(writeResult.writtenFileCount).toBe(1);
  });
});
