import React from 'react';
import { createId } from '../../shared/tree-utils';
import {
  applyBlurLayer,
  applyImageAdjustments,
  buildCssBlurFilter,
  buildCssImageAdjustmentFilter,
  buildCssShadowFilter,
  getCoverDrawRect,
  normalizeCoverTransform,
  renderCoverBitmap,
  renderScaledBitmap,
  sanitizeExportFileStem,
} from '../../shared/image-workbench';
export { createGrayscaleBitmap } from '../../shared/image-workbench';
import type {
  SteamAchievementBackgroundAdjustmentState,
  ProjectImageAsset,
  SteamAchievementArtData,
  SteamAchievementBorderStyle,
  SteamAchievementEntry,
  SteamAchievementEntryImageStyle,
  SteamAchievementImageAdjustmentState,
  SteamAchievementShadowState,
  SteamAchievementTransform,
  SteamImagePreset,
} from '../../shared/types';

export const STEAM_ACHIEVEMENT_256_PRESET_ID = 'steam-achievement-256';
export const MIN_STEAM_ACHIEVEMENT_ZOOM = 0.1;
export const MAX_STEAM_ACHIEVEMENT_ZOOM = 6;

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
  backgroundGradientOverlayEnabled: false,
  backgroundGradientOpacity: 0.42,
  backgroundAngle: 180,
  backgroundColor: '#142236',
  backgroundMidColor: '#22314f',
  backgroundGradientColor: '#0a101a',
  backgroundImageRelativePath: null,
});

export const createDefaultSteamAchievementImageAdjustmentState =
  (): SteamAchievementImageAdjustmentState => ({
    saturation: 1,
    contrast: 1,
    blurEnabled: false,
    blurRadius: 12,
    blurOpacity: 0.35,
  });

export const createDefaultSteamAchievementBackgroundAdjustmentState =
  (): SteamAchievementBackgroundAdjustmentState => ({
    ...createDefaultSteamAchievementImageAdjustmentState(),
    vignette: 0,
  });

export const createDefaultSteamAchievementShadowState = (): SteamAchievementShadowState => ({
  enabled: false,
  blur: 18,
  opacity: 0.4,
  offsetX: 0,
  offsetY: 8,
});

