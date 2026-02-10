import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import type {
  CategoryNode,
  NoteboardCard,
  PersistedTreeState,
  UserSettings,
} from './shared/types';
import {
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from './shared/noteboard-constants';
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
import {
  applyNoteboardWorldStyles,
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  CANVAS_PADDING,
  clampCardToWorld,
  clampViewOffsets,
  createNoteboardCard,
  getMinZoomForCanvas,
  getNodeWorkspaceData as getNodeWorkspaceDataForState,
  getNoteboardCards as getNoteboardCardsForState,
  getNoteboardView as getNoteboardViewForState,
  getWorldPoint,
  type NoteboardView,
} from './renderer/noteboard-utils';
import { createHistoryStack } from './renderer/history-stack';
import { isPersistedTreeState } from './renderer/persistence-guards';
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
        movingCardIds: string[];
        pointerStartX: number;
        pointerStartY: number;
        startPositions: Record<string, { x: number; y: number }>;
      }
    | null;
  panningCanvas:
    | {
        pointerId: number;
        nodeId: string;
        startClientX: number;
        startClientY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | null;
  contextMenu:
    | {
        nodeId: string;
        screenX: number;
        screenY: number;
        worldX: number;
        worldY: number;
      }
    | null;
  cardSelection: {
    nodeId: string | null;
    cardIds: string[];
  };
  selectionBox:
    | {
        nodeId: string;
        pointerId: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        additive: boolean;
        baseSelectedCardIds: string[];
      }
    | null;
};

type HistorySnapshot = {
  state: PersistedTreeState;
  cardSelection: {
    nodeId: string | null;
    cardIds: string[];
  };
};

type AppClipboard =
  | {
      kind: 'noteboard-cards';
      cards: Array<{
        text: string;
        dx: number;
        dy: number;
      }>;
    }
  | null;

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
  panningCanvas: null,
  contextMenu: null,
  cardSelection: {
    nodeId: null,
    cardIds: [],
  },
  selectionBox: null,
};

const clampSidebarWidth = (value: number): number =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

const MAX_ZOOM = 2.5;
const MAX_HISTORY_ENTRIES = 120;

const historyState: {
  textEditSessions: Set<string>;
} = {
  textEditSessions: new Set<string>(),
};
const historyStack = createHistoryStack<HistorySnapshot>(MAX_HISTORY_ENTRIES);

let appClipboard: AppClipboard = null;

const getWorkspaceData = (nodeId: string) =>
  getNodeWorkspaceDataForState(state, nodeId);
const getCards = (nodeId: string): NoteboardCard[] =>
  getNoteboardCardsForState(state, nodeId);
const getView = (nodeId: string): NoteboardView =>
  getNoteboardViewForState(state, nodeId);

const applyWorldStylesForNode = (nodeId: string): void => {
  const world = app.querySelector<HTMLElement>(
    `.noteboard-world[data-node-id="${nodeId}"]`,
  );
  if (!world) {
    return;
  }

  applyNoteboardWorldStyles(world, getView(nodeId));
};

const collectSubtreeIds = (root: CategoryNode): string[] => {
  const ids = [root.id];
  root.children.forEach((child) => {
    ids.push(...collectSubtreeIds(child));
  });
  return ids;
};

const findNoteboardCard = (nodeId: string, cardId: string): NoteboardCard | undefined => {
  const cards = getCards(nodeId);
  return cards.find((card) => card.id === cardId);
};

const getSelectedCardIdsForNode = (nodeId: string): string[] =>
  uiState.cardSelection.nodeId === nodeId ? uiState.cardSelection.cardIds : [];

const setSelectedCardIds = (nodeId: string, cardIds: string[]): void => {
  uiState.cardSelection = {
    nodeId,
    cardIds: Array.from(new Set(cardIds)),
  };
};

const toggleSelectedCard = (nodeId: string, cardId: string): void => {
  const current = getSelectedCardIdsForNode(nodeId);
  if (current.includes(cardId)) {
    setSelectedCardIds(
      nodeId,
      current.filter((id) => id !== cardId),
    );
    return;
  }

  setSelectedCardIds(nodeId, [...current, cardId]);
};

const clearCardSelection = (): void => {
  uiState.cardSelection = { nodeId: null, cardIds: [] };
};

const deepCloneState = (input: PersistedTreeState): PersistedTreeState =>
  JSON.parse(JSON.stringify(input)) as PersistedTreeState;

