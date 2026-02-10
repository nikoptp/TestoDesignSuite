import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import type {
  CategoryNode,
  NoteboardCard,
  NodeWorkspaceData,
  PersistedTreeState,
  UserSettings,
} from './shared/types';
import {
  countDescendants,
  createNode,
  findFirstNodeId,
  findNodeById,
  removeNodeById,
} from './shared/tree-utils';
import {
  isValidEditorType,
} from './shared/editor-types';
import { renderNodeTree } from './renderer/components/node-tree';
import {
  renderCreateNodeDialog,
  renderDeleteDialog,
} from './renderer/components/dialogs';
import { renderAppLayout } from './renderer/components/layout';
import { renderEditorPanel } from './renderer/components/editors';

type UiState = {
  editingNodeId: string | null;
  editingNameDraft: string;
  pendingDeleteNodeId: string | null;
  pendingCreateParentRef: string | 'root' | null;
  resizingPointerId: number | null;
  draggingCard:
    | {
        pointerId: number;
        nodeId: string;
        cardId: string;
        offsetX: number;
        offsetY: number;
      }
    | null;
};

const app = document.getElementById('app');

if (!app) {
  throw new Error('App root element not found');
}

const state: PersistedTreeState = {
  nodes: [
    {
      id: 'node-1',
      name: 'Untitled Node 1',
      editorType: 'noteboard',
      children: [
        {
          id: 'node-2',
          name: 'Untitled Node 2',
          editorType: 'story-document',
          children: [],
        },
      ],
    },
    {
      id: 'node-3',
      name: 'Untitled Node 3',
      editorType: 'map-sketch',
      children: [],
    },
  ],
  selectedNodeId: 'node-1',
  nextNodeNumber: 4,
  nodeDataById: {},
};

const settings: UserSettings = {
  sidebarWidth: 320,
};

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 620;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;

const uiState: UiState = {
  editingNodeId: null,
  editingNameDraft: '',
  pendingDeleteNodeId: null,
  pendingCreateParentRef: null,
  resizingPointerId: null,
  draggingCard: null,
};

const clampSidebarWidth = (value: number): number =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

const CARD_WIDTH = 240;
const CARD_MIN_HEIGHT = 170;
const CANVAS_PADDING = 12;

const createNoteboardCard = (x: number, y: number): NoteboardCard => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  createdAt: Date.now(),
  x,
  y,
});

const getNodeWorkspaceData = (nodeId: string): NodeWorkspaceData => {
  if (!state.nodeDataById[nodeId]) {
    state.nodeDataById[nodeId] = {};
  }

  return state.nodeDataById[nodeId];
};

const getNoteboardCards = (nodeId: string): NoteboardCard[] => {
  const nodeData = getNodeWorkspaceData(nodeId);
  if (!nodeData.noteboard) {
    nodeData.noteboard = { cards: [] };
  }

  nodeData.noteboard.cards.forEach((card, index) => {
    if (typeof card.x !== 'number' || !Number.isFinite(card.x)) {
      card.x = CANVAS_PADDING + (index % 3) * 260;
    }
    if (typeof card.y !== 'number' || !Number.isFinite(card.y)) {
      card.y = CANVAS_PADDING + Math.floor(index / 3) * 220;
    }
  });

  return nodeData.noteboard.cards;
};

const collectSubtreeIds = (root: CategoryNode): string[] => {
  const ids = [root.id];
  root.children.forEach((child) => {
    ids.push(...collectSubtreeIds(child));
  });
  return ids;
};

const clampCardToCanvas = (
  x: number,
  y: number,
  canvas: HTMLElement,
): { x: number; y: number } => {
  const maxX = Math.max(CANVAS_PADDING, canvas.clientWidth - CARD_WIDTH - CANVAS_PADDING);
  const maxY = Math.max(
    CANVAS_PADDING,
    canvas.clientHeight - CARD_MIN_HEIGHT - CANVAS_PADDING,
  );

  return {
    x: Math.min(maxX, Math.max(CANVAS_PADDING, x)),
    y: Math.min(maxY, Math.max(CANVAS_PADDING, y)),
  };
};

