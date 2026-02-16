import { contextBridge, ipcRenderer } from 'electron';
import type {
  PersistedTreeState,
  ProjectImageAsset,
  SavedImageAsset,
  UserSettings,
} from './shared/types';

contextBridge.exposeInMainWorld('testoApi', {
  loadTreeState: (): Promise<PersistedTreeState | null> =>
    ipcRenderer.invoke('tree:load') as Promise<PersistedTreeState | null>,
  saveTreeState: (state: PersistedTreeState): Promise<void> =>
    ipcRenderer.invoke('tree:save', state) as Promise<void>,
  loadUserSettings: (): Promise<UserSettings | null> =>
    ipcRenderer.invoke('settings:load') as Promise<UserSettings | null>,
  saveUserSettings: (settings: UserSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings) as Promise<void>,
  saveImageAsset: (input: { bytes: Uint8Array; mimeType: string }): Promise<SavedImageAsset> =>
    ipcRenderer.invoke('assets:save-image', input) as Promise<SavedImageAsset>,
  listImageAssets: (): Promise<ProjectImageAsset[]> =>
    ipcRenderer.invoke('assets:list-images') as Promise<ProjectImageAsset[]>,
  deleteImageAsset: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke('assets:delete-image', relativePath) as Promise<void>,
  onOpenSettings: (listener: () => void): (() => void) => {
    const wrapped = (): void => {
      listener();
    };
    ipcRenderer.on('menu:open-settings', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:open-settings', wrapped);
    };
  },
});
