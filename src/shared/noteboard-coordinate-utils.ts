import { NOTEBOARD_WORLD_MIN_X, NOTEBOARD_WORLD_MIN_Y } from './noteboard-constants';

type ViewTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type Point = {
  x: number;
  y: number;
};

export const worldPointFromViewportPoint = (
  view: ViewTransform,
  viewportX: number,
  viewportY: number,
): Point => ({
  x: (viewportX - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X,
  y: (viewportY - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y,
});

export const worldPointFromClientPoint = (
  canvas: HTMLElement,
  view: ViewTransform,
  clientX: number,
  clientY: number,
): Point => {
  const rect = canvas.getBoundingClientRect();
  return worldPointFromViewportPoint(view, clientX - rect.left, clientY - rect.top);
};

export const worldPointAtCanvasCenter = (
  canvas: HTMLElement,
  view: ViewTransform,
): Point =>
  worldPointFromViewportPoint(
    view,
    canvas.clientWidth * 0.5,
    canvas.clientHeight * 0.5,
  );

export const offsetFromWorldPointAtViewportPoint = (
  worldPoint: Point,
  viewportPoint: Point,
  zoom: number,
): Point => ({
  x: viewportPoint.x - (worldPoint.x - NOTEBOARD_WORLD_MIN_X) * zoom,
  y: viewportPoint.y - (worldPoint.y - NOTEBOARD_WORLD_MIN_Y) * zoom,
});
