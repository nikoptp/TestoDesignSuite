import React from 'react';
import { createId } from '../../shared/tree-utils';
import {
  applyBlurLayer,
  applyImageAdjustments,
  buildCssImageAdjustmentFilter,
  blurBitmap,
  clampCoverTransform,
  getCoverDrawRect,
  normalizeCoverTransform,
  rectToPercentStyle,
  renderCoverBitmap,
  sanitizeExportFileStem,
} from '../../shared/image-workbench';
import type {
  ProjectImageAsset,
  SteamMarketplaceAssetData,
  SteamMarketplaceCropTransform,
  SteamMarketplaceEntry,
  SteamMarketplaceExportRequest,
  SteamMarketplaceGradientOverlayState,
  SteamMarketplaceImageAdjustmentState,
  SteamMarketplaceLogoOverlayState,
  SteamMarketplaceOutputState,
  SteamMarketplaceOverlayState,
  SteamMarketplacePreset,
} from '../../shared/types';

export const MIN_STEAM_MARKETPLACE_ZOOM = 1;
export const MAX_STEAM_MARKETPLACE_ZOOM = 12;
export const MIN_STEAM_MARKETPLACE_LOGO_SCALE = 0.1;
export const MAX_STEAM_MARKETPLACE_LOGO_SCALE = 3.5;

const DEFAULT_NAME = 'marketplace-asset';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const STEAM_MARKETPLACE_PRESETS: SteamMarketplacePreset[] = [
  { id: 'header-capsule', label: 'Header Capsule', width: 920, height: 430, format: 'png', fileStem: 'header-capsule', kind: 'image', allowLogoOverlay: true },
  { id: 'small-capsule', label: 'Small Capsule', width: 462, height: 174, format: 'png', fileStem: 'small-capsule', kind: 'image', allowLogoOverlay: true },
  { id: 'main-capsule', label: 'Main Capsule', width: 1232, height: 706, format: 'png', fileStem: 'main-capsule', kind: 'image', allowLogoOverlay: true },
  { id: 'vertical-capsule', label: 'Vertical Capsule', width: 748, height: 896, format: 'png', fileStem: 'vertical-capsule', kind: 'image', allowLogoOverlay: true },
  { id: 'page-background', label: 'Page Background', width: 1438, height: 810, format: 'png', fileStem: 'page-background', kind: 'image', allowLogoOverlay: true },
  { id: 'bundle-header', label: 'Bundle Header', width: 707, height: 232, format: 'png', fileStem: 'bundle-header', kind: 'image', allowLogoOverlay: true },
  { id: 'library-capsule', label: 'Library Capsule', width: 600, height: 900, format: 'png', fileStem: 'library-capsule', kind: 'image', allowLogoOverlay: true },
  { id: 'library-header', label: 'Library Header', width: 920, height: 430, format: 'png', fileStem: 'library-header', kind: 'image', allowLogoOverlay: true },
  { id: 'library-hero', label: 'Library Hero', width: 3840, height: 1240, format: 'png', fileStem: 'library-hero', kind: 'image', allowLogoOverlay: true },
  { id: 'library-logo', label: 'Library Logo', width: 1280, height: 720, format: 'png', fileStem: 'library-logo', kind: 'logo', backgroundTransparent: true },
  { id: 'event-cover', label: 'Event Cover', width: 800, height: 450, format: 'png', fileStem: 'event-cover', kind: 'image', allowLogoOverlay: true },
  { id: 'event-header', label: 'Event Header', width: 1920, height: 622, format: 'png', fileStem: 'event-header', kind: 'image', allowLogoOverlay: true },
  { id: 'shortcut-icon', label: 'Shortcut Icon', width: 256, height: 256, format: 'png', fileStem: 'shortcut-icon', kind: 'image' },
  { id: 'app-icon', label: 'App Icon', width: 184, height: 184, format: 'jpg', fileStem: 'app-icon', kind: 'image' },
  { id: 'screenshot-baseline', label: 'Screenshot Baseline', width: 1920, height: 1080, format: 'png', fileStem: 'screenshot-baseline', kind: 'image' },
];

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

