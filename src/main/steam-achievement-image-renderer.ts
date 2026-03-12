import { nativeImage } from 'electron';
import {
  composeSteamAchievementFrameBitmap,
  createGrayscaleBitmap,
  getSteamImagePreset,
} from '../features/steam-achievement/steam-achievement-art';
import type { SteamAchievementEntry, SteamAchievementExportRequest } from '../shared/types';

export const renderSteamAchievementEntryPngs = async (
  entry: SteamAchievementEntry,
  absolutePath: string,
  request: SteamAchievementExportRequest,
  resolveImageAssetPath?: (relativePath: string) => string | null,
): Promise<{ colorPng: Uint8Array; grayscalePng: Uint8Array | null } | null> => {
  const sourceImage = nativeImage.createFromPath(absolutePath);
  const { width, height } = sourceImage.getSize();
  if (sourceImage.isEmpty() || width <= 0 || height <= 0) {
    return null;
  }

  const preset = getSteamImagePreset(request.data.presetId);
  const backgroundRelativePath = request.data.borderStyle.backgroundImageRelativePath;
  const backgroundAbsolutePath =
    backgroundRelativePath && resolveImageAssetPath ? resolveImageAssetPath(backgroundRelativePath) : null;
  const backgroundImage = backgroundAbsolutePath
    ? nativeImage.createFromPath(backgroundAbsolutePath)
    : null;
  const backgroundSize = backgroundImage?.getSize() ?? { width: 0, height: 0 };

  const colorBitmap = composeSteamAchievementFrameBitmap({
    sourceWidth: width,
    sourceHeight: height,
    sourceBgra: sourceImage.toBitmap(),
    preset,
    transform: entry.crop,
    borderStyle: request.data.borderStyle,
    backgroundImageBgra:
      backgroundImage && !backgroundImage.isEmpty() && backgroundSize.width > 0 && backgroundSize.height > 0
        ? backgroundImage.toBitmap()
        : null,
    backgroundImageWidth: backgroundSize.width,
    backgroundImageHeight: backgroundSize.height,
  });
  const colorPng = nativeImage
    .createFromBitmap(Buffer.from(colorBitmap), {
      width: preset.width,
      height: preset.height,
      scaleFactor: 1,
    })
    .toPNG();

  const grayscalePng = preset.exportGrayscale
    ? nativeImage
        .createFromBitmap(Buffer.from(createGrayscaleBitmap(colorBitmap)), {
          width: preset.width,
          height: preset.height,
          scaleFactor: 1,
        })
        .toPNG()
    : null;

  return {
    colorPng,
    grayscalePng,
  };
};
