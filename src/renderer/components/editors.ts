import { editorTypeMeta } from '../../shared/editor-types';
import type { CategoryNode, NodeWorkspaceData } from '../../shared/types';

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
): string => {
  const cards = nodeData?.noteboard?.cards ?? [];
  const cardsMarkup = cards
    .map(
      (card) => `
        <article class="noteboard-card" data-card-shell-id="${card.id}" style="left:${card.x}px; top:${card.y}px;">
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
    <section class="editor-header">
      <h2>${node.name}</h2>
      <div class="editor-header-actions">
        <button data-action="noteboard-add-card" data-node-id="${node.id}">+ Center Card</button>
      </div>
    </section>
    <p class="editor-subtitle">Editor type: ${editorTypeMeta(node.editorType).label}</p>
    <section class="noteboard-canvas" data-action="noteboard-canvas-create" data-node-id="${node.id}">
      ${cardsMarkup || '<p class="editor-empty">No cards yet. Add your first card.</p>'}
    </section>
  `;
};

export const renderEditorPanel = (
  selectedNode: CategoryNode | undefined,
  nodeDataById: Record<string, NodeWorkspaceData>,
): string => {
  if (!selectedNode) {
    return `
      <h2>No node selected</h2>
      <p class="editor-subtitle">Select or create a node to begin.</p>
      <div class="content-placeholder">Choose a node from the structure tree.</div>
    `;
  }

  if (selectedNode.editorType === 'noteboard') {
    return renderNoteboard(selectedNode, nodeDataById[selectedNode.id]);
  }

  return `
    <h2>${selectedNode.name}</h2>
    <p class="editor-subtitle">Editor type: ${editorTypeMeta(selectedNode.editorType).label}</p>
    <div class="content-placeholder">
      This editor type is scaffolded but not implemented yet.
    </div>
  `;
};