const findNoteboardCard = (nodeId: string, cardId: string): NoteboardCard | undefined => {
  const cards = getNoteboardCards(nodeId);
  return cards.find((card) => card.id === cardId);
};

const beginRename = (nodeId: string): void => {
  const node = findNodeById(state.nodes, nodeId);
  if (!node) {
    return;
  }

  uiState.editingNodeId = node.id;
  uiState.editingNameDraft = node.name;
  render();
  const input = app.querySelector<HTMLInputElement>(
    `input.rename-input[data-id="${node.id}"]`,
  );
  input?.focus();
  input?.select();
};

const commitRename = (): void => {
  if (!uiState.editingNodeId) {
    return;
  }

  const node = findNodeById(state.nodes, uiState.editingNodeId);
  const nextName = uiState.editingNameDraft.trim();

  if (node && nextName) {
    node.name = nextName;
    scheduleStateSave();
  }

  uiState.editingNodeId = null;
  uiState.editingNameDraft = '';
  render();
};

const cancelRename = (): void => {
  if (!uiState.editingNodeId) {
    return;
  }

  uiState.editingNodeId = null;
  uiState.editingNameDraft = '';
  render();
};

const applySidebarWidth = (): void => {
  const shell = app.querySelector<HTMLElement>('.app-shell');
  if (!shell) {
    return;
  }

  shell.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`);
};

const scheduleStateSave = (): void => {
  if (!window.testoApi) {
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    const snapshot: PersistedTreeState = {
      nodes: state.nodes,
      selectedNodeId: state.selectedNodeId,
      nextNodeNumber: state.nextNodeNumber,
      nodeDataById: state.nodeDataById,
    };

    void window.testoApi?.saveTreeState(snapshot);
  }, 180);
};

const scheduleSettingsSave = (): void => {
  if (!window.testoApi) {
    return;
  }

  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
  }

  settingsSaveTimer = setTimeout(() => {
    const snapshot: UserSettings = {
      sidebarWidth: settings.sidebarWidth,
    };
    void window.testoApi?.saveUserSettings(snapshot);
  }, 220);
};

const render = (): void => {
  const selectedNode = findNodeById(state.nodes, state.selectedNodeId);
  const tree = renderNodeTree(state.nodes, {
    selectedNodeId: state.selectedNodeId,
    editingNodeId: uiState.editingNodeId,
    editingNameDraft: uiState.editingNameDraft,
  });
  const pendingDeleteNode = findNodeById(state.nodes, uiState.pendingDeleteNodeId);
  const deleteDescendantCount = pendingDeleteNode
    ? countDescendants(pendingDeleteNode)
    : 0;

  const createTargetLabel =
    uiState.pendingCreateParentRef === 'root'
      ? 'Create root node'
      : uiState.pendingCreateParentRef
        ? `Create child node under ${findNodeById(state.nodes, uiState.pendingCreateParentRef)?.name ?? 'selected parent'}`
        : '';

  app.innerHTML = [
    renderAppLayout({
      sidebarWidth: settings.sidebarWidth,
      treeMarkup: tree,
      editorContentMarkup: renderEditorPanel(selectedNode, state.nodeDataById),
    }),
    renderDeleteDialog(pendingDeleteNode, deleteDescendantCount),
    renderCreateNodeDialog(Boolean(uiState.pendingCreateParentRef), createTargetLabel),
  ].join('');
};

app.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionTarget = target.closest<HTMLElement>('[data-action]');

  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;

  if (action === 'select-node') {
    if (uiState.editingNodeId) {
      return;
    }

    const id = actionTarget.dataset.id;
    const node = findNodeById(state.nodes, id ?? null);
    if (!node) {
      return;
    }

    if (event.detail >= 2) {
      beginRename(node.id);
      return;
    }

    if (state.selectedNodeId === node.id) {
      return;
    }

    state.selectedNodeId = node.id;
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'add-root-node') {
    uiState.pendingCreateParentRef = 'root';
    render();
    return;
  }

  if (action === 'cancel-create-node') {
    uiState.pendingCreateParentRef = null;
    render();
    return;
  }

  if (action === 'create-node-type') {
    const type = actionTarget.dataset.type;
    if (!isValidEditorType(type)) {
      return;
    }

    const nextNode = createNode(`Untitled Node ${state.nextNodeNumber}`, type);
    state.nextNodeNumber += 1;
    state.nodeDataById[nextNode.id] = {};

    if (uiState.pendingCreateParentRef === 'root') {
      state.nodes.push(nextNode);
    } else {
      const parent = findNodeById(state.nodes, uiState.pendingCreateParentRef);
      if (!parent) {
        uiState.pendingCreateParentRef = null;
        render();
        return;
      }
      parent.children.push(nextNode);
    }

    uiState.pendingCreateParentRef = null;
    state.selectedNodeId = nextNode.id;
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'noteboard-add-card') {
    const nodeId = actionTarget.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    const node = findNodeById(state.nodes, nodeId);
    if (!node || node.editorType !== 'noteboard') {
      return;
    }

    const cards = getNoteboardCards(node.id);
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${node.id}"]`,
    );
    const fallback = { x: CANVAS_PADDING + 40, y: CANVAS_PADDING + 40 };
    const positioned = canvas
      ? clampCardToCanvas(
          canvas.clientWidth / 2 - CARD_WIDTH / 2,
          canvas.clientHeight / 2 - CARD_MIN_HEIGHT / 2,
          canvas,
        )
      : fallback;

    cards.unshift(createNoteboardCard(positioned.x, positioned.y));
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'noteboard-canvas-create') {
    const nodeId = actionTarget.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    const clickedInsideCard = target.closest('.noteboard-card');
    if (clickedInsideCard) {
      return;
    }

    const node = findNodeById(state.nodes, nodeId);
    if (!node || node.editorType !== 'noteboard') {
      return;
    }

    const canvas = actionTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const rawX = event.clientX - rect.left - CARD_WIDTH / 2;
    const rawY = event.clientY - rect.top - 24;
    const pos = clampCardToCanvas(rawX, rawY, canvas);

    const cards = getNoteboardCards(node.id);
    cards.unshift(createNoteboardCard(pos.x, pos.y));
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'noteboard-delete-card') {
    const nodeId = actionTarget.dataset.nodeId;
    const cardId = actionTarget.dataset.cardId;
    if (!nodeId || !cardId) {
      return;
    }

    const cards = getNoteboardCards(nodeId);
    const index = cards.findIndex((card) => card.id === cardId);
    if (index < 0) {
      return;
    }

    cards.splice(index, 1);
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'add-child-node') {
    const parentId = actionTarget.dataset.id ?? null;
    const parent = findNodeById(state.nodes, parentId);
    if (!parent) {
      return;
    }

    uiState.pendingCreateParentRef = parent.id;
    render();
    return;
  }

  if (action === 'request-delete-node') {
    const id = actionTarget.dataset.id ?? null;
    const node = findNodeById(state.nodes, id);
    if (!node) {
      return;
    }

    uiState.pendingDeleteNodeId = node.id;
    render();
    return;
  }

  if (action === 'cancel-delete') {
    uiState.pendingDeleteNodeId = null;
    render();
    return;
  }

  if (action === 'confirm-delete') {
    const id = actionTarget.dataset.id ?? null;
    if (!id) {
      return;
    }

    const nodeBeforeDelete = findNodeById(state.nodes, id);
    const subtreeIds = nodeBeforeDelete ? collectSubtreeIds(nodeBeforeDelete) : [];
    const wasRemoved = removeNodeById(state.nodes, id);
    uiState.pendingDeleteNodeId = null;
    uiState.editingNodeId = null;
    uiState.editingNameDraft = '';

    if (!wasRemoved) {
      render();
      return;
    }

    subtreeIds.forEach((nodeId) => {
      delete state.nodeDataById[nodeId];
    });

    if (state.selectedNodeId === id || !findNodeById(state.nodes, state.selectedNodeId)) {
      state.selectedNodeId = findFirstNodeId(state.nodes);
    }

    render();
    scheduleStateSave();
    return;
  }
});