const captureHistorySnapshot = (): HistorySnapshot => ({
  state: deepCloneState(state),
  cardSelection: {
    nodeId: uiState.cardSelection.nodeId,
    cardIds: [...uiState.cardSelection.cardIds],
  },
});

const applyHistorySnapshot = (snapshot: HistorySnapshot): void => {
  state.nodes = snapshot.state.nodes;
  state.selectedNodeId = snapshot.state.selectedNodeId;
  state.nextNodeNumber = snapshot.state.nextNodeNumber;
  state.nodeDataById = snapshot.state.nodeDataById;

  uiState.cardSelection = {
    nodeId: snapshot.cardSelection.nodeId,
    cardIds: [...snapshot.cardSelection.cardIds],
  };

  uiState.selectionBox = null;
  uiState.contextMenu = null;
  uiState.draggingCard = null;
  uiState.panningCanvas = null;
  historyState.textEditSessions.clear();
};

const pushHistory = (): void => {
  historyStack.push(captureHistorySnapshot());
};

const undoHistory = (): void => {
  const previous = historyStack.undo(captureHistorySnapshot());
  if (!previous) {
    return;
  }

  applyHistorySnapshot(previous);
  render();
  scheduleStateSave();
};

const redoHistory = (): void => {
  const next = historyStack.redo(captureHistorySnapshot());
  if (!next) {
    return;
  }

  applyHistorySnapshot(next);
  render();
  scheduleStateSave();
};

const copySelectedCardsToClipboard = (): void => {
  const selectedNode = findNodeById(state.nodes, state.selectedNodeId);
  if (!selectedNode || selectedNode.editorType !== 'noteboard') {
    return;
  }

  const selectedIds = getSelectedCardIdsForNode(selectedNode.id);
  if (selectedIds.length === 0) {
    return;
  }

  const cards = getCards(selectedNode.id).filter((card) =>
    selectedIds.includes(card.id),
  );
  if (cards.length === 0) {
    return;
  }

  const anchorX = Math.min(...cards.map((card) => card.x));
  const anchorY = Math.min(...cards.map((card) => card.y));
  appClipboard = {
    kind: 'noteboard-cards',
    cards: cards.map((card) => ({
      text: card.text,
      dx: card.x - anchorX,
      dy: card.y - anchorY,
    })),
  };
};

