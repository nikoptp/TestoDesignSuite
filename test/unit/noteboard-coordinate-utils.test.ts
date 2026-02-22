import { describe, expect, it } from 'vitest';
import { NOTEBOARD_WORLD_MIN_X, NOTEBOARD_WORLD_MIN_Y } from '../../src/shared/noteboard-constants';
import {
  offsetFromWorldPointAtViewportPoint,
  worldPointAtCanvasCenter,
  worldPointFromClientPoint,
  worldPointFromViewportPoint,
} from '../../src/shared/noteboard-coordinate-utils';

describe('noteboard coordinate utils', () => {
  it('converts viewport coordinates to world coordinates', () => {
    const view = {
      zoom: 2,
      offsetX: 120,
      offsetY: -40,
    };

    const world = worldPointFromViewportPoint(view, 320, 160);

    expect(world.x).toBe((320 - 120) / 2 + NOTEBOARD_WORLD_MIN_X);
    expect(world.y).toBe((160 - -40) / 2 + NOTEBOARD_WORLD_MIN_Y);
  });

  it('converts client coordinates using canvas bounds', () => {
    const canvas = document.createElement('div');
    canvas.getBoundingClientRect = () =>
      ({
        left: 50,
        top: 30,
      } as DOMRect);

    const view = {
      zoom: 1.5,
      offsetX: 40,
      offsetY: 10,
    };

    const world = worldPointFromClientPoint(canvas, view, 260, 180);

    expect(world.x).toBe((210 - 40) / 1.5 + NOTEBOARD_WORLD_MIN_X);
    expect(world.y).toBe((150 - 10) / 1.5 + NOTEBOARD_WORLD_MIN_Y);
  });

  it('returns world point at canvas center', () => {
    const canvas = document.createElement('div');
    Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });

    const view = {
      zoom: 1,
      offsetX: 100,
      offsetY: 200,
    };

    const world = worldPointAtCanvasCenter(canvas, view);

    expect(world.x).toBe(300 + NOTEBOARD_WORLD_MIN_X);
    expect(world.y).toBe(100 + NOTEBOARD_WORLD_MIN_Y);
  });

  it('computes offsets that keep a world point under a viewport point after zoom', () => {
    const worldPoint = { x: NOTEBOARD_WORLD_MIN_X + 200, y: NOTEBOARD_WORLD_MIN_Y + 400 };
    const viewportPoint = { x: 500, y: 350 };
    const nextZoom = 2.5;

    const offset = offsetFromWorldPointAtViewportPoint(worldPoint, viewportPoint, nextZoom);

    const projectedViewport = {
      x: (worldPoint.x - NOTEBOARD_WORLD_MIN_X) * nextZoom + offset.x,
      y: (worldPoint.y - NOTEBOARD_WORLD_MIN_Y) * nextZoom + offset.y,
    };

    expect(projectedViewport).toEqual(viewportPoint);
  });
});