app.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionTarget = target.closest<HTMLElement>('[data-action]');
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.action === 'noteboard-start-drag') {
    const nodeId = actionTarget.dataset.nodeId;
    const cardId = actionTarget.dataset.cardId;
    if (!nodeId || !cardId) {
      return;
    }

    const card = findNoteboardCard(nodeId, cardId);
    if (!card) {
      return;
    }

    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${nodeId}"]`,
    );
    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - canvasRect.left;
    const pointerY = event.clientY - canvasRect.top;

    uiState.draggingCard = {
      pointerId: event.pointerId,
      nodeId,
      cardId,
      offsetX: pointerX - card.x,
      offsetY: pointerY - card.y,
    };

    actionTarget.setPointerCapture(event.pointerId);
    document.body.classList.add('is-dragging-card');
    event.preventDefault();
    return;
  }

  if (actionTarget.dataset.action !== 'start-resize') {
    return;
  }

  uiState.resizingPointerId = event.pointerId;
  actionTarget.setPointerCapture(event.pointerId);
  document.body.classList.add('is-resizing-sidebar');
  event.preventDefault();
});

window.addEventListener('pointermove', (event) => {
  if (
    uiState.draggingCard &&
    event.pointerId === uiState.draggingCard.pointerId
  ) {
    const drag = uiState.draggingCard;
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${drag.nodeId}"]`,
    );
    const card = findNoteboardCard(drag.nodeId, drag.cardId);
    if (!canvas || !card) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const rawX = event.clientX - rect.left - drag.offsetX;
    const rawY = event.clientY - rect.top - drag.offsetY;
    const pos = clampCardToCanvas(rawX, rawY, canvas);
    card.x = pos.x;
    card.y = pos.y;

    const cardEl = app.querySelector<HTMLElement>(
      `.noteboard-card[data-card-shell-id="${drag.cardId}"]`,
    );
    if (cardEl) {
      cardEl.style.left = `${card.x}px`;
      cardEl.style.top = `${card.y}px`;
    }

    return;
  }

  if (uiState.resizingPointerId === null || event.pointerId !== uiState.resizingPointerId) {
    return;
  }

  const shell = app.querySelector<HTMLElement>('.app-shell');
  if (!shell) {
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const nextWidth = clampSidebarWidth(event.clientX - shellRect.left);
  settings.sidebarWidth = nextWidth;
  applySidebarWidth();
  scheduleSettingsSave();
});