const pasteClipboardToSelectedNode = (): void => {
  if (!appClipboard || appClipboard.kind !== 'noteboard-cards') {
    return;
  }

  const selectedNode = findNodeById(state.nodes, state.selectedNodeId);
  if (!selectedNode || selectedNode.editorType !== 'noteboard') {
    return;
  }

  const canvas = app.querySelector<HTMLElement>(
    `.noteboard-canvas[data-node-id="${selectedNode.id}"]`,
  );
  const view = getView(selectedNode.id);
  let anchorX = 0;
  let anchorY = 0;

  if (canvas) {
    anchorX = (canvas.clientWidth / 2 - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
    anchorY =
      (canvas.clientHeight / 2 - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;
  }

  pushHistory();
  const cards = getCards(selectedNode.id);
  const newIds: string[] = [];
  appClipboard.cards.forEach((item) => {
    const pos = clampCardToWorld(anchorX + item.dx, anchorY + item.dy);
    const card = createNoteboardCard(pos.x, pos.y);
    card.text = item.text;
    cards.unshift(card);
    newIds.push(card.id);
  });

  setSelectedCardIds(selectedNode.id, newIds);
  render();
  scheduleStateSave();
};

const deleteSelectedCardsFromSelectedNode = (): void => {
  const selectedNode = findNodeById(state.nodes, state.selectedNodeId);
  if (!selectedNode || selectedNode.editorType !== 'noteboard') {
    return;
  }

  const selectedIds = getSelectedCardIdsForNode(selectedNode.id);
  if (selectedIds.length === 0) {
    return;
  }

  const cards = getCards(selectedNode.id);
  const filtered = cards.filter((card) => !selectedIds.includes(card.id));
  if (filtered.length === cards.length) {
    return;
  }

  pushHistory();
  state.nodeDataById[selectedNode.id] = {
    ...getWorkspaceData(selectedNode.id),
    noteboard: {
      ...getWorkspaceData(selectedNode.id).noteboard,
      cards: filtered,
    },
  };

  clearCardSelection();
  render();
  scheduleStateSave();
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
    if (node.name !== nextName) {
      pushHistory();
    }
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

  const contextMenuMarkup = uiState.contextMenu
    ? `
      <div
        class="canvas-context-menu"
        style="left:${uiState.contextMenu.screenX}px; top:${uiState.contextMenu.screenY}px;"
      >
        <button
          class="context-menu-item"
          data-action="context-create-card"
          data-node-id="${uiState.contextMenu.nodeId}"
        >
          <i class="fa-solid fa-note-sticky"></i>
          <span>Create Card Here</span>
        </button>
      </div>
    `
    : '';

  const selectionBoxForRender =
    uiState.selectionBox && uiState.selectionBox.nodeId
      ? {
          nodeId: uiState.selectionBox.nodeId,
          left:
            Math.min(uiState.selectionBox.startX, uiState.selectionBox.currentX) -
            NOTEBOARD_WORLD_MIN_X,
          top:
            Math.min(uiState.selectionBox.startY, uiState.selectionBox.currentY) -
            NOTEBOARD_WORLD_MIN_Y,
          width: Math.abs(uiState.selectionBox.currentX - uiState.selectionBox.startX),
          height: Math.abs(uiState.selectionBox.currentY - uiState.selectionBox.startY),
        }
      : null;

  app.innerHTML = [
    renderAppLayout({
      sidebarWidth: settings.sidebarWidth,
      treeMarkup: tree,
      editorContentMarkup: renderEditorPanel(
        selectedNode,
        state.nodeDataById,
        selectedNode ? getSelectedCardIdsForNode(selectedNode.id) : [],
        selectionBoxForRender,
      ),
    }),
    renderDeleteDialog(pendingDeleteNode, deleteDescendantCount),
    renderCreateNodeDialog(Boolean(uiState.pendingCreateParentRef), createTargetLabel),
    contextMenuMarkup,
  ].join('');

  // Ensure loaded or externally changed camera states are clamped to visible viewport bounds.
  if (selectedNode?.editorType === 'noteboard') {
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${selectedNode.id}"]`,
    );
    const world = app.querySelector<HTMLElement>(
      `.noteboard-world[data-node-id="${selectedNode.id}"]`,
    );
    if (canvas && world) {
      const view = getView(selectedNode.id);
      const beforeX = view.offsetX;
      const beforeY = view.offsetY;
      clampViewOffsets(canvas, view);
      if (view.offsetX !== beforeX || view.offsetY !== beforeY) {
        applyWorldStylesForNode(selectedNode.id);
      } else {
        applyWorldStylesForNode(selectedNode.id);
      }
    }
  }
};

app.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (uiState.contextMenu && !target.closest('.canvas-context-menu')) {
    uiState.contextMenu = null;
    render();
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
    clearCardSelection();
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

    pushHistory();
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

    pushHistory();
    const cards = getCards(node.id);
    const view = getView(node.id);
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${node.id}"]`,
    );
    const fallback = { x: CANVAS_PADDING + 40, y: CANVAS_PADDING + 40 };
    const positioned = canvas
      ? clampCardToWorld(
          (canvas.clientWidth / 2 - view.offsetX) / view.zoom +
            NOTEBOARD_WORLD_MIN_X -
            CARD_WIDTH / 2,
          (canvas.clientHeight / 2 - view.offsetY) / view.zoom +
            NOTEBOARD_WORLD_MIN_Y -
            CARD_MIN_HEIGHT / 2,
        )
      : fallback;

    cards.unshift(createNoteboardCard(positioned.x, positioned.y));
    setSelectedCardIds(node.id, [cards[0].id]);
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'noteboard-select-card') {
    const nodeId = actionTarget.dataset.nodeId;
    const cardId = actionTarget.dataset.cardId;
    if (!nodeId || !cardId) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      toggleSelectedCard(nodeId, cardId);
    } else {
      setSelectedCardIds(nodeId, [cardId]);
    }

    uiState.contextMenu = null;
    render();
    return;
  }

  if (action === 'noteboard-duplicate-selected') {
    const nodeId = actionTarget.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    pushHistory();
    const cards = getCards(nodeId);
    const selectedIds = getSelectedCardIdsForNode(nodeId);
    const selectedCards = cards.filter((card) => selectedIds.includes(card.id));
    if (selectedCards.length === 0) {
      return;
    }

    const duplicates = selectedCards.map((card) =>
      createNoteboardCard(card.x + 28, card.y + 28),
    );
    duplicates.forEach((dup, index) => {
      dup.text = selectedCards[index].text;
    });
    cards.unshift(...duplicates);
    setSelectedCardIds(
      nodeId,
      duplicates.map((card) => card.id),
    );
    render();
    scheduleStateSave();
    return;
  }

  if (action === 'context-create-card') {
    const menu = uiState.contextMenu;
    if (!menu) {
      return;
    }

    const node = findNodeById(state.nodes, menu.nodeId);
    if (!node || node.editorType !== 'noteboard') {
      uiState.contextMenu = null;
      render();
      return;
    }

    pushHistory();
    const cards = getCards(menu.nodeId);
    const pos = clampCardToWorld(menu.worldX - CARD_WIDTH / 2, menu.worldY - 24);
    cards.unshift(createNoteboardCard(pos.x, pos.y));
    uiState.contextMenu = null;
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

    pushHistory();
    const cards = getCards(nodeId);
    const index = cards.findIndex((card) => card.id === cardId);
    if (index < 0) {
      return;
    }

    cards.splice(index, 1);
    setSelectedCardIds(
      nodeId,
      getSelectedCardIdsForNode(nodeId).filter((id) => id !== cardId),
    );
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

    pushHistory();
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
    if (uiState.cardSelection.nodeId && subtreeIds.includes(uiState.cardSelection.nodeId)) {
      clearCardSelection();
    }

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

  if (uiState.contextMenu && !target.closest('.canvas-context-menu')) {
    uiState.contextMenu = null;
    render();

    if (target.closest('.noteboard-canvas')) {
      event.preventDefault();
      return;
    }
  }

  if (event.button === 0) {
    const canvas = target.closest<HTMLElement>('.noteboard-canvas');
    const clickedCard = target.closest('.noteboard-card');
    const clickedUi = target.closest('.noteboard-toolbar, .canvas-context-menu');
    if (canvas && !clickedCard && !clickedUi) {
      const nodeId = canvas.dataset.nodeId;
      if (nodeId) {
        const node = findNodeById(state.nodes, nodeId);
        if (node?.editorType === 'noteboard') {
          const view = getView(nodeId);
          const world = getWorldPoint(canvas, view, event.clientX, event.clientY);
          uiState.selectionBox = {
            nodeId,
            pointerId: event.pointerId,
            startX: world.x,
            startY: world.y,
            currentX: world.x,
            currentY: world.y,
            additive: event.ctrlKey || event.metaKey,
            baseSelectedCardIds: getSelectedCardIdsForNode(nodeId),
          };
          canvas.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
      }
    }
  }

  if (event.button === 1) {
    const canvas = target.closest<HTMLElement>('.noteboard-canvas');
    if (canvas) {
      const nodeId = canvas.dataset.nodeId;
      if (nodeId) {
        const view = getView(nodeId);
        uiState.panningCanvas = {
          pointerId: event.pointerId,
          nodeId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startOffsetX: view.offsetX,
          startOffsetY: view.offsetY,
        };
        canvas.setPointerCapture(event.pointerId);
        document.body.classList.add('is-panning-canvas');
        event.preventDefault();
        return;
      }
    }
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

    const view = getView(nodeId);
    const pointer = getWorldPoint(canvas, view, event.clientX, event.clientY);

    const currentSelection = getSelectedCardIdsForNode(nodeId);
    const movingCardIds =
      currentSelection.includes(cardId) && currentSelection.length > 0
        ? currentSelection
        : [cardId];
    setSelectedCardIds(nodeId, movingCardIds);

    const startPositions: Record<string, { x: number; y: number }> = {};
    movingCardIds.forEach((id) => {
      const selectedCard = findNoteboardCard(nodeId, id);
      if (selectedCard) {
        startPositions[id] = { x: selectedCard.x, y: selectedCard.y };
      }
    });

    uiState.draggingCard = {
      pointerId: event.pointerId,
      nodeId,
      movingCardIds: Object.keys(startPositions),
      pointerStartX: pointer.x,
      pointerStartY: pointer.y,
      startPositions,
    };

    pushHistory();
    actionTarget.setPointerCapture(event.pointerId);
    document.body.classList.add('is-dragging-card');
    render();
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
    uiState.selectionBox &&
    event.pointerId === uiState.selectionBox.pointerId
  ) {
    const box = uiState.selectionBox;
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${box.nodeId}"]`,
    );
    if (!canvas) {
      return;
    }

    const view = getView(box.nodeId);
    const world = getWorldPoint(canvas, view, event.clientX, event.clientY);
    box.currentX = world.x;
    box.currentY = world.y;

    const minX = Math.min(box.startX, box.currentX);
    const maxX = Math.max(box.startX, box.currentX);
    const minY = Math.min(box.startY, box.currentY);
    const maxY = Math.max(box.startY, box.currentY);

    const cards = getCards(box.nodeId);
    const hits = cards
      .filter((card) => {
        const cardMinX = card.x;
        const cardMaxX = card.x + CARD_WIDTH;
        const cardMinY = card.y;
        const cardMaxY = card.y + CARD_MIN_HEIGHT;
        return !(
          cardMaxX < minX ||
          cardMinX > maxX ||
          cardMaxY < minY ||
          cardMinY > maxY
        );
      })
      .map((card) => card.id);

    const merged = box.additive
      ? Array.from(new Set([...box.baseSelectedCardIds, ...hits]))
      : hits;
    setSelectedCardIds(box.nodeId, merged);
    render();
    event.preventDefault();
    return;
  }

  if (
    uiState.panningCanvas &&
    event.pointerId === uiState.panningCanvas.pointerId
  ) {
    const pan = uiState.panningCanvas;
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${pan.nodeId}"]`,
    );
    if (!canvas) {
      return;
    }

    const view = getView(pan.nodeId);
    view.offsetX = pan.startOffsetX + (event.clientX - pan.startClientX);
    view.offsetY = pan.startOffsetY + (event.clientY - pan.startClientY);
    clampViewOffsets(canvas, view);

    const world = app.querySelector<HTMLElement>(
      `.noteboard-world[data-node-id="${pan.nodeId}"]`,
    );
    if (world) {
      applyWorldStylesForNode(pan.nodeId);
    }
    event.preventDefault();
    return;
  }

  if (
    uiState.draggingCard &&
    event.pointerId === uiState.draggingCard.pointerId
  ) {
    const drag = uiState.draggingCard;
    const canvas = app.querySelector<HTMLElement>(
      `.noteboard-canvas[data-node-id="${drag.nodeId}"]`,
    );
    if (!canvas || drag.movingCardIds.length === 0) {
      return;
    }

    const view = getView(drag.nodeId);
    const pointer = getWorldPoint(canvas, view, event.clientX, event.clientY);
    let deltaX = pointer.x - drag.pointerStartX;
    let deltaY = pointer.y - drag.pointerStartY;

    const starts = Object.values(drag.startPositions);
    const minStartX = Math.min(...starts.map((p) => p.x));
    const maxStartX = Math.max(...starts.map((p) => p.x));
    const minStartY = Math.min(...starts.map((p) => p.y));
    const maxStartY = Math.max(...starts.map((p) => p.y));
    const minAllowedDeltaX = NOTEBOARD_WORLD_MIN_X + CANVAS_PADDING - minStartX;
    const maxAllowedDeltaX =
      NOTEBOARD_WORLD_MAX_X - CARD_WIDTH - CANVAS_PADDING - maxStartX;
    const minAllowedDeltaY = NOTEBOARD_WORLD_MIN_Y + CANVAS_PADDING - minStartY;
    const maxAllowedDeltaY =
      NOTEBOARD_WORLD_MAX_Y - CARD_MIN_HEIGHT - CANVAS_PADDING - maxStartY;

    deltaX = Math.min(maxAllowedDeltaX, Math.max(minAllowedDeltaX, deltaX));
    deltaY = Math.min(maxAllowedDeltaY, Math.max(minAllowedDeltaY, deltaY));

    drag.movingCardIds.forEach((id) => {
      const start = drag.startPositions[id];
      const card = findNoteboardCard(drag.nodeId, id);
      if (!start || !card) {
        return;
      }

      card.x = start.x + deltaX;
      card.y = start.y + deltaY;

      const cardEl = app.querySelector<HTMLElement>(
        `.noteboard-card[data-card-shell-id="${id}"]`,
      );
      if (cardEl) {
        cardEl.style.left = `${card.x - NOTEBOARD_WORLD_MIN_X}px`;
        cardEl.style.top = `${card.y - NOTEBOARD_WORLD_MIN_Y}px`;
      }
    });

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

app.addEventListener('auxclick', (event) => {
  if (event.button !== 1) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('.noteboard-canvas')) {
    event.preventDefault();
  }
});

