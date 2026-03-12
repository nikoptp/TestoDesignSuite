import React from 'react';
import { createId } from '../../shared/tree-utils';
import type {
  ProjectImageAsset,
  SteamAchievementArtData,
  SteamAchievementBorderStyle,
  SteamAchievementEntry,
  SteamAchievementTransform,
  SteamImagePreset,
} from '../../shared/types';

export const STEAM_ACHIEVEMENT_256_PRESET_ID = 'steam-achievement-256';
export const MIN_STEAM_ACHIEVEMENT_ZOOM = 1;
export const MAX_STEAM_ACHIEVEMENT_ZOOM = 12;

export const STEAM_IMAGE_PRESETS: SteamImagePreset[] = [
  {
    id: STEAM_ACHIEVEMENT_256_PRESET_ID,
    label: 'Steam Achievement 256x256',
    width: 256,
    height: 256,
    exportColor: true,
    exportGrayscale: true,
    grayscaleSuffix: '_gray',
  },
];

const DEFAULT_NAME = 'achievement';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const getSteamImagePreset = (presetId: string): SteamImagePreset =>
  STEAM_IMAGE_PRESETS.find((preset) => preset.id === presetId) ?? STEAM_IMAGE_PRESETS[0];

export const createDefaultSteamAchievementTransform = (): SteamAchievementTransform => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
});

export const createDefaultSteamAchievementBorderStyle = (): SteamAchievementBorderStyle => ({
  enabled: false,
  thickness: 8,
  opacity: 0.9,
  margin: 10,
  radius: 24,
  gradientAngle: 135,
  color: '#d6e1f1',
  midColor: '#8ba3c0',
  gradientColor: '#475872',
  backgroundMode: 'none',
  backgroundOpacity: 1,
  backgroundAngle: 180,
  backgroundColor: '#142236',
  backgroundMidColor: '#22314f',
  backgroundGradientColor: '#0a101a',
  backgroundImageRelativePath: null,
});

const borderStyleFromLegacyPreset = (
  borderOverlayId: string | null | undefined,
): SteamAchievementBorderStyle => {
  const base = createDefaultSteamAchievementBorderStyle();
  switch (borderOverlayId) {
    case 'silver-rim':
      return {
        ...base,
        enabled: true,
      };
    case 'gold-trim':
      return {
        ...base,
        enabled: true,
        thickness: 10,
        opacity: 0.92,
        color: '#e4b850',
        midColor: '#c68e2f',
        gradientColor: '#5c380c',
      };
    case 'neon-tech':
      return {
        ...base,
        enabled: true,
        thickness: 6,
        opacity: 0.94,
        color: '#4edeff',
        midColor: '#8bf1ff',
        gradientColor: '#0f1933',
      };
    default:
      return base;
  }
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return fallback;
  }
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const normalizeAngle = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return ((value % 360) + 360) % 360;
};

export const normalizeSteamAchievementBorderStyle = (
  input: unknown,
  legacyBorderOverlayId?: string | null,
): SteamAchievementBorderStyle => {
  const fallback = borderStyleFromLegacyPreset(legacyBorderOverlayId);
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }

  const obj = input as Partial<SteamAchievementBorderStyle> & {
    gradientColor?: unknown;
    color?: unknown;
  };

  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    thickness:
      typeof obj.thickness === 'number' && Number.isFinite(obj.thickness)
        ? Math.min(48, Math.max(1, obj.thickness))
        : fallback.thickness,
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? Math.min(1, Math.max(0, obj.opacity))
        : fallback.opacity,
    margin:
      typeof obj.margin === 'number' && Number.isFinite(obj.margin)
        ? Math.min(72, Math.max(0, obj.margin))
        : fallback.margin,
    radius:
      typeof obj.radius === 'number' && Number.isFinite(obj.radius)
        ? Math.min(96, Math.max(0, obj.radius))
        : fallback.radius,
    gradientAngle: normalizeAngle(obj.gradientAngle, fallback.gradientAngle),
    color: normalizeHexColor(obj.color, fallback.color),
    midColor: normalizeHexColor(obj.midColor, fallback.midColor),
    gradientColor: normalizeHexColor(obj.gradientColor, fallback.gradientColor),
    backgroundMode:
      obj.backgroundMode === 'gradient' || obj.backgroundMode === 'image' || obj.backgroundMode === 'none'
        ? obj.backgroundMode
        : fallback.backgroundMode,
    backgroundOpacity:
      typeof obj.backgroundOpacity === 'number' && Number.isFinite(obj.backgroundOpacity)
        ? Math.min(1, Math.max(0, obj.backgroundOpacity))
        : fallback.backgroundOpacity,
    backgroundAngle: normalizeAngle(obj.backgroundAngle, fallback.backgroundAngle),
    backgroundColor: normalizeHexColor(obj.backgroundColor, fallback.backgroundColor),
    backgroundMidColor: normalizeHexColor(obj.backgroundMidColor, fallback.backgroundMidColor),
    backgroundGradientColor: normalizeHexColor(
      obj.backgroundGradientColor,
      fallback.backgroundGradientColor,
    ),
    backgroundImageRelativePath:
      typeof obj.backgroundImageRelativePath === 'string' && obj.backgroundImageRelativePath.trim()
        ? obj.backgroundImageRelativePath.trim()
        : null,
  };
};

