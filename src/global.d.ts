import type { PersistedTreeState, UserSettings } from './shared/types';

declare global {
  interface Window {
    testoApi?: {
      loadTreeState: () => Promise<PersistedTreeState | null>;
      saveTreeState: (state: PersistedTreeState) => Promise<void>;
      loadUserSettings: () => Promise<UserSettings | null>;
      saveUserSettings: (settings: UserSettings) => Promise<void>;
      onOpenSettings: (listener: () => void) => () => void;
    };
  }
}

export {};
