import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildSteamAchievementExportFileNames,
  getSteamImagePreset,
} from '../features/steam-achievement/steam-achievement-art';
import type {
  SteamAchievementEntry,
  SteamAchievementExportRequest,
  SteamAchievementExportResult,
} from '../shared/types';

type RenderResult = {
  colorPng: Uint8Array;
  grayscalePng: Uint8Array | null;
};

type WriteSteamAchievementExportSetDeps = {
  resolveImageAssetPath: (relativePath: string) => string | null;
  renderEntry: (entry: SteamAchievementEntry, absolutePath: string) => Promise<RenderResult | null>;
};

export const writeSteamAchievementExportSet = async (
  request: SteamAchievementExportRequest & { outputDir: string },
  { resolveImageAssetPath, renderEntry }: WriteSteamAchievementExportSetDeps,
): Promise<SteamAchievementExportResult> => {
  await mkdir(request.outputDir, { recursive: true });

  const preset = getSteamImagePreset(request.data.presetId);
  let exportedEntryCount = 0;
  let skippedEntryCount = 0;
  let writtenFileCount = 0;

  for (const entry of request.data.entries) {
    if (!entry.sourceImageRelativePath) {
      skippedEntryCount += 1;
      continue;
    }

    const absolutePath = resolveImageAssetPath(entry.sourceImageRelativePath);
    if (!absolutePath) {
      skippedEntryCount += 1;
      continue;
    }

    const rendered = await renderEntry(entry, absolutePath);
    if (!rendered) {
      skippedEntryCount += 1;
      continue;
    }

    const fileNames = buildSteamAchievementExportFileNames(entry.name, preset);
    await writeFile(path.join(request.outputDir, fileNames.color), Buffer.from(rendered.colorPng));
    writtenFileCount += 1;

    if (preset.exportGrayscale && fileNames.grayscale && rendered.grayscalePng) {
      await writeFile(path.join(request.outputDir, fileNames.grayscale), Buffer.from(rendered.grayscalePng));
      writtenFileCount += 1;
    }

    exportedEntryCount += 1;
  }

  return {
    canceled: false,
    outputDir: request.outputDir,
    exportedEntryCount,
    skippedEntryCount,
    writtenFileCount,
  };
};