export const createDefaultSteamAchievementArtData = (): SteamAchievementArtData => ({
  presetId: STEAM_ACHIEVEMENT_256_PRESET_ID,
  borderStyle: createDefaultSteamAchievementBorderStyle(),
  entries: [],
});

export const normalizeSteamAchievementEntryName = (value: string, fallback = DEFAULT_NAME): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const withoutControlChars = [...trimmed]
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('');
  const withoutReserved = withoutControlChars.replace(/[<>:"/\\|?*]/g, '-');
  const collapsed = withoutReserved.replace(/-+/g, '-').replace(/^\.+|\.+$/g, '').trim();
  return (collapsed || fallback).slice(0, 80);
};

export const sanitizeSteamAchievementFileStem = (value: string, fallback = DEFAULT_NAME): string => {
  const normalized = normalizeSteamAchievementEntryName(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._ -]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return normalized || fallback;
};

export const deriveSteamAchievementNameFromPath = (value: string, fallback = DEFAULT_NAME): string => {
  const fileName = value.split('/').pop() ?? value;
  const stem = fileName.replace(/\.[^.]+$/, '');
  return normalizeSteamAchievementEntryName(stem, fallback);
};

export const createSteamAchievementEntry = (name = DEFAULT_NAME): SteamAchievementEntry => {
  const now = Date.now();
  return {
    id: createId('steam-achievement'),
    name: normalizeSteamAchievementEntryName(name),
    sourceImageRelativePath: null,
    crop: createDefaultSteamAchievementTransform(),
    createdAt: now,
    updatedAt: now,
  };
};

export const normalizeSteamAchievementTransform = (
  transform: Partial<SteamAchievementTransform> | null | undefined,
): SteamAchievementTransform => ({
  zoom:
    typeof transform?.zoom === 'number' && Number.isFinite(transform.zoom)
      ? Math.min(MAX_STEAM_ACHIEVEMENT_ZOOM, Math.max(MIN_STEAM_ACHIEVEMENT_ZOOM, transform.zoom))
      : 1,
  offsetX:
    typeof transform?.offsetX === 'number' && Number.isFinite(transform.offsetX)
      ? transform.offsetX
      : 0,
  offsetY:
    typeof transform?.offsetY === 'number' && Number.isFinite(transform.offsetY)
      ? transform.offsetY
      : 0,
});

export const getSteamAchievementFrameRect = (
  width: number,
  height: number,
  borderStyle: SteamAchievementBorderStyle,
): { left: number; top: number; width: number; height: number; radius: number } => {
  const maxInset = Math.max(0, Math.floor(Math.min(width, height) * 0.3));
  const inset = Math.min(maxInset, Math.max(0, Math.round(borderStyle.margin)));
  const nextWidth = Math.max(1, width - inset * 2);
  const nextHeight = Math.max(1, height - inset * 2);
  return {
    left: inset,
    top: inset,
    width: nextWidth,
    height: nextHeight,
    radius: Math.min(Math.round(borderStyle.radius), Math.floor(Math.min(nextWidth, nextHeight) * 0.5)),
  };
};

export const getSteamAchievementDrawRect = (
  sourceWidth: number,
  sourceHeight: number,
  preset: SteamImagePreset,
  transform: SteamAchievementTransform,
): { width: number; height: number; left: number; top: number } => {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const zoom = Math.min(MAX_STEAM_ACHIEVEMENT_ZOOM, Math.max(MIN_STEAM_ACHIEVEMENT_ZOOM, transform.zoom));
  const baseScale = Math.max(preset.width / safeWidth, preset.height / safeHeight);
  const scale = baseScale * zoom;
  const width = safeWidth * scale;
  const height = safeHeight * scale;
  return {
    width,
    height,
    left: (preset.width - width) * 0.5 + transform.offsetX,
    top: (preset.height - height) * 0.5 + transform.offsetY,
  };
};

export const clampSteamAchievementTransform = (
  sourceWidth: number,
  sourceHeight: number,
  preset: SteamImagePreset,
  transform: Partial<SteamAchievementTransform> | null | undefined,
): SteamAchievementTransform => {
  const next = normalizeSteamAchievementTransform(transform);
  const drawRect = getSteamAchievementDrawRect(sourceWidth, sourceHeight, preset, next);
  const maxOffsetX = Math.max(0, (drawRect.width - preset.width) * 0.5);
  const maxOffsetY = Math.max(0, (drawRect.height - preset.height) * 0.5);
  return {
    zoom: next.zoom,
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, next.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, next.offsetY)),
  };
};

