export type CoverTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type RasterSize = {
  width: number;
  height: number;
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