export const getSteamMarketplacePreset = (presetId: string): SteamMarketplacePreset =>
  STEAM_MARKETPLACE_PRESETS.find((preset) => preset.id === presetId) ?? STEAM_MARKETPLACE_PRESETS[0];

export const getSteamMarketplaceAssetByPath = (
  assets: ProjectImageAsset[],
  relativePath: string | null,
): ProjectImageAsset | null => {
  if (!relativePath) {
    return null;
  }
  return assets.find((asset) => asset.relativePath === relativePath) ?? null;
};

export const createDefaultSteamMarketplaceCropTransform = (): SteamMarketplaceCropTransform => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
});

export const normalizeSteamMarketplaceCropTransform = (
  input: Partial<SteamMarketplaceCropTransform> | null | undefined,
): SteamMarketplaceCropTransform =>
  normalizeCoverTransform(input, {
    minZoom: MIN_STEAM_MARKETPLACE_ZOOM,
    maxZoom: MAX_STEAM_MARKETPLACE_ZOOM,
  });

export const clampSteamMarketplaceCropTransform = (
  sourceWidth: number,
  sourceHeight: number,
  preset: { width: number; height: number },
  input: Partial<SteamMarketplaceCropTransform> | null | undefined,
): SteamMarketplaceCropTransform =>
  clampCoverTransform(sourceWidth, sourceHeight, preset, input, {
    minZoom: MIN_STEAM_MARKETPLACE_ZOOM,
    maxZoom: MAX_STEAM_MARKETPLACE_ZOOM,
  });

export const getSteamMarketplaceDrawRect = (
  sourceWidth: number,
  sourceHeight: number,
  preset: { width: number; height: number },
  transform: SteamMarketplaceCropTransform,
): { width: number; height: number; left: number; top: number } =>
  getCoverDrawRect(sourceWidth, sourceHeight, preset, transform, {
    minZoom: MIN_STEAM_MARKETPLACE_ZOOM,
    maxZoom: MAX_STEAM_MARKETPLACE_ZOOM,
  });

export const createDefaultSteamMarketplaceGradientOverlay = (): SteamMarketplaceGradientOverlayState => ({
  enabled: true,
  angle: 180,
  opacity: 0.42,
  color: '#0b1324',
  midColor: '#27436b',
  endColor: '#02060d',
});

export const createDefaultSteamMarketplaceBlurOverlay = () => ({
  enabled: false,
  blurRadius: 12,
  opacity: 0.35,
});

export const createDefaultSteamMarketplaceImageAdjustmentState = (): SteamMarketplaceImageAdjustmentState => ({
  saturation: 1,
  contrast: 1,
  vignette: 0,
});

export const createDefaultSteamMarketplaceLogoOverlay = (): SteamMarketplaceLogoOverlayState => ({
  enabled: true,
  opacity: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  shadowEnabled: false,
  shadowBlur: 18,
  shadowOpacity: 0.4,
  shadowOffsetX: 0,
  shadowOffsetY: 12,
});

export const createDefaultSteamMarketplaceOverlayState = (): SteamMarketplaceOverlayState => ({
  gradient: createDefaultSteamMarketplaceGradientOverlay(),
  blur: createDefaultSteamMarketplaceBlurOverlay(),
  image: createDefaultSteamMarketplaceImageAdjustmentState(),
  logo: createDefaultSteamMarketplaceLogoOverlay(),
});

export const createDefaultSteamMarketplaceOutputState = (): SteamMarketplaceOutputState => ({
  enabled: true,
  crop: createDefaultSteamMarketplaceCropTransform(),
  overlays: createDefaultSteamMarketplaceOverlayState(),
});

export const createSteamMarketplaceOutputStateRecord = (): Record<string, SteamMarketplaceOutputState> =>
  Object.fromEntries(
    STEAM_MARKETPLACE_PRESETS.map((preset) => [preset.id, createDefaultSteamMarketplaceOutputState()]),
  );

export const normalizeSteamMarketplaceEntryName = (
  value: string,
  fallback = DEFAULT_NAME,
): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const normalized = [...trimmed]
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  return (normalized || fallback).slice(0, 80);
};

