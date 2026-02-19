import { BrowserWindow, dialog } from 'electron';
import { readFile } from 'node:fs/promises';
import type { CustomThemeDefinition } from '../shared/types';
import { safeWriteFile } from './json-file-store';
import { parseCustomThemeBundle } from './theme-bundle';

type CustomThemeBundleV1 = {
  version: 1;
  exportedAt: number;
  theme: CustomThemeDefinition;
};

export const exportCustomThemeToFile = async (
  inputTheme: CustomThemeDefinition,
): Promise<boolean> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) {
    return false;
  }

  const result = await dialog.showSaveDialog(focusedWindow, {
    title: 'Export Custom Theme',
    defaultPath: `${inputTheme.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-theme'}.testo-theme.json`,
    filters: [
      { name: 'Testo Theme', extensions: ['testo-theme', 'json'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  const bundle: CustomThemeBundleV1 = {
    version: 1,
    exportedAt: Date.now(),
    theme: inputTheme,
  };
  await safeWriteFile(result.filePath, JSON.stringify(bundle, null, 2));
  return true;
};

export const importCustomThemeFromFile = async (): Promise<CustomThemeDefinition | null> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(focusedWindow, {
    title: 'Import Custom Theme',
    properties: ['openFile'],
    filters: [
      { name: 'Testo Theme', extensions: ['testo-theme', 'json'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await readFile(filePath, 'utf8');
  return parseCustomThemeBundle(content);
};
