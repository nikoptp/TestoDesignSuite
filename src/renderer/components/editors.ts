import { editorTypeMeta } from '../../shared/editor-types';
import type { CategoryNode, NodeWorkspaceData } from '../../shared/types';
import {
  NOTEBOARD_WORLD_HEIGHT,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
  NOTEBOARD_WORLD_WIDTH,
} from '../../shared/noteboard-constants';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderNoteboard = (
  node: CategoryNode,
  nodeData: NodeWorkspaceData | undefined,
  selectedCardIds: string[],
  selectionBox:
    | {
        left: number;
        top: number;
        width: number;
        height: number;
      }
    | null,
): string => {
  const cards = nodeData?.noteboard?.cards ?? [];
  const zoom = nodeData?.noteboard?.view?.zoom ?? 1;
  const offsetX = nodeData?.noteboard?.view?.offsetX ?? 0;
  const offsetY = nodeData?.noteboard?.view?.offsetY ?? 0;
  const cardsMarkup = cards
    .map(
      (card) => `
        <article class="noteboard-card ${selectedCardIds.includes(card.id) ? 'selected' : ''}" data-action="noteboard-select-card" data-node-id="${node.id}" data-card-id="${card.id}" data-card-shell-id="${card.id}" style="left:${card.x - NOTEBOARD_WORLD_MIN_X}px; top:${card.y - NOTEBOARD_WORLD_MIN_Y}px;">
          <div
            class="card-drag-handle"
            data-action="noteboard-start-drag"
            data-node-id="${node.id}"
            data-card-id="${card.id}"
            title="Drag card"
            aria-label="Drag card"
          >
            <i class="fa-solid fa-grip"></i>
          </div>
          <textarea class="card-textarea" data-action="noteboard-edit-card" data-node-id="${node.id}" data-card-id="${card.id}" placeholder="Write card content...">${escapeHtml(card.text)}</textarea>
          <div class="card-actions">
            <button class="icon-action danger" data-action="noteboard-delete-card" data-node-id="${node.id}" data-card-id="${card.id}" title="Delete card" aria-label="Delete card">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </article>`,
    )
    .join('');

  return `
    <section class="noteboard-canvas" data-node-id="${node.id}">
      <div class="noteboard-toolbar">
        <button data-action="noteboard-add-card" data-node-id="${node.id}">+ Card</button>
        ${
          selectedCardIds.length > 0
            ? `<button data-action="noteboard-duplicate-selected" data-node-id="${node.id}">Duplicate (${selectedCardIds.length})</button>`
            : ''
        }
      </div>
      <div
        class="noteboard-world"
        data-node-id="${node.id}"
        style="width:${NOTEBOARD_WORLD_WIDTH}px; height:${NOTEBOARD_WORLD_HEIGHT}px; transform: translate(${offsetX}px, ${offsetY}px) scale(${zoom});"
      >
        ${cardsMarkup || '<p class="editor-empty">Click on canvas to create your first card.</p>'}
        ${
          selectionBox
            ? `<div class="selection-rect" style="left:${selectionBox.left}px; top:${selectionBox.top}px; width:${selectionBox.width}px; height:${selectionBox.height}px;"></div>`
            : ''
        }
      </div>
    </section>
  `;
};

export const renderEditorPanel = (
  selectedNode: CategoryNode | undefined,
  nodeDataById: Record<string, NodeWorkspaceData>,
  selectedCardIds: string[],
  selectionBox:
    | {
        nodeId: string;
        left: number;
        top: number;
        width: number;
        height: number;
      }
    | null,
): string => {
  if (!selectedNode) {
    return `
      <h2>No node selected</h2>
      <p class="editor-subtitle">Select or create a node to begin.</p>
      <div class="content-placeholder">Choose a node from the structure tree.</div>
    `;
  }

  if (selectedNode.editorType === 'noteboard') {
    const visibleSelection =
      selectionBox && selectionBox.nodeId === selectedNode.id
        ? {
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
          }
        : null;
    return renderNoteboard(
      selectedNode,
      nodeDataById[selectedNode.id],
      selectedCardIds,
      visibleSelection,
    );
  }

  return `
    <h2>${selectedNode.name}</h2>
    <p class="editor-subtitle">Editor type: ${editorTypeMeta(selectedNode.editorType).label}</p>
    <div class="content-placeholder">
      This editor type is scaffolded but not implemented yet.
    </div>
  `;
};