export const deriveSteamMarketplaceNameFromPath = (
  value: string,
  fallback = DEFAULT_NAME,
): string => {
  const fileName = value.split('/').pop() ?? value;
  return normalizeSteamMarketplaceEntryName(fileName.replace(/\.[^.]+$/, ''), fallback);
};

const inferSteamMarketplacePresetIdFromEntry = (name: string | undefined): string => {
  const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return (
    STEAM_MARKETPLACE_PRESETS.find((preset) => preset.label.trim().toLowerCase() === normalizedName)?.id ??
    STEAM_MARKETPLACE_PRESETS[0].id
  );
};

const normalizeLogoOverlayState = (
  input: unknown,
): SteamMarketplaceLogoOverlayState => {
  const fallback = createDefaultSteamMarketplaceLogoOverlay();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamMarketplaceLogoOverlayState>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? Math.min(1, Math.max(0, obj.opacity))
        : fallback.opacity,
    scale:
      typeof obj.scale === 'number' && Number.isFinite(obj.scale)
        ? Math.min(MAX_STEAM_MARKETPLACE_LOGO_SCALE, Math.max(MIN_STEAM_MARKETPLACE_LOGO_SCALE, obj.scale))
        : fallback.scale,
    offsetX:
      typeof obj.offsetX === 'number' && Number.isFinite(obj.offsetX)
        ? Math.min(100, Math.max(-100, obj.offsetX))
        : fallback.offsetX,
    offsetY:
      typeof obj.offsetY === 'number' && Number.isFinite(obj.offsetY)
        ? Math.min(100, Math.max(-100, obj.offsetY))
        : fallback.offsetY,
    shadowEnabled: typeof obj.shadowEnabled === 'boolean' ? obj.shadowEnabled : fallback.shadowEnabled,
    shadowBlur:
      typeof obj.shadowBlur === 'number' && Number.isFinite(obj.shadowBlur)
        ? Math.min(96, Math.max(0, obj.shadowBlur))
        : fallback.shadowBlur,
    shadowOpacity:
      typeof obj.shadowOpacity === 'number' && Number.isFinite(obj.shadowOpacity)
        ? Math.min(1, Math.max(0, obj.shadowOpacity))
        : fallback.shadowOpacity,
    shadowOffsetX:
      typeof obj.shadowOffsetX === 'number' && Number.isFinite(obj.shadowOffsetX)
        ? obj.shadowOffsetX
        : fallback.shadowOffsetX,
    shadowOffsetY:
      typeof obj.shadowOffsetY === 'number' && Number.isFinite(obj.shadowOffsetY)
        ? obj.shadowOffsetY
        : fallback.shadowOffsetY,
  };
};

const normalizeGradientOverlayState = (input: unknown): SteamMarketplaceGradientOverlayState => {
  const fallback = createDefaultSteamMarketplaceGradientOverlay();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamMarketplaceGradientOverlayState>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    angle: normalizeAngle(obj.angle, fallback.angle),
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? Math.min(1, Math.max(0, obj.opacity))
        : fallback.opacity,
    color: normalizeHexColor(obj.color, fallback.color),
    midColor: normalizeHexColor(obj.midColor, fallback.midColor),
    endColor: normalizeHexColor(obj.endColor, fallback.endColor),
  };
};

const normalizeBlurOverlayState = (input: unknown) => {
  const fallback = createDefaultSteamMarketplaceBlurOverlay();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<{ enabled: boolean; blurRadius: number; opacity: number }>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    blurRadius:
      typeof obj.blurRadius === 'number' && Number.isFinite(obj.blurRadius)
        ? Math.min(64, Math.max(0, obj.blurRadius))
        : fallback.blurRadius,
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? Math.min(1, Math.max(0, obj.opacity))
        : fallback.opacity,
  };
};