window.addEventListener('pointerup', (event) => {
  if (
    uiState.draggingCard &&
    event.pointerId === uiState.draggingCard.pointerId
  ) {
    uiState.draggingCard = null;
    document.body.classList.remove('is-dragging-card');
    scheduleStateSave();
    return;
  }

  if (uiState.resizingPointerId === null || event.pointerId !== uiState.resizingPointerId) {
    return;
  }

  uiState.resizingPointerId = null;
  document.body.classList.remove('is-resizing-sidebar');
});

window.addEventListener('pointercancel', (event) => {
  if (
    uiState.draggingCard &&
    event.pointerId === uiState.draggingCard.pointerId
  ) {
    uiState.draggingCard = null;
    document.body.classList.remove('is-dragging-card');
    scheduleStateSave();
    return;
  }

  if (uiState.resizingPointerId === null || event.pointerId !== uiState.resizingPointerId) {
    return;
  }

  uiState.resizingPointerId = null;
  document.body.classList.remove('is-resizing-sidebar');
});

app.addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    if (target.dataset.action !== 'noteboard-edit-card') {
      return;
    }

    const nodeId = target.dataset.nodeId;
    const cardId = target.dataset.cardId;
    if (!nodeId || !cardId) {
      return;
    }

    const cards = getNoteboardCards(nodeId);
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    card.text = target.value;
    scheduleStateSave();
    return;
  }

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.action !== 'rename-input') {
    return;
  }

  uiState.editingNameDraft = target.value;
  event.stopPropagation();
});