export const normalizeSteamAchievementArtData = (input: unknown): SteamAchievementArtData => {
  if (typeof input !== 'object' || input === null) {
    return createDefaultSteamAchievementArtData();
  }

  const obj = input as {
    presetId?: unknown;
    borderStyle?: unknown;
    borderOverlayId?: unknown;
    entries?: unknown;
  };

  const preset = getSteamImagePreset(typeof obj.presetId === 'string' ? obj.presetId : '');
  const entries = Array.isArray(obj.entries)
    ? obj.entries.flatMap((entry): SteamAchievementEntry[] => {
        if (typeof entry !== 'object' || entry === null) {
          return [];
        }

        const item = entry as {
          id?: unknown;
          name?: unknown;
          sourceImageRelativePath?: unknown;
          crop?: unknown;
          createdAt?: unknown;
          updatedAt?: unknown;
        };

        if (typeof item.id !== 'string' || !item.id.trim()) {
          return [];
        }

        const createdAt =
          typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
            ? item.createdAt
            : Date.now();
        const updatedAt =
          typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
            ? item.updatedAt
            : createdAt;

        return [
          {
            id: item.id,
            name: normalizeSteamAchievementEntryName(
              typeof item.name === 'string' ? item.name : DEFAULT_NAME,
            ),
            sourceImageRelativePath:
              typeof item.sourceImageRelativePath === 'string' && item.sourceImageRelativePath.trim()
                ? item.sourceImageRelativePath.trim()
                : null,
            crop: normalizeSteamAchievementTransform(
              typeof item.crop === 'object' && item.crop !== null
                ? (item.crop as Partial<SteamAchievementTransform>)
                : null,
            ),
            createdAt,
            updatedAt,
          },
        ];
      })
    : [];

  return {
    presetId: preset.id,
    borderStyle: normalizeSteamAchievementBorderStyle(
      obj.borderStyle,
      typeof obj.borderOverlayId === 'string' ? obj.borderOverlayId : null,
    ),
    entries,
  };
};

export const getSteamAchievementAssetByPath = (
  assets: ProjectImageAsset[],
  relativePath: string | null,
): ProjectImageAsset | null => {
  if (!relativePath) {
    return null;
  }

  return assets.find((asset) => asset.relativePath === relativePath) ?? null;
};

export const buildSteamAchievementExportFileNames = (
  entryName: string,
  preset: SteamImagePreset,
): { color: string; grayscale: string | null } => {
  const stem = sanitizeSteamAchievementFileStem(entryName);
  return {
    color: `${stem}.png`,
    grayscale: preset.exportGrayscale ? `${stem}${preset.grayscaleSuffix}.png` : null,
  };
};

const sampleBgraChannel = (
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: 0 | 1 | 2 | 3,
): number => {
  const clampedX = Math.min(width - 1, Math.max(0, Math.floor(x)));
  const clampedY = Math.min(height - 1, Math.max(0, Math.floor(y)));
  return data[(clampedY * width + clampedX) * 4 + channel] ?? 0;
};

