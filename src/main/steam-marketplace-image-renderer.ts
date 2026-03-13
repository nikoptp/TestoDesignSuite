import { nativeImage } from 'electron';
import {
  buildSteamMarketplaceExportTargets,
  renderSteamMarketplaceBitmap,
} from '../features/steam-marketplace/steam-marketplace-assets';
import type {
  SteamMarketplaceEntry,
  SteamMarketplaceExportRequest,
  SteamMarketplaceOutputState,
  SteamMarketplacePreset,
} from '../shared/types';

export const renderSteamMarketplaceEntryPreset = async (
  entry: SteamMarketplaceEntry,
  preset: SteamMarketplacePreset,
  output: SteamMarketplaceOutputState,
  request: SteamMarketplaceExportRequest,
  resolveImageAssetPath?: (relativePath: string) => string | null,
): Promise<Uint8Array | null> => {
  const baseAbsolutePath =
    entry.sourceImageRelativePath && resolveImageAssetPath
      ? resolveImageAssetPath(entry.sourceImageRelativePath)
      : null;
  const logoAbsolutePath =
    entry.logoImageRelativePath && resolveImageAssetPath
      ? resolveImageAssetPath(entry.logoImageRelativePath)
      : null;

  const baseImage = baseAbsolutePath ? nativeImage.createFromPath(baseAbsolutePath) : null;
  const baseSize = baseImage?.getSize() ?? { width: 0, height: 0 };
  const logoImage = logoAbsolutePath ? nativeImage.createFromPath(logoAbsolutePath) : null;
  const logoSize = logoImage?.getSize() ?? { width: 0, height: 0 };

  if (
    preset.kind === 'image' &&
    (!baseImage || baseImage.isEmpty() || baseSize.width <= 0 || baseSize.height <= 0)
  ) {
    return null;
  }
  if (
    preset.kind === 'logo' &&
    (!logoImage || logoImage.isEmpty() || logoSize.width <= 0 || logoSize.height <= 0)
  ) {
    return null;
  }

  const bitmap = renderSteamMarketplaceBitmap({
    preset,
    output,
    baseSourceBgra:
      baseImage && !baseImage.isEmpty() && baseSize.width > 0 && baseSize.height > 0
        ? baseImage.toBitmap()
        : null,
    baseSourceWidth: baseSize.width,
    baseSourceHeight: baseSize.height,
    logoSourceBgra:
      logoImage && !logoImage.isEmpty() && logoSize.width > 0 && logoSize.height > 0
        ? logoImage.toBitmap()
        : null,
    logoSourceWidth: logoSize.width,
    logoSourceHeight: logoSize.height,
  });

  if (preset.format === 'jpg') {
    return nativeImage
      .createFromBitmap(Buffer.from(bitmap), {
        width: preset.width,
        height: preset.height,
        scaleFactor: 1,
      })
      .toJPEG(92);
  }

  return nativeImage
    .createFromBitmap(Buffer.from(bitmap), {
      width: preset.width,
      height: preset.height,
      scaleFactor: 1,
    })
    .toPNG();
};

export const validateSteamMarketplaceTargets = (
  request: SteamMarketplaceExportRequest,
): ReturnType<typeof buildSteamMarketplaceExportTargets> => buildSteamMarketplaceExportTargets(request);
