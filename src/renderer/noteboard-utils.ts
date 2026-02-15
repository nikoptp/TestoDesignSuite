import type { NoteboardCard, NodeWorkspaceData, PersistedTreeState } from '../shared/types';
import {
  NOTEBOARD_WORLD_HEIGHT,
  NOTEBOARD_WORLD_MAX_X,
  NOTEBOARD_WORLD_MAX_Y,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
  NOTEBOARD_WORLD_WIDTH,
} from '../shared/noteboard-constants';

export type NoteboardView = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export const CARD_WIDTH = 220;
export const CARD_MIN_HEIGHT = 80;
export const CARD_MIN_WIDTH = 140;
export const CANVAS_PADDING = 12;
export const DEFAULT_NOTEBOARD_CARD_COLOR = '#fff1a8';

const BASE_MIN_ZOOM = 0.08;
const BASE_GRID_STEP = 24;
const TARGET_GRID_SCREEN_SPACING = 26;

export const createNoteboardCard = (x: number, y: number): NoteboardCard => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  createdAt: Date.now(),
  color: DEFAULT_NOTEBOARD_CARD_COLOR,
  x,
  y,
  width: CARD_WIDTH,
  height: CARD_MIN_HEIGHT,
});

export const getNodeWorkspaceData = (
  state: PersistedTreeState,
  nodeId: string,
): NodeWorkspaceData => {
  if (!state.nodeDataById[nodeId]) {
    state.nodeDataById[nodeId] = {};
  }

  return state.nodeDataById[nodeId];
};

export const getNoteboardCards = (
  state: PersistedTreeState,
  nodeId: string,
): NoteboardCard[] => {
  const nodeData = getNodeWorkspaceData(state, nodeId);
  if (!nodeData.noteboard) {
    nodeData.noteboard = { cards: [] };
  }

  nodeData.noteboard.cards.forEach((card, index) => {
    if (typeof card.x !== 'number' || !Number.isFinite(card.x)) {
      card.x = (index % 3) * 260 - 260;
    }
    if (typeof card.y !== 'number' || !Number.isFinite(card.y)) {
      card.y = Math.floor(index / 3) * 220 - 220;
    }
    if (typeof card.width !== 'number' || !Number.isFinite(card.width)) {
      card.width = CARD_WIDTH;
    }
    if (typeof card.height !== 'number' || !Number.isFinite(card.height)) {
      card.height = CARD_MIN_HEIGHT;
    }
    if (typeof card.color !== 'string' || !card.color.trim()) {
      card.color = DEFAULT_NOTEBOARD_CARD_COLOR;
    }
    card.width = Math.max(CARD_MIN_WIDTH, card.width);
    card.height = Math.max(CARD_MIN_HEIGHT, card.height);
  });

  return nodeData.noteboard.cards;
};

export const getNoteboardView = (
  state: PersistedTreeState,
  nodeId: string,
): NoteboardView => {
  const nodeData = getNodeWorkspaceData(state, nodeId);
  if (!nodeData.noteboard) {
    nodeData.noteboard = { cards: [] };
  }

  if (!nodeData.noteboard.view) {
    nodeData.noteboard.view = {
      zoom: 1,
      offsetX: NOTEBOARD_WORLD_MIN_X + 180,
      offsetY: NOTEBOARD_WORLD_MIN_Y + 120,
    };
  }

  // Migrate legacy default offsets from the older positive-only camera setup.
  if (
    Math.abs(nodeData.noteboard.view.offsetX - 180) < 1 &&
    Math.abs(nodeData.noteboard.view.offsetY - 120) < 1
  ) {
    nodeData.noteboard.view.offsetX += NOTEBOARD_WORLD_MIN_X;
    nodeData.noteboard.view.offsetY += NOTEBOARD_WORLD_MIN_Y;
  }

  return nodeData.noteboard.view;
};

export const clampViewOffsets = (canvas: HTMLElement, view: NoteboardView): void => {
  const scaledWorldWidth = NOTEBOARD_WORLD_WIDTH * view.zoom;
  const scaledWorldHeight = NOTEBOARD_WORLD_HEIGHT * view.zoom;

  if (scaledWorldWidth <= canvas.clientWidth) {
    view.offsetX = (canvas.clientWidth - scaledWorldWidth) / 2;
  } else {
    const minOffsetX = canvas.clientWidth - scaledWorldWidth;
    const maxOffsetX = 0;
    view.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, view.offsetX));
  }

  if (scaledWorldHeight <= canvas.clientHeight) {
    view.offsetY = (canvas.clientHeight - scaledWorldHeight) / 2;
  } else {
    const minOffsetY = canvas.clientHeight - scaledWorldHeight;
    const maxOffsetY = 0;
    view.offsetY = Math.min(maxOffsetY, Math.max(minOffsetY, view.offsetY));
  }
};

export const getMinZoomForCanvas = (canvas: HTMLElement): number => {
  const fitZoomX = canvas.clientWidth / NOTEBOARD_WORLD_WIDTH;
  const fitZoomY = canvas.clientHeight / NOTEBOARD_WORLD_HEIGHT;
  const fitZoom = Math.min(fitZoomX, fitZoomY) * 0.98;
  return Math.min(BASE_MIN_ZOOM, fitZoom);
};

export const getGridStepForZoom = (zoom: number): number => {
  const rawLevel = TARGET_GRID_SCREEN_SPACING / (BASE_GRID_STEP * zoom);
  const level = Math.max(0, Math.ceil(Math.log2(Math.max(1, rawLevel))));
  return BASE_GRID_STEP * 2 ** level;
};

export const applyNoteboardWorldStyles = (
  world: HTMLElement,
  view: NoteboardView,
): void => {
  const gridStep = getGridStepForZoom(view.zoom);
  const majorGridStep = gridStep * 4;
  const lineWidth = 1 / view.zoom;
  const majorLineWidth = 1.5 / view.zoom;

  world.style.transform = `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.zoom})`;
  world.style.setProperty('--grid-step', `${gridStep}px`);
  world.style.setProperty('--grid-major-step', `${majorGridStep}px`);
  world.style.setProperty('--grid-line-width', `${lineWidth}px`);
  world.style.setProperty('--grid-major-line-width', `${majorLineWidth}px`);
};

export const clampCardToWorld = (
  x: number,
  y: number,
  width: number = CARD_WIDTH,
  height: number = CARD_MIN_HEIGHT,
): { x: number; y: number } => {
  const minX = NOTEBOARD_WORLD_MIN_X + CANVAS_PADDING;
  const minY = NOTEBOARD_WORLD_MIN_Y + CANVAS_PADDING;
  const maxX = NOTEBOARD_WORLD_MAX_X - width - CANVAS_PADDING;
  const maxY = NOTEBOARD_WORLD_MAX_Y - height - CANVAS_PADDING;

  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
};

export const getWorldPoint = (
  canvas: HTMLElement,
  view: NoteboardView,
  clientX: number,
  clientY: number,
): { x: number; y: number } => {
  const world =
    (canvas.querySelector(':scope > .noteboard-world') as HTMLElement | null) ||
    (canvas.querySelector('.noteboard-world') as HTMLElement | null);
  const rect = canvas.getBoundingClientRect();
  const layoutOffsetX = world?.offsetLeft ?? 0;
  const layoutOffsetY = world?.offsetTop ?? 0;
  return {
    x: (clientX - rect.left - layoutOffsetX - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X,
    y: (clientY - rect.top - layoutOffsetY - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y,
  };
};
