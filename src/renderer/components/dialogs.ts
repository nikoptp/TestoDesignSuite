import type { CategoryNode } from '../../shared/types';
import { editorTypeOptions } from '../../shared/editor-types';
import { escapeHtml } from '../html-utils';

export const renderDeleteDialog = (
  pendingDeleteNode: CategoryNode | undefined,
  deleteDescendantCount: number,
): string => {
  if (!pendingDeleteNode) {
    return '';
  }

  return `
    <div class="dialog-backdrop">
      <div class="confirm-dialog">
        <h3>Delete Node?</h3>
        <p>
          This will permanently delete <strong>${escapeHtml(pendingDeleteNode.name)}</strong>
          ${
            deleteDescendantCount > 0
              ? ` and ${deleteDescendantCount} nested node${deleteDescendantCount === 1 ? '' : 's'}`
              : ''
          }.
        </p>
        <div class="dialog-actions">
          <button data-action="cancel-delete">Cancel</button>
          <button class="danger" data-action="confirm-delete" data-id="${pendingDeleteNode.id}">Delete</button>
        </div>
      </div>
    </div>
  `;
};

export const renderCreateNodeDialog = (
  isVisible: boolean,
  createTargetLabel: string,
): string => {
  if (!isVisible) {
    return '';
  }

  const createTypeOptions = editorTypeOptions
    .map(
      (option) => `
      <button class="type-option" data-action="create-node-type" data-type="${option.value}">
        <span class="type-option-icon"><i class="${option.iconClass}"></i></span>
        <span>${option.label}</span>
      </button>`,
    )
    .join('');

  return `
    <div class="dialog-backdrop">
      <div class="confirm-dialog">
        <h3>Select Node Category</h3>
        <p>${escapeHtml(createTargetLabel)}</p>
        <div class="type-option-grid">${createTypeOptions}</div>
        <div class="dialog-actions">
          <button data-action="cancel-create-node">Cancel</button>
        </div>
      </div>
    </div>
  `;
};