const normalizeImageAdjustmentState = (input: unknown): SteamMarketplaceImageAdjustmentState => {
  const fallback = createDefaultSteamMarketplaceImageAdjustmentState();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamMarketplaceImageAdjustmentState>;
  return {
    saturation:
      typeof obj.saturation === 'number' && Number.isFinite(obj.saturation)
        ? Math.min(2, Math.max(0, obj.saturation))
        : fallback.saturation,
    contrast:
      typeof obj.contrast === 'number' && Number.isFinite(obj.contrast)
        ? Math.min(2, Math.max(0.4, obj.contrast))
        : fallback.contrast,
    vignette:
      typeof obj.vignette === 'number' && Number.isFinite(obj.vignette)
        ? Math.min(1, Math.max(0, obj.vignette))
        : fallback.vignette,
  };
};

export const normalizeSteamMarketplaceOverlayState = (
  input: unknown,
): SteamMarketplaceOverlayState => {
  const obj = typeof input === 'object' && input !== null ? input as Partial<SteamMarketplaceOverlayState> : null;
  return {
    gradient: normalizeGradientOverlayState(obj?.gradient),
    blur: normalizeBlurOverlayState(obj?.blur),
    image: normalizeImageAdjustmentState(obj?.image),
    logo: normalizeLogoOverlayState(obj?.logo),
  };
};

export const normalizeSteamMarketplaceOutputState = (
  input: unknown,
): SteamMarketplaceOutputState => {
  const fallback = createDefaultSteamMarketplaceOutputState();
  if (typeof input !== 'object' || input === null) {
    return fallback;
  }
  const obj = input as Partial<SteamMarketplaceOutputState>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    crop: normalizeSteamMarketplaceCropTransform(obj.crop),
    overlays: normalizeSteamMarketplaceOverlayState(obj.overlays),
  };
};

export const createSteamMarketplaceEntry = (name = DEFAULT_NAME): SteamMarketplaceEntry => {
  const now = Date.now();
  return {
    id: createId('steam-marketplace'),
    name: normalizeSteamMarketplaceEntryName(name),
    presetId: STEAM_MARKETPLACE_PRESETS[0].id,
    sourceImageRelativePath: null,
    logoImageRelativePath: null,
    outputsByPresetId: createSteamMarketplaceOutputStateRecord(),
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeSteamMarketplaceOutputsByPresetId = (
  input: unknown,
): Record<string, SteamMarketplaceOutputState> => {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return Object.fromEntries(
    STEAM_MARKETPLACE_PRESETS.map((preset) => [
      preset.id,
      normalizeSteamMarketplaceOutputState(source[preset.id]),
    ]),
  );
};

export const createDefaultSteamMarketplaceAssetData = (): SteamMarketplaceAssetData => ({
  entries: [],
  logoAssetRelativePaths: [],
});

export const normalizeSteamMarketplaceAssetData = (input: unknown): SteamMarketplaceAssetData => {
  if (typeof input !== 'object' || input === null) {
    return createDefaultSteamMarketplaceAssetData();
  }
  const obj = input as { entries?: unknown; logoAssetRelativePaths?: unknown };
  const entries = Array.isArray(obj.entries)
    ? obj.entries.flatMap((entry): SteamMarketplaceEntry[] => {
        if (typeof entry !== 'object' || entry === null) {
          return [];
        }
        const item = entry as Partial<SteamMarketplaceEntry>;
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
            name: normalizeSteamMarketplaceEntryName(
              typeof item.name === 'string' ? item.name : DEFAULT_NAME,
            ),
            presetId:
              typeof item.presetId === 'string' && item.presetId.trim()
                ? getSteamMarketplacePreset(item.presetId.trim()).id
                : inferSteamMarketplacePresetIdFromEntry(typeof item.name === 'string' ? item.name : undefined),
            sourceImageRelativePath:
              typeof item.sourceImageRelativePath === 'string' && item.sourceImageRelativePath.trim()
                ? item.sourceImageRelativePath.trim()
                : null,
            logoImageRelativePath:
              typeof item.logoImageRelativePath === 'string' && item.logoImageRelativePath.trim()
                ? item.logoImageRelativePath.trim()
                : null,
            outputsByPresetId: normalizeSteamMarketplaceOutputsByPresetId(item.outputsByPresetId),
            createdAt,
            updatedAt,
          },
        ];
      })
    : [];

  const logoAssetRelativePaths = Array.isArray(obj.logoAssetRelativePaths)
    ? [...new Set(
        obj.logoAssetRelativePaths
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      )]
    : [];

  return { entries, logoAssetRelativePaths };
};

