import type {
  PersistedTreeState,
  ProjectImageAsset,
  SavedImageAsset,
  UserSettings,
} from './shared/types';

declare global {
  interface Window {
    testoApi?: {
      loadTreeState: () => Promise<PersistedTreeState | null>;
      saveTreeState: (state: PersistedTreeState) => Promise<void>;
      loadUserSettings: () => Promise<UserSettings | null>;
      saveUserSettings: (settings: UserSettings) => Promise<void>;
      saveImageAsset: (input: { bytes: Uint8Array; mimeType: string }) => Promise<SavedImageAsset>;
      listImageAssets: () => Promise<ProjectImageAsset[]>;
      deleteImageAsset: (relativePath: string) => Promise<void>;
      onOpenSettings: (listener: () => void) => () => void;
    };
  }
}

export {};
