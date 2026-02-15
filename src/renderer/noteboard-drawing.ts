import type {
  NoteboardBrushType,
  NoteboardStrokePoint,
  NoteboardStroke,
} from '../shared/types';
import perfectFreehand from 'perfect-freehand';

const MIN_POINT_DISTANCE = 2;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const createStrokeId = (): string =>
  `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createBrushStroke = (
  x: number,
  y: number,
  brush: NoteboardBrushType,
  color: string,
  size: number,
  opacity: number,
): NoteboardStroke => ({
  id: createStrokeId(),
  createdAt: Date.now(),
  brush,
  color,
  size,
  opacity,
  points: [{ x, y, pressure: 0.62, t: Date.now() }],
});

export const appendPointWithPressure = (
  points: NoteboardStrokePoint[],
  next: { x: number; y: number },
  now: number,
): NoteboardStrokePoint[] => {
  const last = points[points.length - 1];
  if (!last) {
    return [{ ...next, pressure: 0.62, t: now }];
  }

  const dx = next.x - last.x;
  const dy = next.y - last.y;
  const distance = Math.hypot(dx, dy);
  if (distance < MIN_POINT_DISTANCE) {
    return points;
  }

  const dt = Math.max(1, now - (last.t ?? now - 16));
  const speed = distance / dt;
  const rawPressure = clamp(1.15 - speed * 1.35, 0.2, 1);
  const lastPressure = last.pressure ?? 0.62;
  const pressure = clamp(lastPressure * 0.62 + rawPressure * 0.38, 0.15, 1);

  return [...points, { ...next, pressure, t: now }];
};

export const buildSmoothPath = (points: NoteboardStrokePoint[]): string => {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y}, ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
};

const buildClosedPathFromOutline = (outline: Array<[number, number]>): string => {
  if (outline.length < 2) {
    return '';
  }

  const first = outline[0];
  let path = `M ${first[0]} ${first[1]}`;

  for (let i = 1; i < outline.length; i += 1) {
    const curr = outline[i];
    const next = outline[(i + 1) % outline.length];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    path += ` Q ${curr[0]} ${curr[1]}, ${midX} ${midY}`;
  }

  path += ' Z';
  return path;
};

export const buildPerfectFreehandPath = (
  points: NoteboardStrokePoint[],
  options: {
    size: number;
    thinning: number;
    smoothing: number;
    streamline: number;
    taperStart: number;
    taperEnd: number;
  },
): string => {
  if (points.length < 2) {
    return '';
  }

  const inputPoints = points.map(
    (point): [number, number, number] => [
      point.x,
      point.y,
      clamp(point.pressure ?? 0.62, 0.05, 1),
    ],
  );
  const outline = perfectFreehand(inputPoints, {
    size: Math.max(1, options.size),
    thinning: clamp(options.thinning, -1, 1),
    smoothing: clamp(options.smoothing, 0, 1),
    streamline: clamp(options.streamline, 0, 1),
    simulatePressure: false,
    start: {
      cap: true,
      taper: Math.max(0, options.taperStart),
    },
    end: {
      cap: true,
      taper: Math.max(0, options.taperEnd),
    },
    last: true,
  });

  return buildClosedPathFromOutline(outline);
};
