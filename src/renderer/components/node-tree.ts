import type { CategoryNode } from '../../shared/types';
import { editorTypeMeta } from '../../shared/editor-types';

export type NodeTreeViewState = {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editingNameDraft: string;
};

export const renderNodeTree = (
  nodes: CategoryNode[],
  viewState: NodeTreeViewState,
): string =>
  nodes
    .map((node) => {
      const children = node.children.length
        ? `<ul class="tree-list nested">${renderNodeTree(node.children, viewState)}</ul>`
        : '';
      const isEditing = viewState.editingNodeId === node.id;
      const meta = editorTypeMeta(node.editorType);

      const mainContent = isEditing
        ? `
          <div class="tree-item editing">
            <span class="node-category-icon" title="${meta.label}" aria-label="${meta.label}"><i class="${meta.iconClass}"></i></span>
            <input class="rename-input" data-action="rename-input" data-id="${node.id}" value="${viewState.editingNameDraft}" />
          </div>`
        : `
          <button class="tree-item ${node.id === viewState.selectedNodeId ? 'active' : ''}" data-action="select-node" data-id="${node.id}" title="${meta.label}">
            <span class="node-category-icon" aria-label="${meta.label}"><i class="${meta.iconClass}"></i></span>
            <span class="node-name">${node.name}</span>
          </button>`;

      return `
        <li>
          <div class="tree-row">
            ${mainContent}
            <div class="node-actions">
              <button class="icon-action" data-action="add-child-node" data-id="${node.id}" title="Add child node" aria-label="Add child node"><i class="fa-solid fa-plus"></i></button>
              <button class="icon-action danger" data-action="request-delete-node" data-id="${node.id}" title="Delete node" aria-label="Delete node"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          ${children}
        </li>`;
    })
    .join('');
