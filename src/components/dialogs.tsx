import React from 'react';
import type { AppTheme, CategoryNode } from '../shared/types';
import { editorTypeOptions } from '../shared/editor-types';
import {
  GRID_ENABLED_TOKEN,
  THEME_TOKEN_GROUPS,
  type ThemeTokenKey,
} from '../features/theme/theme-schema';

const hexColorRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexForPicker = (value: string): string | null => {
  const trimmed = value.trim();
  if (!hexColorRegex.test(trimmed)) {
    return null;
  }
  if (trimmed.length === 4) {
    const [r, g, b] = trimmed.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const isColorThemeToken = (tokenKey: ThemeTokenKey): boolean =>
  tokenKey !== GRID_ENABLED_TOKEN;

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
  themeValue: AppTheme;
  themeOptions: Array<{ value: AppTheme; label: string }>;
  customThemeValue: string;
  customThemeOptions: Array<{ value: string; label: string }>;
  selectedCustomThemeName: string;
  selectedCustomThemeTokens: Record<string, string>;
  onThemeChange: (value: AppTheme) => void;
  onCustomThemeChange: (value: string) => void;
  onCreateCustomTheme: () => void;
  onImportCustomTheme: () => void;
  onExportCustomTheme: () => void;
  onRenameCustomTheme: (name: string) => void;
  onDeleteCustomTheme: () => void;
  onCustomThemeTokenChange: (tokenKey: ThemeTokenKey, tokenValue: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export const SettingsDialog = ({
  isVisible,
  themeValue,
  themeOptions,
  customThemeValue,
  customThemeOptions,
  selectedCustomThemeName,
  selectedCustomThemeTokens,
  onThemeChange,
  onCustomThemeChange,
  onCreateCustomTheme,
  onImportCustomTheme,
  onExportCustomTheme,
  onRenameCustomTheme,
  onDeleteCustomTheme,
  onCustomThemeTokenChange,
  onCancel,
  onSave,
}: SettingsDialogProps): React.ReactElement | null => {
  const [themeNameDraft, setThemeNameDraft] = React.useState('');

  React.useEffect(() => {
    setThemeNameDraft(selectedCustomThemeName);
  }, [selectedCustomThemeName]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div className="confirm-dialog settings-dialog">
        <h3>Settings</h3>
        <p>Update user preferences for your workspace.</p>
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
        <label className="settings-field">
          <span className="settings-field-label">Custom Theme Override</span>
          <select
            className="settings-input"
            value={customThemeValue}
            onChange={(event) => onCustomThemeChange(event.target.value)}
          >
            <option value="">None</option>
            {customThemeOptions.map((themeOption) => (
              <option key={themeOption.value} value={themeOption.value}>
                {themeOption.label}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-theme-studio">
          <div className="settings-theme-studio-header">
            <span className="settings-field-label">Theme Studio</span>
            <div className="settings-theme-studio-actions">
              <button type="button" onClick={onImportCustomTheme}>
                Import
              </button>
              <button type="button" onClick={onExportCustomTheme} disabled={!customThemeValue}>
                Export
              </button>
              <button type="button" onClick={onCreateCustomTheme}>
                + New
              </button>
            </div>
          </div>
          {customThemeValue ? (
            <>
              <div className="settings-theme-row">
                <input
                  className="settings-input"
                  value={themeNameDraft}
                  maxLength={64}
                  placeholder="Theme name"
                  onChange={(event) => setThemeNameDraft(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => onRenameCustomTheme(themeNameDraft)}
                  disabled={!themeNameDraft.trim()}
                >
                  Rename
                </button>
                <button type="button" className="danger" onClick={onDeleteCustomTheme}>
                  Delete
                </button>
              </div>
              <div className="settings-theme-token-groups">
                {Object.entries(THEME_TOKEN_GROUPS).map(([groupName, groupTokens]) => (
                  <section key={groupName} className="settings-theme-token-group">
                    <h4>{groupName}</h4>
                    <div className="settings-theme-token-grid">
                      {groupTokens.map((tokenKey) => (
                        <label key={tokenKey} className="settings-theme-token-field">
                          <span>{tokenKey}</span>
                          {tokenKey === GRID_ENABLED_TOKEN ? (
                            <select
                              className="settings-input"
                              value={selectedCustomThemeTokens[tokenKey] === 'off' ? 'off' : 'on'}
                              onChange={(event) =>
                                onCustomThemeTokenChange(
                                  tokenKey,
                                  event.target.value === 'off' ? 'off' : 'on',
                                )
                              }
                            >
                              <option value="on">Enabled</option>
                              <option value="off">Disabled</option>
                            </select>
                          ) : (
                            <div className="settings-theme-token-input-row">
                              {isColorThemeToken(tokenKey) ? (
                                <input
                                  className="settings-input settings-theme-token-color"
                                  type="color"
                                  value={
                                    normalizeHexForPicker(selectedCustomThemeTokens[tokenKey] ?? '') ??
                                    '#000000'
                                  }
                                  onChange={(event) =>
                                    onCustomThemeTokenChange(tokenKey, event.target.value)
                                  }
                                />
                              ) : null}
                              <input
                                className="settings-input"
                                value={selectedCustomThemeTokens[tokenKey] ?? ''}
                                placeholder="inherit"
                                onChange={(event) =>
                                  onCustomThemeTokenChange(tokenKey, event.target.value)
                                }
                              />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <p className="settings-theme-studio-empty">
              Create or select a custom theme override to edit token values.
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};