export const createDefaultSteamAchievementEntryImageStyle = (): SteamAchievementEntryImageStyle => ({
  adjustments: createDefaultSteamAchievementImageAdjustmentState(),
  shadow: createDefaultSteamAchievementShadowState(),
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
      obj.backgroundMode === 'image' || obj.backgroundMode === 'none'
        ? obj.backgroundMode
        : obj.backgroundMode === 'gradient'
          ? 'image'
          : fallback.backgroundMode,
    backgroundOpacity:
      typeof obj.backgroundOpacity === 'number' && Number.isFinite(obj.backgroundOpacity)
        ? Math.min(1, Math.max(0, obj.backgroundOpacity))
        : fallback.backgroundOpacity,
    backgroundGradientOverlayEnabled:
      typeof obj.backgroundGradientOverlayEnabled === 'boolean'
        ? obj.backgroundGradientOverlayEnabled
        : obj.backgroundMode === 'gradient'
          ? true
        : fallback.backgroundGradientOverlayEnabled,
    backgroundGradientOpacity:
      typeof obj.backgroundGradientOpacity === 'number' && Number.isFinite(obj.backgroundGradientOpacity)
        ? Math.min(1, Math.max(0, obj.backgroundGradientOpacity))
        : fallback.backgroundGradientOpacity,
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

export const normalizeSteamAchievementImageAdjustmentState = (
  input: unknown,
): SteamAchievementImageAdjustmentState => {
  const fallback = createDefaultSteamAchievementImageAdjustmentState();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamAchievementImageAdjustmentState>;
  return {
    saturation:
      typeof obj.saturation === 'number' && Number.isFinite(obj.saturation)
        ? Math.min(2, Math.max(0, obj.saturation))
        : fallback.saturation,
    contrast:
      typeof obj.contrast === 'number' && Number.isFinite(obj.contrast)
        ? Math.min(2, Math.max(0.4, obj.contrast))
        : fallback.contrast,
    blurEnabled: typeof obj.blurEnabled === 'boolean' ? obj.blurEnabled : fallback.blurEnabled,
    blurRadius:
      typeof obj.blurRadius === 'number' && Number.isFinite(obj.blurRadius)
        ? Math.min(64, Math.max(0, obj.blurRadius))
        : fallback.blurRadius,
    blurOpacity:
      typeof obj.blurOpacity === 'number' && Number.isFinite(obj.blurOpacity)
        ? Math.min(1, Math.max(0, obj.blurOpacity))
        : fallback.blurOpacity,
  };
};

export const normalizeSteamAchievementBackgroundAdjustmentState = (
  input: unknown,
): SteamAchievementBackgroundAdjustmentState => {
  const fallback = createDefaultSteamAchievementBackgroundAdjustmentState();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamAchievementBackgroundAdjustmentState>;
  const base = normalizeSteamAchievementImageAdjustmentState(input);
  return {
    ...base,
    vignette:
      typeof obj.vignette === 'number' && Number.isFinite(obj.vignette)
        ? Math.min(1, Math.max(0, obj.vignette))
        : fallback.vignette,
  };
};

export const normalizeSteamAchievementShadowState = (input: unknown): SteamAchievementShadowState => {
  const fallback = createDefaultSteamAchievementShadowState();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamAchievementShadowState>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    blur:
      typeof obj.blur === 'number' && Number.isFinite(obj.blur)
        ? Math.min(96, Math.max(0, obj.blur))
        : fallback.blur,
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? Math.min(1, Math.max(0, obj.opacity))
        : fallback.opacity,
    offsetX:
      typeof obj.offsetX === 'number' && Number.isFinite(obj.offsetX) ? obj.offsetX : fallback.offsetX,
    offsetY:
      typeof obj.offsetY === 'number' && Number.isFinite(obj.offsetY) ? obj.offsetY : fallback.offsetY,
  };
};

export const normalizeSteamAchievementEntryImageStyle = (
  input: unknown,
): SteamAchievementEntryImageStyle => {
  const obj = typeof input === 'object' && input !== null ? (input as Partial<SteamAchievementEntryImageStyle>) : null;
  return {
    adjustments: normalizeSteamAchievementImageAdjustmentState(obj?.adjustments),
    shadow: normalizeSteamAchievementShadowState(obj?.shadow),
  };
};

export const createDefaultSteamAchievementArtData = (): SteamAchievementArtData => ({
  presetId: STEAM_ACHIEVEMENT_256_PRESET_ID,
  borderStyle: createDefaultSteamAchievementBorderStyle(),
  backgroundAdjustments: createDefaultSteamAchievementBackgroundAdjustmentState(),
  backgroundAssetRelativePaths: [],
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
    imageStyle: createDefaultSteamAchievementEntryImageStyle(),
    createdAt: now,
    updatedAt: now,
  };
};

export const normalizeSteamAchievementTransform = (
  transform: Partial<SteamAchievementTransform> | null | undefined,
): SteamAchievementTransform =>
  normalizeCoverTransform(transform, {
    minZoom: MIN_STEAM_ACHIEVEMENT_ZOOM,
    maxZoom: MAX_STEAM_ACHIEVEMENT_ZOOM,
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
): { width: number; height: number; left: number; top: number } =>
  getCoverDrawRect(sourceWidth, sourceHeight, preset, transform, {
    minZoom: MIN_STEAM_ACHIEVEMENT_ZOOM,
    maxZoom: MAX_STEAM_ACHIEVEMENT_ZOOM,
  });

export const clampSteamAchievementTransform = (
  sourceWidth: number,
  sourceHeight: number,
  preset: SteamImagePreset,
  transform: Partial<SteamAchievementTransform> | null | undefined,
): SteamAchievementTransform => {
  const next = normalizeSteamAchievementTransform(transform);
  const drawRect = getSteamAchievementDrawRect(sourceWidth, sourceHeight, preset, next);
  const maxOffsetX = Math.abs(drawRect.width - preset.width) * 0.5;
  const maxOffsetY = Math.abs(drawRect.height - preset.height) * 0.5;

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
    backgroundAdjustments?: unknown;
    backgroundAssetRelativePaths?: unknown;
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
          imageStyle?: unknown;
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
            imageStyle: normalizeSteamAchievementEntryImageStyle(item.imageStyle),
            createdAt,
            updatedAt,
          },
        ];
      })
    : [];

  const backgroundAssetRelativePaths = Array.isArray(obj.backgroundAssetRelativePaths)
    ? [...new Set(
        obj.backgroundAssetRelativePaths
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      )]
    : [];

  return {
    presetId: preset.id,
    borderStyle: normalizeSteamAchievementBorderStyle(
      obj.borderStyle,
      typeof obj.borderOverlayId === 'string' ? obj.borderOverlayId : null,
    ),
    backgroundAdjustments: normalizeSteamAchievementBackgroundAdjustmentState(obj.backgroundAdjustments),
    backgroundAssetRelativePaths,
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
  const stem = sanitizeExportFileStem(entryName, DEFAULT_NAME);
  return {
    color: `${stem}.png`,
    grayscale: preset.exportGrayscale ? `${stem}${preset.grayscaleSuffix}.png` : null,
  };
};

