import React from 'react';
import type { AppTheme, CategoryNode } from '../shared/types';
import { editorTypeOptions } from '../shared/editor-types';

type DeleteNodeDialogProps = {
  pendingDeleteNode: CategoryNode | undefined;
  deleteDescendantCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteNodeDialog = ({
  pendingDeleteNode,
  deleteDescendantCount,
  onCancel,
  onConfirm,
}: DeleteNodeDialogProps): React.ReactElement | null => {
  if (!pendingDeleteNode) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div className="confirm-dialog">
        <h3>Delete Node?</h3>
        <p>
          This will permanently delete <strong>{pendingDeleteNode.name}</strong>
          {deleteDescendantCount > 0
            ? ` and ${deleteDescendantCount} nested node${deleteDescendantCount === 1 ? '' : 's'}`
            : ''}
          .
        </p>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

type CreateNodeDialogProps = {
  isVisible: boolean;
  createTargetLabel: string;
  onCancel: () => void;
  onSelectType: (type: (typeof editorTypeOptions)[number]['value']) => void;
};

export const CreateNodeDialog = ({
  isVisible,
  createTargetLabel,
  onCancel,
  onSelectType,
}: CreateNodeDialogProps): React.ReactElement | null => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div className="confirm-dialog">
        <h3>Select Node Category</h3>
        <p>{createTargetLabel}</p>
        <div className="type-option-grid">
          {editorTypeOptions.map((option) => (
            <button
              key={option.value}
              className="type-option"
              onClick={() => onSelectType(option.value)}
            >
              <span className="type-option-icon">
                <i className={option.iconClass}></i>
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

type SettingsDialogProps = {
  isVisible: boolean;
  sidebarWidthValue: string;
  themeValue: AppTheme;
  themeOptions: Array<{ value: AppTheme; label: string }>;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  onSidebarWidthChange: (value: string) => void;
  onThemeChange: (value: AppTheme) => void;
  onCancel: () => void;
  onSave: () => void;
};

export const SettingsDialog = ({
  isVisible,
  sidebarWidthValue,
  themeValue,
  themeOptions,
  minSidebarWidth,
  maxSidebarWidth,
  onSidebarWidthChange,
  onThemeChange,
  onCancel,
  onSave,
}: SettingsDialogProps): React.ReactElement | null => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div className="confirm-dialog">
        <h3>Settings</h3>
        <p>Update user preferences for your workspace.</p>
        <label className="settings-field">
          <span className="settings-field-label">Sidebar Width (px)</span>
          <input
            className="settings-input"
            type="number"
            min={minSidebarWidth}
            max={maxSidebarWidth}
            value={sidebarWidthValue}
            onChange={(event) => onSidebarWidthChange(event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Theme</span>
          <select
            className="settings-input"
            value={themeValue}
            onChange={(event) => onThemeChange(event.target.value as AppTheme)}
          >
            {themeOptions.map((themeOption) => (
              <option key={themeOption.value} value={themeOption.value}>
                {themeOption.label}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};