export const buildSteamMarketplaceExportFileName = (
  entryName: string,
  preset: SteamMarketplacePreset,
): string => `${sanitizeExportFileStem(entryName, DEFAULT_NAME)}-${preset.fileStem}.${preset.format}`;

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

const blendChannel = (source: number, target: number, alpha: number): number =>
  Math.round(source * (1 - alpha) + target * alpha);

const compositeBitmap = (
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  bitmap: Uint8Array,
  drawRect: { width: number; height: number; left: number; top: number },
): void => {
  for (let y = 0; y < drawRect.height; y += 1) {
    for (let x = 0; x < drawRect.width; x += 1) {
      const targetX = drawRect.left + x;
      const targetY = drawRect.top + y;
      if (targetX < 0 || targetY < 0 || targetX >= targetWidth || targetY >= targetHeight) {
        continue;
      }
      const sourceOffset = (y * drawRect.width + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      const alpha = (bitmap[sourceOffset + 3] ?? 0) / 255;
      target[targetOffset] = blendChannel(target[targetOffset], bitmap[sourceOffset], alpha);
      target[targetOffset + 1] = blendChannel(target[targetOffset + 1], bitmap[sourceOffset + 1], alpha);
      target[targetOffset + 2] = blendChannel(target[targetOffset + 2], bitmap[sourceOffset + 2], alpha);
      target[targetOffset + 3] = Math.round(Math.max(target[targetOffset + 3], bitmap[sourceOffset + 3] ?? 0));
    }
  }
};

const createGradientOverlayBitmap = (
  width: number,
  height: number,
  overlay: SteamMarketplaceGradientOverlayState,
): Uint8Array => {
  const output = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = sampleGradientColor(overlay.angle, width, height, x, y, [
        overlay.color,
        overlay.midColor,
        overlay.endColor,
      ]);
      const offset = (y * width + x) * 4;
      output[offset] = color.b;
      output[offset + 1] = color.g;
      output[offset + 2] = color.r;
      output[offset + 3] = Math.round(255 * overlay.opacity);
    }
  }
  return output;
};

const applyMarketplaceImageAdjustments = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  adjustments: SteamMarketplaceImageAdjustmentState,
): Uint8Array => {
  const next = applyImageAdjustments(bitmap, width, height, adjustments);
  const vignette = adjustments.vignette;
  if (vignette <= 0) {
    return next;
  }

  const centerX = (width - 1) * 0.5;
  const centerY = (height - 1) * 0.5;
  const maxDistance = Math.max(1, Math.sqrt(centerX * centerX + centerY * centerY));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDistance;
      const edgeStrength = Math.max(0, distance - 0.35) / 0.65;
      const vignetteFactor = 1 - edgeStrength * edgeStrength * vignette * 0.85;
      next[offset] = Math.max(0, Math.min(255, Math.round(next[offset] * vignetteFactor)));
      next[offset + 1] = Math.max(0, Math.min(255, Math.round(next[offset + 1] * vignetteFactor)));
      next[offset + 2] = Math.max(0, Math.min(255, Math.round(next[offset + 2] * vignetteFactor)));
    }
  }

  return next;
};

const createLogoShadowBitmap = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  opacity: number,
): Uint8Array => {
  const next = new Uint8Array(bitmap.length);
  for (let index = 0; index < bitmap.length; index += 4) {
    const alpha = Math.round((bitmap[index + 3] ?? 0) * opacity);
    next[index] = 0;
    next[index + 1] = 0;
    next[index + 2] = 0;
    next[index + 3] = alpha;
  }
  return next;
};