window.addEventListener('pointerup', (event) => {
  if (
    uiState.selectionBox &&
    event.pointerId === uiState.selectionBox.pointerId
  ) {
    uiState.selectionBox = null;
    render();
    return;
  }

  if (
    uiState.panningCanvas &&
    event.pointerId === uiState.panningCanvas.pointerId
  ) {
    uiState.panningCanvas = null;
    document.body.classList.remove('is-panning-canvas');
    scheduleStateSave();
    return;
  }

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
    uiState.selectionBox &&
    event.pointerId === uiState.selectionBox.pointerId
  ) {
    uiState.selectionBox = null;
    render();
    return;
  }

  if (
    uiState.panningCanvas &&
    event.pointerId === uiState.panningCanvas.pointerId
  ) {
    uiState.panningCanvas = null;
    document.body.classList.remove('is-panning-canvas');
    scheduleStateSave();
    return;
  }

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

    const cards = getCards(nodeId);
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const sessionKey = `${nodeId}:${cardId}`;
    if (!historyState.textEditSessions.has(sessionKey)) {
      pushHistory();
      historyState.textEditSessions.add(sessionKey);
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

app.addEventListener(
  'focusout',
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (target.dataset.action !== 'noteboard-edit-card') {
      return;
    }

    const nodeId = target.dataset.nodeId;
    const cardId = target.dataset.cardId;
    if (!nodeId || !cardId) {
      return;
    }

    historyState.textEditSessions.delete(`${nodeId}:${cardId}`);
  },
  true,
);

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

app.addEventListener(
  'wheel',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const canvas = target.closest<HTMLElement>('.noteboard-canvas');
    if (!canvas) {
      return;
    }

    const nodeId = canvas.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    if (target.closest('.card-textarea')) {
      return;
    }

    const view = getView(nodeId);
    const minZoom = getMinZoomForCanvas(canvas);
    const zoomDelta = event.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(minZoom, view.zoom * zoomDelta));

    if (nextZoom === view.zoom) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
    const worldY = (pointerY - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;

    view.zoom = nextZoom;
    view.offsetX = pointerX - (worldX - NOTEBOARD_WORLD_MIN_X) * nextZoom;
    view.offsetY = pointerY - (worldY - NOTEBOARD_WORLD_MIN_Y) * nextZoom;
    clampViewOffsets(canvas, view);

    const world = app.querySelector<HTMLElement>(
      `.noteboard-world[data-node-id="${nodeId}"]`,
    );
    if (world) {
      applyWorldStylesForNode(nodeId);
    }

    scheduleStateSave();
    event.preventDefault();
  },
  { passive: false },
);

