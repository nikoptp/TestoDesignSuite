import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeSteamAchievementExportSet } from '../../src/main/steam-achievement-export';
import { createDefaultSteamAchievementBorderStyle } from '../../src/features/steam-achievement/steam-achievement-art';

const tempDirs: string[] = [];

describe('steam achievement export writer', () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('writes color and grayscale files for valid entries', async () => {
    const outputDir = path.join(os.tmpdir(), `steam-achievement-export-${Date.now()}`);
    await mkdir(outputDir, { recursive: true });
    tempDirs.push(outputDir);

    const result = await writeSteamAchievementExportSet(
      {
        outputDir,
        nodeName: 'Achievements',
        data: {
          presetId: 'steam-achievement-256',
          borderStyle: {
            ...createDefaultSteamAchievementBorderStyle(),
            enabled: true,
          },
          entries: [
            {
              id: 'entry-1',
              name: 'boss_clear',
              sourceImageRelativePath: 'project-assets/images/boss.png',
              crop: { zoom: 1, offsetX: 0, offsetY: 0 },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
      {
        resolveImageAssetPath: () => 'C:/images/boss.png',
        renderEntry: async () => ({
          colorPng: new Uint8Array([1, 2, 3]),
          grayscalePng: new Uint8Array([4, 5, 6]),
        }),
      },
    );

    const files = (await readdir(outputDir)).sort();
    expect(files).toEqual(['boss_clear.png', 'boss_clear_gray.png']);
    expect(result.exportedEntryCount).toBe(1);
    expect(result.writtenFileCount).toBe(2);
    await expect(readFile(path.join(outputDir, 'boss_clear.png'))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it('skips entries with missing source image paths', async () => {
    const outputDir = path.join(os.tmpdir(), `steam-achievement-export-${Date.now()}-skip`);
    await mkdir(outputDir, { recursive: true });
    tempDirs.push(outputDir);

    const result = await writeSteamAchievementExportSet(
      {
        outputDir,
        nodeName: 'Achievements',
        data: {
          presetId: 'steam-achievement-256',
          borderStyle: {
            ...createDefaultSteamAchievementBorderStyle(),
            enabled: false,
          },
          entries: [
            {
              id: 'entry-1',
              name: 'missing',
              sourceImageRelativePath: null,
              crop: { zoom: 1, offsetX: 0, offsetY: 0 },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
      {
        resolveImageAssetPath: () => null,
        renderEntry: async () => null,
      },
    );

    expect(result.exportedEntryCount).toBe(0);
    expect(result.skippedEntryCount).toBe(1);
    expect(await readdir(outputDir)).toEqual([]);
  });
});
