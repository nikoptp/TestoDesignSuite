import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildSteamMarketplaceExportFileName,
  buildSteamMarketplaceExportTargets,
} from '../features/steam-marketplace/steam-marketplace-assets';
import type {
  SteamMarketplaceEntry,
  SteamMarketplaceExportRequest,
  SteamMarketplaceExportResult,
  SteamMarketplaceOutputState,
  SteamMarketplacePreset,
} from '../shared/types';

type WriteSteamMarketplaceExportSetDeps = {
  renderEntryPreset: (
    entry: SteamMarketplaceEntry,
    preset: SteamMarketplacePreset,
    output: SteamMarketplaceOutputState,
  ) => Promise<Uint8Array | null>;
};

export const writeSteamMarketplaceExportSet = async (
  request: SteamMarketplaceExportRequest & { outputDir: string },
  { renderEntryPreset }: WriteSteamMarketplaceExportSetDeps,
): Promise<SteamMarketplaceExportResult> => {
  await mkdir(request.outputDir, { recursive: true });

  const targets = buildSteamMarketplaceExportTargets(request);
  let exportedEntryCount = 0;
  let skippedEntryCount = 0;
  let writtenFileCount = 0;
  const exportedEntryIds = new Set<string>();

  for (const target of targets) {
    const rendered = await renderEntryPreset(target.entry, target.preset, target.output);
    if (!rendered) {
      skippedEntryCount += 1;
      continue;
    }

    const fileName = buildSteamMarketplaceExportFileName(target.entry.name, target.preset);
    await writeFile(path.join(request.outputDir, fileName), Buffer.from(rendered));
    writtenFileCount += 1;
    exportedEntryIds.add(target.entry.id);
  }

  exportedEntryCount = exportedEntryIds.size;

  return {
    canceled: false,
    outputDir: request.outputDir,
    exportedEntryCount,
    skippedEntryCount,
    writtenFileCount,
  };
};