export const getSteamMarketplaceLogoDrawRect = (
  sourceWidth: number,
  sourceHeight: number,
  preset: { width: number; height: number },
  scaleMultiplier: number,
  offsetXPercent: number,
  offsetYPercent: number,
): { width: number; height: number; left: number; top: number } => {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const baseScale = Math.min(preset.width / safeWidth, preset.height / safeHeight);
  const scale = baseScale * scaleMultiplier;
  const width = safeWidth * scale;
  const height = safeHeight * scale;

  const offsetX = (preset.width * offsetXPercent) / 100;
  const offsetY = (preset.height * offsetYPercent) / 100;

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    left: Math.round((preset.width - width) * 0.5 + offsetX),
    top: Math.round((preset.height - height) * 0.5 + offsetY),
  };
};

export const renderSteamMarketplaceBitmap = (input: {
  preset: SteamMarketplacePreset;
  output: SteamMarketplaceOutputState;
  baseSourceWidth?: number;
  baseSourceHeight?: number;
  baseSourceBgra?: Uint8Array | null;
  logoSourceWidth?: number;
  logoSourceHeight?: number;
  logoSourceBgra?: Uint8Array | null;
}): Uint8Array => {
  const { preset, output } = input;
  const canvas = new Uint8Array(preset.width * preset.height * 4);

  if (preset.kind === 'image' && input.baseSourceBgra && input.baseSourceWidth && input.baseSourceHeight) {
    const renderedBaseBitmap = renderCoverBitmap({
      sourceWidth: input.baseSourceWidth,
      sourceHeight: input.baseSourceHeight,
      sourceBgra: input.baseSourceBgra,
      size: preset,
      transform: output.crop,
      limits: {
        minZoom: MIN_STEAM_MARKETPLACE_ZOOM,
        maxZoom: MAX_STEAM_MARKETPLACE_ZOOM,
      },
    });
    const baseBitmap = applyMarketplaceImageAdjustments(
      renderedBaseBitmap,
      preset.width,
      preset.height,
      output.overlays.image,
    );
    canvas.set(baseBitmap);

    canvas.set(applyBlurLayer(baseBitmap, preset.width, preset.height, output.overlays.blur));

    if (output.overlays.gradient.enabled && output.overlays.gradient.opacity > 0) {
      const gradient = createGradientOverlayBitmap(preset.width, preset.height, output.overlays.gradient);
      for (let index = 0; index < canvas.length; index += 4) {
        const alpha = (gradient[index + 3] ?? 0) / 255;
        canvas[index] = blendChannel(canvas[index], gradient[index], alpha);
        canvas[index + 1] = blendChannel(canvas[index + 1], gradient[index + 1], alpha);
        canvas[index + 2] = blendChannel(canvas[index + 2], gradient[index + 2], alpha);
        canvas[index + 3] = Math.max(canvas[index + 3], gradient[index + 3]);
      }
    }
  }

  if (
    input.logoSourceBgra &&
    input.logoSourceWidth &&
    input.logoSourceHeight &&
    (preset.kind === 'logo' || (preset.allowLogoOverlay && output.overlays.logo.enabled))
  ) {
    const rect = getSteamMarketplaceLogoDrawRect(
      input.logoSourceWidth,
      input.logoSourceHeight,
      preset,
      output.overlays.logo.scale,
      output.overlays.logo.offsetX,
      output.overlays.logo.offsetY,
    );
    const logoBitmap = renderCoverBitmap({
      sourceWidth: input.logoSourceWidth,
      sourceHeight: input.logoSourceHeight,
      sourceBgra: input.logoSourceBgra,
      size: {
        width: rect.width,
        height: rect.height,
      },
      transform: { zoom: 1, offsetX: 0, offsetY: 0 },
    });
    if (output.overlays.logo.shadowEnabled && output.overlays.logo.shadowOpacity > 0) {
      const shadowBitmap = blurBitmap(
        createLogoShadowBitmap(logoBitmap, rect.width, rect.height, output.overlays.logo.shadowOpacity),
        rect.width,
        rect.height,
        output.overlays.logo.shadowBlur,
      );
      compositeBitmap(canvas, preset.width, preset.height, shadowBitmap, {
        ...rect,
        left: rect.left + Math.round(output.overlays.logo.shadowOffsetX),
        top: rect.top + Math.round(output.overlays.logo.shadowOffsetY),
      });
    }
    if (preset.kind === 'logo') {
      canvas.fill(0);
    }
    compositeBitmap(canvas, preset.width, preset.height, logoBitmap, rect);
    if (output.overlays.logo.opacity < 1) {
      for (let index = 0; index < canvas.length; index += 4) {
        canvas[index + 3] = Math.round(canvas[index + 3] * output.overlays.logo.opacity);
      }
    }
  }

  return canvas;
};