app.addEventListener('contextmenu', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('.card-textarea')) {
    return;
  }

  const canvas = target.closest<HTMLElement>('.noteboard-canvas');
  if (!canvas) {
    if (uiState.contextMenu) {
      uiState.contextMenu = null;
      render();
    }
    return;
  }

  if (target.closest('.noteboard-card')) {
    return;
  }

  const nodeId = canvas.dataset.nodeId;
  if (!nodeId) {
    return;
  }

  const node = findNodeById(state.nodes, nodeId);
  if (!node || node.editorType !== 'noteboard') {
    return;
  }

  const view = getView(nodeId);
  const rect = canvas.getBoundingClientRect();
  const worldX =
    (event.clientX - rect.left - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
  const worldY =
    (event.clientY - rect.top - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;
  const menuWidth = 196;
  const menuHeight = 44;
  const screenX = Math.min(
    window.innerWidth - menuWidth - 8,
    Math.max(8, event.clientX),
  );
  const screenY = Math.min(
    window.innerHeight - menuHeight - 8,
    Math.max(8, event.clientY),
  );

  uiState.contextMenu = {
    nodeId,
    screenX,
    screenY,
    worldX,
    worldY,
  };

  render();
  event.preventDefault();
});

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

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTextEntryTarget =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);

  if (event.key === 'Delete' && !isTextEntryTarget) {
    deleteSelectedCardsFromSelectedNode();
    event.preventDefault();
    return;
  }

  const mod = event.ctrlKey || event.metaKey;
  if (!mod) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === 'z') {
    if (event.shiftKey) {
      if (!isTextEntryTarget) {
        redoHistory();
        event.preventDefault();
      }
      return;
    }

    if (!isTextEntryTarget) {
      undoHistory();
      event.preventDefault();
    }
    return;
  }

  if (key === 'y') {
    if (!isTextEntryTarget) {
      redoHistory();
      event.preventDefault();
    }
    return;
  }

  if (isTextEntryTarget) {
    return;
  }

  if (key === 'c') {
    copySelectedCardsToClipboard();
    event.preventDefault();
    return;
  }

  if (key === 'v') {
    pasteClipboardToSelectedNode();
    event.preventDefault();
  }
});

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