export const renderSteamAchievementBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  preset: SteamImagePreset;
  transform: SteamAchievementTransform;
}): Uint8Array =>
  renderCoverBitmap({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    sourceBgra: input.sourceBgra,
    size: input.preset,
    transform: input.transform,
    limits: {
      minZoom: MIN_STEAM_ACHIEVEMENT_ZOOM,
      maxZoom: MAX_STEAM_ACHIEVEMENT_ZOOM,
    },
  });

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
  // Match CSS linear-gradient semantics: 0deg points upward, 90deg points right.
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
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
  rect: { left: number; top: number; width: number; height: number },
  clipRect: { left: number; top: number; width: number; height: number; radius: number },
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
        !isInsideRoundedRect(targetX + 0.5, targetY + 0.5, clipRect)
      ) {
        continue;
      }
      const sourceOffset = (y * rect.width + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      const alpha = (bitmap[sourceOffset + 3] ?? 0) / 255;
      target[targetOffset] = blendChannel(target[targetOffset], bitmap[sourceOffset], alpha);
      target[targetOffset + 1] = blendChannel(target[targetOffset + 1], bitmap[sourceOffset + 1], alpha);
      target[targetOffset + 2] = blendChannel(target[targetOffset + 2], bitmap[sourceOffset + 2], alpha);
      target[targetOffset + 3] = Math.round(
        Math.max(target[targetOffset + 3], bitmap[sourceOffset + 3] ?? 0),
      );
    }
  }
};

const applyAchievementImageAdjustments = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  adjustments: SteamAchievementBackgroundAdjustmentState,
): Uint8Array => {
  return applyImageAdjustments(bitmap, width, height, adjustments);
};

const applyVignetteOverlay = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  strength: number,
): Uint8Array => {
  if (strength <= 0) {
    return bitmap;
  }

  const next = new Uint8Array(bitmap);

  const centerX = (width - 1) * 0.5;
  const centerY = (height - 1) * 0.5;
  const maxDistance = Math.max(1, Math.sqrt(centerX * centerX + centerY * centerY));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDistance;
      const edgeStrength = Math.max(0, distance - 0.35) / 0.65;
      const vignetteAlpha = Math.max(0, Math.min(1, edgeStrength * edgeStrength * strength * 0.78));
      const vignetteFactor = 1 - vignetteAlpha;
      next[offset] = Math.max(0, Math.min(255, Math.round(next[offset] * vignetteFactor)));
      next[offset + 1] = Math.max(0, Math.min(255, Math.round(next[offset + 1] * vignetteFactor)));
      next[offset + 2] = Math.max(0, Math.min(255, Math.round(next[offset + 2] * vignetteFactor)));
      next[offset + 3] = Math.max(next[offset + 3], Math.round(255 * vignetteAlpha));
    }
  }

  return next;
};

export const composeSteamAchievementFrameBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  preset: SteamImagePreset;
  transform: SteamAchievementTransform;
  imageStyle?: SteamAchievementEntryImageStyle;
  borderStyle: SteamAchievementBorderStyle;
  backgroundAdjustments?: SteamAchievementBackgroundAdjustmentState;
  backgroundImageBgra?: Uint8Array | null;
  backgroundImageWidth?: number;
  backgroundImageHeight?: number;
}): Uint8Array => {
  const frameRect = getSteamAchievementFrameRect(input.preset.width, input.preset.height, input.borderStyle);
  const backgroundBitmap = createSteamAchievementBackgroundBitmap({
    width: input.preset.width,
    height: input.preset.height,
    borderStyle: input.borderStyle,
    backgroundAdjustments: input.backgroundAdjustments,
    backgroundImageBgra: input.backgroundImageBgra,
    backgroundImageWidth: input.backgroundImageWidth,
    backgroundImageHeight: input.backgroundImageHeight,
  });
  const imageDrawRect = getSteamAchievementDrawRect(
    input.sourceWidth,
    input.sourceHeight,
    {
      ...input.preset,
      width: frameRect.width,
      height: frameRect.height,
    },
    input.transform,
  );
  const imageRect = {
    left: frameRect.left + Math.round(imageDrawRect.left),
    top: frameRect.top + Math.round(imageDrawRect.top),
    width: Math.max(1, Math.round(imageDrawRect.width)),
    height: Math.max(1, Math.round(imageDrawRect.height)),
  };
  const renderedImageBitmap = renderScaledBitmap({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    sourceBgra: input.sourceBgra,
    width: imageRect.width,
    height: imageRect.height,
  });
  const imageStyle = input.imageStyle ?? createDefaultSteamAchievementEntryImageStyle();
  const imageBitmap = applyBlurLayer(
    applyImageAdjustments(
      renderedImageBitmap,
      imageRect.width,
      imageRect.height,
      imageStyle.adjustments,
    ),
    imageRect.width,
    imageRect.height,
    {
      enabled: imageStyle.adjustments.blurEnabled,
      blurRadius: imageStyle.adjustments.blurRadius,
      opacity: imageStyle.adjustments.blurOpacity,
    },
  );
  if (imageStyle.shadow.enabled && imageStyle.shadow.opacity > 0 && imageStyle.shadow.blur > 0) {
    const shadowBitmap = applyBlurLayer(
      createShadowMask(imageBitmap, imageStyle.shadow.opacity),
      imageRect.width,
      imageRect.height,
      {
        enabled: true,
        blurRadius: imageStyle.shadow.blur,
        opacity: 1,
      },
    );
    compositeBitmap(backgroundBitmap, input.preset.width, input.preset.height, shadowBitmap, {
      left: imageRect.left + Math.round(imageStyle.shadow.offsetX),
      top: imageRect.top + Math.round(imageStyle.shadow.offsetY),
      width: imageRect.width,
      height: imageRect.height,
    });
  }
  compositeBitmapIntoRoundedRect(
    backgroundBitmap,
    input.preset.width,
    input.preset.height,
    imageBitmap,
    imageRect,
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
  backgroundAdjustments?: SteamAchievementBackgroundAdjustmentState;
  backgroundImageBgra?: Uint8Array | null;
  backgroundImageWidth?: number;
  backgroundImageHeight?: number;
}): Uint8Array => {
  const output = new Uint8Array(input.width * input.height * 4);
  const style = input.borderStyle;
  const adjustments =
    input.backgroundAdjustments ?? createDefaultSteamAchievementBackgroundAdjustmentState();
  const shouldApplyGradient =
    style.backgroundMode === 'image' &&
    style.backgroundGradientOverlayEnabled &&
    style.backgroundGradientOpacity > 0;

  if (style.backgroundMode === 'none') {
    return applyVignetteOverlay(output, input.width, input.height, adjustments.vignette);
  }

  if (
    style.backgroundOpacity <= 0 &&
    !shouldApplyGradient &&
    adjustments.vignette <= 0
  ) {
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
    const adjustedCoverBitmap = applyBlurLayer(
      applyAchievementImageAdjustments(coverBitmap, input.width, input.height, adjustments),
      input.width,
      input.height,
      {
        enabled: adjustments.blurEnabled,
        blurRadius: adjustments.blurRadius,
        opacity: adjustments.blurOpacity,
      },
    );
    for (let index = 0; index < output.length; index += 4) {
      output[index] = blendChannel(0, adjustedCoverBitmap[index], style.backgroundOpacity);
      output[index + 1] = blendChannel(0, adjustedCoverBitmap[index + 1], style.backgroundOpacity);
      output[index + 2] = blendChannel(0, adjustedCoverBitmap[index + 2], style.backgroundOpacity);
      output[index + 3] = Math.round(255 * style.backgroundOpacity);
    }
    if (!shouldApplyGradient) {
      return applyVignetteOverlay(output, input.width, input.height, adjustments.vignette);
    }
  }

  const backgroundWithVignette = applyVignetteOverlay(output, input.width, input.height, adjustments.vignette);
  if (!shouldApplyGradient) {
    return backgroundWithVignette;
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
      backgroundWithVignette[offset] = blendChannel(
        backgroundWithVignette[offset],
        color.b,
        style.backgroundGradientOpacity,
      );
      backgroundWithVignette[offset + 1] = blendChannel(
        backgroundWithVignette[offset + 1],
        color.g,
        style.backgroundGradientOpacity,
      );
      backgroundWithVignette[offset + 2] = blendChannel(
        backgroundWithVignette[offset + 2],
        color.r,
        style.backgroundGradientOpacity,
      );
      backgroundWithVignette[offset + 3] = Math.max(
        backgroundWithVignette[offset + 3],
        Math.round(255 * style.backgroundGradientOpacity),
      );
    }
  }
  return backgroundWithVignette;
};