const sampleBilinearChannel = (
  data: Uint8Array,
  width: number,
  height: number,
  sourceX: number,
  sourceY: number,
  channel: 0 | 1 | 2 | 3,
): number => {
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = sourceX - x0;
  const ty = sourceY - y0;

  const top =
    sampleBgraChannel(data, width, height, x0, y0, channel) * (1 - tx) +
    sampleBgraChannel(data, width, height, x1, y0, channel) * tx;
  const bottom =
    sampleBgraChannel(data, width, height, x0, y1, channel) * (1 - tx) +
    sampleBgraChannel(data, width, height, x1, y1, channel) * tx;
  return Math.round(top * (1 - ty) + bottom * ty);
};

export const renderSteamAchievementBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  preset: SteamImagePreset;
  transform: SteamAchievementTransform;
}): Uint8Array => {
  const nextTransform = clampSteamAchievementTransform(
    input.sourceWidth,
    input.sourceHeight,
    input.preset,
    input.transform,
  );
  const drawRect = getSteamAchievementDrawRect(
    input.sourceWidth,
    input.sourceHeight,
    input.preset,
    nextTransform,
  );
  const output = new Uint8Array(input.preset.width * input.preset.height * 4);

  for (let y = 0; y < input.preset.height; y += 1) {
    for (let x = 0; x < input.preset.width; x += 1) {
      const sourceX = ((x + 0.5) - drawRect.left) / drawRect.width * input.sourceWidth - 0.5;
      const sourceY = ((y + 0.5) - drawRect.top) / drawRect.height * input.sourceHeight - 0.5;
      const offset = (y * input.preset.width + x) * 4;

      output[offset] = sampleBilinearChannel(
        input.sourceBgra,
        input.sourceWidth,
        input.sourceHeight,
        sourceX,
        sourceY,
        0,
      );
      output[offset + 1] = sampleBilinearChannel(
        input.sourceBgra,
        input.sourceWidth,
        input.sourceHeight,
        sourceX,
        sourceY,
        1,
      );
      output[offset + 2] = sampleBilinearChannel(
        input.sourceBgra,
        input.sourceWidth,
        input.sourceHeight,
        sourceX,
        sourceY,
        2,
      );
      output[offset + 3] = sampleBilinearChannel(
        input.sourceBgra,
        input.sourceWidth,
        input.sourceHeight,
        sourceX,
        sourceY,
        3,
      );
    }
  }

  return output;
};

export const createGrayscaleBitmap = (sourceBgra: Uint8Array): Uint8Array => {
  const next = new Uint8Array(sourceBgra);
  for (let index = 0; index < next.length; index += 4) {
    const blue = next[index];
    const green = next[index + 1];
    const red = next[index + 2];
    const luminance = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    next[index] = luminance;
    next[index + 1] = luminance;
    next[index + 2] = luminance;
  }
  return next;
};

const blendChannel = (source: number, target: number, alpha: number): number =>
  Math.round(source * (1 - alpha) + target * alpha);

const hexToRgb = (value: string): { r: number; g: number; b: number } => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
});

const interpolateChannel = (from: number, to: number, t: number): number =>
  Math.round(from + (to - from) * t);

const interpolateRgb = (
  from: { r: number; g: number; b: number },
  via: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } => {
  if (t <= 0.5) {
    const segment = t / 0.5;
    return {
      r: interpolateChannel(from.r, via.r, segment),
      g: interpolateChannel(from.g, via.g, segment),
      b: interpolateChannel(from.b, via.b, segment),
    };
  }
  const segment = (t - 0.5) / 0.5;
  return {
    r: interpolateChannel(via.r, to.r, segment),
    g: interpolateChannel(via.g, to.g, segment),
    b: interpolateChannel(via.b, to.b, segment),
  };
};

const sampleGradientColor = (
  angle: number,
  width: number,
  height: number,
  x: number,
  y: number,
  colors: [string, string, string],
): { r: number; g: number; b: number } => {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const centeredX = width <= 1 ? 0 : x / (width - 1) - 0.5;
  const centeredY = height <= 1 ? 0 : y / (height - 1) - 0.5;
  const projected = centeredX * dx + centeredY * dy;
  const normalized = Math.max(0, Math.min(1, projected / 1.2 + 0.5));
  return interpolateRgb(hexToRgb(colors[0]), hexToRgb(colors[1]), hexToRgb(colors[2]), normalized);
};

