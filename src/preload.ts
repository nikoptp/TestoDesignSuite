import { contextBridge, ipcRenderer } from 'electron';
import type { PersistedTreeState, UserSettings } from './shared/types';

contextBridge.exposeInMainWorld('testoApi', {
  loadTreeState: (): Promise<PersistedTreeState | null> =>
    ipcRenderer.invoke('tree:load') as Promise<PersistedTreeState | null>,
  saveTreeState: (state: PersistedTreeState): Promise<void> =>
    ipcRenderer.invoke('tree:save', state) as Promise<void>,
  loadUserSettings: (): Promise<UserSettings | null> =>
    ipcRenderer.invoke('settings:load') as Promise<UserSettings | null>,
  saveUserSettings: (settings: UserSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings) as Promise<void>,
});