const createShadowMask = (
  bitmap: Uint8Array,
  opacity: number,
): Uint8Array => {
  const next = new Uint8Array(bitmap.length);
  for (let index = 0; index < bitmap.length; index += 4) {
    next[index] = 0;
    next[index + 1] = 0;
    next[index + 2] = 0;
    next[index + 3] = Math.round((bitmap[index + 3] ?? 0) * opacity);
  }
  return next;
};

const compositeBitmap = (
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  bitmap: Uint8Array,
  rect: { left: number; top: number; width: number; height: number },
): void => {
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const targetX = rect.left + x;
      const targetY = rect.top + y;
      if (targetX < 0 || targetY < 0 || targetX >= targetWidth || targetY >= targetHeight) {
        continue;
      }
      const sourceOffset = (y * rect.width + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      const alpha = (bitmap[sourceOffset + 3] ?? 0) / 255;
      target[targetOffset] = blendChannel(target[targetOffset], bitmap[sourceOffset], alpha);
      target[targetOffset + 1] = blendChannel(target[targetOffset + 1], bitmap[sourceOffset + 1], alpha);
      target[targetOffset + 2] = blendChannel(target[targetOffset + 2], bitmap[sourceOffset + 2], alpha);
      target[targetOffset + 3] = Math.round(
        Math.max(target[targetOffset + 3], bitmap[sourceOffset + 3] ?? 0),
      );
    }
  }
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
  adjustments?: SteamAchievementBackgroundAdjustmentState,
  backgroundAssetUrl?: string | null,
): React.CSSProperties => {
  if (borderStyle.backgroundMode === 'none' || borderStyle.backgroundOpacity <= 0) {
    return { display: 'none' };
  }

  const backgroundAdjustments =
    adjustments ?? createDefaultSteamAchievementBackgroundAdjustmentState();
  if (borderStyle.backgroundMode === 'image' && backgroundAssetUrl) {
    return {
      backgroundImage: `url("${backgroundAssetUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      filter: buildCssImageAdjustmentFilter(backgroundAdjustments),
      opacity: borderStyle.backgroundOpacity,
    };
  }

  return { display: 'none' };
};

export const buildSteamAchievementBackgroundBlurCss = (
  borderStyle: SteamAchievementBorderStyle,
  adjustments?: SteamAchievementBackgroundAdjustmentState,
  backgroundAssetUrl?: string | null,
): React.CSSProperties => {
  if (
    borderStyle.backgroundMode !== 'image' ||
    !backgroundAssetUrl
  ) {
    return { display: 'none' };
  }

  const backgroundAdjustments =
    adjustments ?? createDefaultSteamAchievementBackgroundAdjustmentState();
  return {
    backgroundImage: `url("${backgroundAssetUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: `${buildCssImageAdjustmentFilter(backgroundAdjustments)} ${buildCssBlurFilter(
      {
        enabled: backgroundAdjustments.blurEnabled,
        blurRadius: backgroundAdjustments.blurRadius * 0.12,
        opacity: backgroundAdjustments.blurOpacity,
      },
    )}`.trim(),
    opacity:
      borderStyle.backgroundOpacity *
      (backgroundAdjustments.blurEnabled ? backgroundAdjustments.blurOpacity : 0),
  };
};

export const buildSteamAchievementBackgroundGradientOverlayCss = (
  borderStyle: SteamAchievementBorderStyle,
): React.CSSProperties => {
  const showGradient = borderStyle.backgroundMode === 'image' && borderStyle.backgroundGradientOverlayEnabled;
  if (!showGradient || borderStyle.backgroundGradientOpacity <= 0) {
    return { display: 'none' };
  }
  return {
    backgroundImage: `linear-gradient(${borderStyle.backgroundAngle}deg, ${toRgbaString(borderStyle.backgroundColor, borderStyle.backgroundGradientOpacity)} 0%, ${toRgbaString(borderStyle.backgroundMidColor, borderStyle.backgroundGradientOpacity)} 52%, ${toRgbaString(borderStyle.backgroundGradientColor, borderStyle.backgroundGradientOpacity)} 100%)`,
  };
};

export const buildSteamAchievementBackgroundVignetteCss = (
  adjustments: SteamAchievementBackgroundAdjustmentState,
): React.CSSProperties => ({
  background: `radial-gradient(circle at center, rgba(0, 0, 0, 0) 34%, rgba(0, 0, 0, ${adjustments.vignette * 0.78}) 100%)`,
  opacity: adjustments.vignette > 0 ? 1 : 0,
});

export const buildSteamAchievementImageCss = (
  imageStyle: SteamAchievementEntryImageStyle,
): React.CSSProperties => ({
  filter: `${buildCssImageAdjustmentFilter(imageStyle.adjustments)} ${buildCssShadowFilter(
    imageStyle.shadow,
  )}`.trim(),
});

export const buildSteamAchievementImageBlurCss = (
  imageStyle: SteamAchievementEntryImageStyle,
  scale = 1,
): React.CSSProperties => ({
  filter: `${buildCssImageAdjustmentFilter(imageStyle.adjustments)} ${buildCssBlurFilter(
    {
      enabled: imageStyle.adjustments.blurEnabled,
      blurRadius: imageStyle.adjustments.blurRadius * scale,
      opacity: imageStyle.adjustments.blurOpacity,
    },
  )}`.trim(),
  opacity: imageStyle.adjustments.blurEnabled ? imageStyle.adjustments.blurOpacity : 0,
});

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