const isInsideRoundedRect = (
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number; radius: number },
): boolean => {
  const localX = x - rect.left;
  const localY = y - rect.top;
  if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
    return false;
  }

  const radius = Math.max(0, Math.min(rect.radius, Math.min(rect.width, rect.height) * 0.5));
  if (radius <= 0) {
    return true;
  }

  const nearestX = Math.max(radius, Math.min(localX, rect.width - radius));
  const nearestY = Math.max(radius, Math.min(localY, rect.height - radius));
  const deltaX = localX - nearestX;
  const deltaY = localY - nearestY;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
};

const compositeBitmapIntoRoundedRect = (
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  bitmap: Uint8Array,
  rect: { left: number; top: number; width: number; height: number; radius: number },
): void => {
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const targetX = rect.left + x;
      const targetY = rect.top + y;
      if (
        targetX < 0 ||
        targetY < 0 ||
        targetX >= targetWidth ||
        targetY >= targetHeight ||
        !isInsideRoundedRect(targetX + 0.5, targetY + 0.5, rect)
      ) {
        continue;
      }
      const sourceOffset = (y * rect.width + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      target[targetOffset] = bitmap[sourceOffset];
      target[targetOffset + 1] = bitmap[sourceOffset + 1];
      target[targetOffset + 2] = bitmap[sourceOffset + 2];
      target[targetOffset + 3] = bitmap[sourceOffset + 3];
    }
  }
};

export const composeSteamAchievementFrameBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  preset: SteamImagePreset;
  transform: SteamAchievementTransform;
  borderStyle: SteamAchievementBorderStyle;
  backgroundImageBgra?: Uint8Array | null;
  backgroundImageWidth?: number;
  backgroundImageHeight?: number;
}): Uint8Array => {
  const frameRect = getSteamAchievementFrameRect(input.preset.width, input.preset.height, input.borderStyle);
  const backgroundBitmap = createSteamAchievementBackgroundBitmap({
    width: input.preset.width,
    height: input.preset.height,
    borderStyle: input.borderStyle,
    backgroundImageBgra: input.backgroundImageBgra,
    backgroundImageWidth: input.backgroundImageWidth,
    backgroundImageHeight: input.backgroundImageHeight,
  });
  const imageBitmap = renderSteamAchievementBitmap({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    sourceBgra: input.sourceBgra,
    preset: {
      ...input.preset,
      width: frameRect.width,
      height: frameRect.height,
    },
    transform: input.transform,
  });
  compositeBitmapIntoRoundedRect(
    backgroundBitmap,
    input.preset.width,
    input.preset.height,
    imageBitmap,
    frameRect,
  );
  return applySteamAchievementBorderStyle(
    backgroundBitmap,
    input.preset.width,
    input.preset.height,
    input.borderStyle,
    frameRect,
  );
};

export const createSteamAchievementBackgroundBitmap = (input: {
  width: number;
  height: number;
  borderStyle: SteamAchievementBorderStyle;
  backgroundImageBgra?: Uint8Array | null;
  backgroundImageWidth?: number;
  backgroundImageHeight?: number;
}): Uint8Array => {
  const output = new Uint8Array(input.width * input.height * 4);
  const style = input.borderStyle;
  if (style.backgroundMode === 'none' || style.backgroundOpacity <= 0) {
    return output;
  }

  if (
    style.backgroundMode === 'image' &&
    input.backgroundImageBgra &&
    input.backgroundImageWidth &&
    input.backgroundImageHeight
  ) {
    const coverBitmap = renderSteamAchievementBitmap({
      sourceWidth: input.backgroundImageWidth,
      sourceHeight: input.backgroundImageHeight,
      sourceBgra: input.backgroundImageBgra,
      preset: {
        id: 'background',
        label: 'Background',
        width: input.width,
        height: input.height,
        exportColor: true,
        exportGrayscale: false,
        grayscaleSuffix: '',
      },
      transform: createDefaultSteamAchievementTransform(),
    });
    for (let index = 0; index < output.length; index += 4) {
      output[index] = blendChannel(0, coverBitmap[index], style.backgroundOpacity);
      output[index + 1] = blendChannel(0, coverBitmap[index + 1], style.backgroundOpacity);
      output[index + 2] = blendChannel(0, coverBitmap[index + 2], style.backgroundOpacity);
      output[index + 3] = Math.round(255 * style.backgroundOpacity);
    }
    return output;
  }

  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const color = sampleGradientColor(
        style.backgroundAngle,
        input.width,
        input.height,
        x,
        y,
        [style.backgroundColor, style.backgroundMidColor, style.backgroundGradientColor],
      );
      const offset = (y * input.width + x) * 4;
      output[offset] = color.b;
      output[offset + 1] = color.g;
      output[offset + 2] = color.r;
      output[offset + 3] = Math.round(255 * style.backgroundOpacity);
    }
  }
  return output;
};