export const buildSteamMarketplacePreviewBackground = (
  output: SteamMarketplaceOutputState,
): React.CSSProperties => ({
  backgroundImage: output.overlays.gradient.enabled
    ? `linear-gradient(${output.overlays.gradient.angle}deg, ${output.overlays.gradient.color} 0%, ${output.overlays.gradient.midColor} 52%, ${output.overlays.gradient.endColor} 100%)`
    : 'none',
  opacity: output.overlays.gradient.enabled ? Math.max(0.1, output.overlays.gradient.opacity) : 0,
});

export const buildSteamMarketplaceImageFilter = (
  output: SteamMarketplaceOutputState,
): string => buildCssImageAdjustmentFilter(output.overlays.image);

export const buildSteamMarketplaceVignetteStyle = (
  output: SteamMarketplaceOutputState,
): React.CSSProperties => ({
  background: `radial-gradient(circle at center, rgba(0, 0, 0, 0) 34%, rgba(0, 0, 0, ${output.overlays.image.vignette * 0.78}) 100%)`,
  opacity: output.overlays.image.vignette > 0 ? 1 : 0,
});

export const buildSteamMarketplaceLogoStyle = (
  output: SteamMarketplaceOutputState,
): React.CSSProperties => ({
  opacity: output.overlays.logo.opacity,
  filter: output.overlays.logo.shadowEnabled
    ? `drop-shadow(${output.overlays.logo.shadowOffsetX}px ${output.overlays.logo.shadowOffsetY}px ${output.overlays.logo.shadowBlur}px rgba(0, 0, 0, ${output.overlays.logo.shadowOpacity}))`
    : 'none',
});

export const getSteamMarketplacePreviewRectStyle = (
  sourceWidth: number,
  sourceHeight: number,
  preset: { width: number; height: number },
  crop: SteamMarketplaceCropTransform,
): { width: string; height: string; left: string; top: string } =>
  rectToPercentStyle(getSteamMarketplaceDrawRect(sourceWidth, sourceHeight, preset, crop), preset);

export const getSteamMarketplaceLogoRectStyle = (
  sourceWidth: number,
  sourceHeight: number,
  preset: { width: number; height: number },
  output: SteamMarketplaceOutputState,
): { width: string; height: string; left: string; top: string } =>
  rectToPercentStyle(
    getSteamMarketplaceLogoDrawRect(
      sourceWidth,
      sourceHeight,
      preset,
      output.overlays.logo.scale,
      output.overlays.logo.offsetX,
      output.overlays.logo.offsetY,
    ),
    preset,
  );

export const buildSteamMarketplaceExportTargets = (
  request: SteamMarketplaceExportRequest,
): Array<{ entry: SteamMarketplaceEntry; preset: SteamMarketplacePreset; output: SteamMarketplaceOutputState }> => {
  const normalized = normalizeSteamMarketplaceAssetData(request.data);
  const entryFilter = request.entryIds ? new Set(request.entryIds) : null;
  const presetFilter = request.presetIds ? new Set(request.presetIds) : null;
  const targets: Array<{ entry: SteamMarketplaceEntry; preset: SteamMarketplacePreset; output: SteamMarketplaceOutputState }> = [];

  normalized.entries.forEach((entry) => {
    if (entryFilter && !entryFilter.has(entry.id)) {
      return;
    }
    const preset = getSteamMarketplacePreset(entry.presetId);
    if (presetFilter && !presetFilter.has(preset.id)) {
      return;
    }
    if (preset.kind === 'logo') {
      if (!entry.logoImageRelativePath) {
        return;
      }
    } else if (!entry.sourceImageRelativePath) {
      return;
    }
    const output = entry.outputsByPresetId[preset.id] ?? createDefaultSteamMarketplaceOutputState();
    targets.push({ entry, preset, output });
  });

  return targets;
};
