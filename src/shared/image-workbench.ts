export type CoverTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type RasterSize = {
  width: number;
  height: number;
};

export type SimpleImageAdjustmentState = {
  saturation: number;
  contrast: number;
};

export type BlurLayerState = {
  enabled: boolean;
  blurRadius: number;
  opacity: number;
};

export type ShadowLayerState = {
  enabled: boolean;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_MIN_COVER_ZOOM = 1;
export const DEFAULT_MAX_COVER_ZOOM = 12;

export const normalizeCoverTransform = (
  transform: Partial<CoverTransform> | null | undefined,
  limits: { minZoom?: number; maxZoom?: number } = {},
): CoverTransform => {
  const minZoom = limits.minZoom ?? DEFAULT_MIN_COVER_ZOOM;
  const maxZoom = limits.maxZoom ?? DEFAULT_MAX_COVER_ZOOM;
  return {
    zoom:
      typeof transform?.zoom === 'number' && Number.isFinite(transform.zoom)
        ? Math.min(maxZoom, Math.max(minZoom, transform.zoom))
        : 1,
    offsetX:
      typeof transform?.offsetX === 'number' && Number.isFinite(transform.offsetX)
        ? transform.offsetX
        : 0,
    offsetY:
      typeof transform?.offsetY === 'number' && Number.isFinite(transform.offsetY)
        ? transform.offsetY
        : 0,
  };
};

export const getCoverDrawRect = (
  sourceWidth: number,
  sourceHeight: number,
  size: RasterSize,
  transform: CoverTransform,
  limits: { minZoom?: number; maxZoom?: number } = {},
): { width: number; height: number; left: number; top: number } => {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const nextTransform = normalizeCoverTransform(transform, limits);
  const baseScale = Math.max(size.width / safeWidth, size.height / safeHeight);
  const scale = baseScale * nextTransform.zoom;
  const width = safeWidth * scale;
  const height = safeHeight * scale;

  return {
    width,
    height,
    left: (size.width - width) * 0.5 + nextTransform.offsetX,
    top: (size.height - height) * 0.5 + nextTransform.offsetY,
  };
};

export const clampCoverTransform = (
  sourceWidth: number,
  sourceHeight: number,
  size: RasterSize,
  transform: Partial<CoverTransform> | null | undefined,
  limits: { minZoom?: number; maxZoom?: number } = {},
): CoverTransform => {
  const next = normalizeCoverTransform(transform, limits);
  const drawRect = getCoverDrawRect(sourceWidth, sourceHeight, size, next, limits);
  const maxOffsetX = Math.max(0, (drawRect.width - size.width) * 0.5);
  const maxOffsetY = Math.max(0, (drawRect.height - size.height) * 0.5);

  return {
    zoom: next.zoom,
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, next.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, next.offsetY)),
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

export const renderCoverBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  size: RasterSize;
  transform: CoverTransform;
  limits?: { minZoom?: number; maxZoom?: number };
}): Uint8Array => {
  const nextTransform = clampCoverTransform(
    input.sourceWidth,
    input.sourceHeight,
    input.size,
    input.transform,
    input.limits,
  );
  const drawRect = getCoverDrawRect(
    input.sourceWidth,
    input.sourceHeight,
    input.size,
    nextTransform,
    input.limits,
  );
  const output = new Uint8Array(input.size.width * input.size.height * 4);

  for (let y = 0; y < input.size.height; y += 1) {
    for (let x = 0; x < input.size.width; x += 1) {
      const sourceX = ((x + 0.5) - drawRect.left) / drawRect.width * input.sourceWidth - 0.5;
      const sourceY = ((y + 0.5) - drawRect.top) / drawRect.height * input.sourceHeight - 0.5;
      const offset = (y * input.size.width + x) * 4;

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

export const renderScaledBitmap = (input: {
  sourceWidth: number;
  sourceHeight: number;
  sourceBgra: Uint8Array;
  width: number;
  height: number;
}): Uint8Array => {
  const targetWidth = Math.max(1, Math.round(input.width));
  const targetHeight = Math.max(1, Math.round(input.height));
  const output = new Uint8Array(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = ((x + 0.5) / targetWidth) * input.sourceWidth - 0.5;
      const sourceY = ((y + 0.5) / targetHeight) * input.sourceHeight - 0.5;
      const offset = (y * targetWidth + x) * 4;

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

export const blurBitmap = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array => {
  if (radius <= 0) {
    return new Uint8Array(bitmap);
  }
  const next = new Uint8Array(bitmap.length);
  const size = Math.max(1, Math.round(radius * 0.5));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let b = 0;
      let g = 0;
      let r = 0;
      let a = 0;
      let count = 0;
      for (let sampleY = Math.max(0, y - size); sampleY <= Math.min(height - 1, y + size); sampleY += 1) {
        for (let sampleX = Math.max(0, x - size); sampleX <= Math.min(width - 1, x + size); sampleX += 1) {
          const offset = (sampleY * width + sampleX) * 4;
          b += bitmap[offset];
          g += bitmap[offset + 1];
          r += bitmap[offset + 2];
          a += bitmap[offset + 3];
          count += 1;
        }
      }
      const offset = (y * width + x) * 4;
      next[offset] = Math.round(b / count);
      next[offset + 1] = Math.round(g / count);
      next[offset + 2] = Math.round(r / count);
      next[offset + 3] = Math.round(a / count);
    }
  }
  return next;
};

const applyContrastChannel = (value: number, contrast: number): number =>
  Math.max(0, Math.min(255, Math.round((value - 128) * contrast + 128)));

export const applyImageAdjustments = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  adjustments: SimpleImageAdjustmentState,
): Uint8Array => {
  const next = new Uint8Array(bitmap);
  const saturation = adjustments.saturation;
  const contrast = adjustments.contrast;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const blue = next[offset];
      const green = next[offset + 1];
      const red = next[offset + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      let adjustedBlue = luminance + (blue - luminance) * saturation;
      let adjustedGreen = luminance + (green - luminance) * saturation;
      let adjustedRed = luminance + (red - luminance) * saturation;

      adjustedBlue = applyContrastChannel(adjustedBlue, contrast);
      adjustedGreen = applyContrastChannel(adjustedGreen, contrast);
      adjustedRed = applyContrastChannel(adjustedRed, contrast);

      next[offset] = Math.max(0, Math.min(255, Math.round(adjustedBlue)));
      next[offset + 1] = Math.max(0, Math.min(255, Math.round(adjustedGreen)));
      next[offset + 2] = Math.max(0, Math.min(255, Math.round(adjustedRed)));
    }
  }

  return next;
};

const blendChannel = (source: number, target: number, alpha: number): number =>
  Math.round(source * (1 - alpha) + target * alpha);

export const applyBlurLayer = (
  bitmap: Uint8Array,
  width: number,
  height: number,
  blur: BlurLayerState,
): Uint8Array => {
  if (!blur.enabled || blur.opacity <= 0 || blur.blurRadius <= 0) {
    return new Uint8Array(bitmap);
  }
  const next = new Uint8Array(bitmap);
  const blurred = blurBitmap(bitmap, width, height, blur.blurRadius);
  for (let index = 0; index < next.length; index += 4) {
    next[index] = blendChannel(next[index], blurred[index], blur.opacity);
    next[index + 1] = blendChannel(next[index + 1], blurred[index + 1], blur.opacity);
    next[index + 2] = blendChannel(next[index + 2], blurred[index + 2], blur.opacity);
    next[index + 3] = Math.max(next[index + 3], blurred[index + 3]);
  }
  return next;
};

export const buildCssImageAdjustmentFilter = (adjustments: SimpleImageAdjustmentState): string =>
  `saturate(${adjustments.saturation}) contrast(${adjustments.contrast})`;

export const buildCssBlurFilter = (blur: BlurLayerState, scale = 1): string =>
  blur.enabled && blur.opacity > 0 && blur.blurRadius > 0
    ? `blur(${Math.max(0, blur.blurRadius * scale)}px)`
    : 'none';

export const buildCssShadowFilter = (shadow: ShadowLayerState): string =>
  shadow.enabled && shadow.opacity > 0 && shadow.blur > 0
    ? `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`
    : 'none';

export const sanitizeExportFileStem = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9._ -]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');

  return normalized || fallback;
};

export const rectToPercentStyle = (
  rect: { width: number; height: number; left: number; top: number },
  size: RasterSize,
): { width: string; height: string; left: string; top: string } => ({
  width: `${(rect.width / size.width) * 100}%`,
  height: `${(rect.height / size.height) * 100}%`,
  left: `${(rect.left / size.width) * 100}%`,
  top: `${(rect.top / size.height) * 100}%`,
});