export const applySteamAchievementBorderStyle = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  borderStyle: SteamAchievementBorderStyle,
  frameRect = getSteamAchievementFrameRect(width, height, borderStyle),
): Uint8Array => {
  if (!borderStyle.enabled || borderStyle.opacity <= 0 || borderStyle.thickness <= 0) {
    return bitmap;
  }

  const next = new Uint8Array(bitmap);
  const innerRect = {
    left: frameRect.left + borderStyle.thickness,
    top: frameRect.top + borderStyle.thickness,
    width: Math.max(0, frameRect.width - borderStyle.thickness * 2),
    height: Math.max(0, frameRect.height - borderStyle.thickness * 2),
    radius: Math.max(0, frameRect.radius - borderStyle.thickness),
  };

  for (let y = frameRect.top; y < frameRect.top + frameRect.height; y += 1) {
    for (let x = frameRect.left; x < frameRect.left + frameRect.width; x += 1) {
      const inOuter = isInsideRoundedRect(x + 0.5, y + 0.5, frameRect);
      const inInner = innerRect.width > 0 && innerRect.height > 0
        ? isInsideRoundedRect(x + 0.5, y + 0.5, innerRect)
        : false;
      if (!inOuter || inInner) {
        continue;
      }
      const gradientColor = sampleGradientColor(
        borderStyle.gradientAngle,
        frameRect.width,
        frameRect.height,
        x - frameRect.left,
        y - frameRect.top,
        [borderStyle.color, borderStyle.midColor, borderStyle.gradientColor],
      );
      const offset = (y * width + x) * 4;
      next[offset] = blendChannel(next[offset], gradientColor.b, borderStyle.opacity);
      next[offset + 1] = blendChannel(next[offset + 1], gradientColor.g, borderStyle.opacity);
      next[offset + 2] = blendChannel(next[offset + 2], gradientColor.r, borderStyle.opacity);
      next[offset + 3] = 255;
    }
  }

  return next;
};

const toRgbaString = (hexColor: string, alpha: number): string => {
  const rgb = hexToRgb(hexColor);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
};

export const buildSteamAchievementBackgroundCss = (
  borderStyle: SteamAchievementBorderStyle,
  backgroundAssetUrl?: string | null,
): React.CSSProperties => {
  if (borderStyle.backgroundMode === 'none' || borderStyle.backgroundOpacity <= 0) {
    return { display: 'none' };
  }

  if (borderStyle.backgroundMode === 'image' && backgroundAssetUrl) {
    return {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, ${1 - borderStyle.backgroundOpacity}), rgba(0, 0, 0, ${1 - borderStyle.backgroundOpacity})), url("${backgroundAssetUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  return {
    backgroundImage: `linear-gradient(${borderStyle.backgroundAngle}deg, ${toRgbaString(borderStyle.backgroundColor, borderStyle.backgroundOpacity)} 0%, ${toRgbaString(borderStyle.backgroundMidColor, borderStyle.backgroundOpacity)} 52%, ${toRgbaString(borderStyle.backgroundGradientColor, borderStyle.backgroundOpacity)} 100%)`,
  };
};

export const buildSteamAchievementBorderCss = (
  borderStyle: SteamAchievementBorderStyle,
  scale = 1,
): React.CSSProperties => {
  if (!borderStyle.enabled || borderStyle.opacity <= 0 || borderStyle.thickness <= 0) {
    return { display: 'none' };
  }

  const borderWidth = Math.max(1, borderStyle.thickness * scale);
  return {
    border: `${borderWidth}px solid transparent`,
    backgroundImage: `linear-gradient(${borderStyle.gradientAngle}deg, ${toRgbaString(borderStyle.color, borderStyle.opacity)} 0%, ${toRgbaString(borderStyle.midColor, borderStyle.opacity)} 52%, ${toRgbaString(borderStyle.gradientColor, borderStyle.opacity)} 100%)`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'border-box',
    borderRadius: `${Math.max(0, borderStyle.radius * scale)}px`,
    WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    boxShadow: `inset 0 0 0 ${Math.max(1, borderWidth * 0.25)}px ${toRgbaString(borderStyle.color, borderStyle.opacity * 0.28)}`,
  };
};