document.addEventListener(
  'pointerdown',
  (event) => {
    if (!uiState.editingNodeId) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      commitRename();
      return;
    }

    const insideRenameInput = target.closest(
      `input.rename-input[data-id="${uiState.editingNodeId}"]`,
    );

    if (insideRenameInput) {
      return;
    }

    commitRename();
  },
  true,
);

app.addEventListener('keydown', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.action !== 'rename-input') {
    return;
  }

  if (event.key === 'Enter') {
    commitRename();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.key === 'Escape') {
    cancelRename();
    event.preventDefault();
    event.stopPropagation();
  }
});

const isNode = (value: unknown): value is CategoryNode => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    id?: unknown;
    name?: unknown;
    editorType?: unknown;
    children?: unknown;
  };

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isValidEditorType(obj.editorType) &&
    Array.isArray(obj.children) &&
    obj.children.every((child) => isNode(child))
  );
};

const isNodeWorkspaceData = (value: unknown): value is NodeWorkspaceData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    noteboard?: unknown;
  };

  if (typeof obj.noteboard === 'undefined') {
    return true;
  }

  if (typeof obj.noteboard !== 'object' || obj.noteboard === null) {
    return false;
  }

  const noteboard = obj.noteboard as { cards?: unknown };
  if (!Array.isArray(noteboard.cards)) {
    return false;
  }

  return noteboard.cards.every((card) => {
    if (typeof card !== 'object' || card === null) {
      return false;
    }

    const item = card as {
      id?: unknown;
      text?: unknown;
      createdAt?: unknown;
      x?: unknown;
      y?: unknown;
    };

    return (
      typeof item.id === 'string' &&
      typeof item.text === 'string' &&
      typeof item.createdAt === 'number' &&
      (typeof item.x === 'undefined' || typeof item.x === 'number') &&
      (typeof item.y === 'undefined' || typeof item.y === 'number')
    );
  });
};

const isPersistedTreeState = (value: unknown): value is PersistedTreeState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    nodes?: unknown;
    selectedNodeId?: unknown;
    nextNodeNumber?: unknown;
    nodeDataById?: unknown;
  };

  const nodeDataValid =
    typeof obj.nodeDataById === 'undefined' ||
    (typeof obj.nodeDataById === 'object' &&
      obj.nodeDataById !== null &&
      Object.values(obj.nodeDataById as Record<string, unknown>).every((entry) =>
        isNodeWorkspaceData(entry),
      ));

  return (
    Array.isArray(obj.nodes) &&
    obj.nodes.every((node) => isNode(node)) &&
    (typeof obj.selectedNodeId === 'string' || obj.selectedNodeId === null) &&
    typeof obj.nextNodeNumber === 'number' &&
    Number.isInteger(obj.nextNodeNumber) &&
    obj.nextNodeNumber >= 1 &&
    nodeDataValid
  );
};

const isUserSettings = (value: unknown): value is UserSettings => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as { sidebarWidth?: unknown };
  return (
    typeof obj.sidebarWidth === 'number' &&
    Number.isFinite(obj.sidebarWidth) &&
    obj.sidebarWidth >= MIN_SIDEBAR_WIDTH &&
    obj.sidebarWidth <= MAX_SIDEBAR_WIDTH
  );
};

const bootstrap = async (): Promise<void> => {
  if (!window.testoApi) {
    render();
    applySidebarWidth();
    return;
  }

  try {
    const [loadedState, loadedSettings] = await Promise.all([
      window.testoApi.loadTreeState(),
      window.testoApi.loadUserSettings(),
    ]);

    if (loadedState && isPersistedTreeState(loadedState)) {
      state.nodes = loadedState.nodes;
      state.selectedNodeId = loadedState.selectedNodeId;
      state.nextNodeNumber = loadedState.nextNodeNumber;
      state.nodeDataById = loadedState.nodeDataById ?? {};
    }

    if (loadedSettings && isUserSettings(loadedSettings)) {
      settings.sidebarWidth = clampSidebarWidth(loadedSettings.sidebarWidth);
    }
  } catch {
    // Keep in-memory defaults if persisted state/settings fail to load.
  }

  render();
  applySidebarWidth();
};

void bootstrap();
