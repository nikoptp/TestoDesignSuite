import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditorType, PersistedTreeState, UserSettings } from '../../../shared/types';
import { createNode, findFirstNodeId, findNodeById, removeNodeById } from '../../../shared/tree-utils';
import { type UiState, collectSubtreeIds } from '../../app/app-model';

type UseTreeActionsOptions = {
  state: PersistedTreeState;
  uiState: UiState;
  settings: UserSettings;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  setSettings: Dispatch<SetStateAction<UserSettings>>;
  pushHistory: () => void;
  clampSidebarWidth: (value: number) => number;
  isAppTheme: (value: unknown) => boolean;
};

type TreeActions = {
  onSelectNode: (nodeId: string) => void;
  onBeginRename: (nodeId: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelectCreateType: (type: EditorType) => void;
  onConfirmDelete: () => void;
  onSaveSettings: () => void;
};

export const useTreeActions = ({
  state,
  uiState,
  settings,
  setState,
  setUiState,
  setSettings,
  pushHistory,
  clampSidebarWidth,
  isAppTheme,
}: UseTreeActionsOptions): TreeActions => {
  const onSelectNode = React.useCallback(
    (nodeId: string): void => {
      if (uiState.editingNodeId) {
        return;
      }

      const node = findNodeById(state.nodes, nodeId);
      if (!node) {
        return;
      }

      setState((prev) => ({
        ...prev,
        selectedNodeId: node.id,
      }));
      setUiState((prev) => ({
        ...prev,
        cardSelection: {
          nodeId: null,
          cardIds: [],
        },
        contextMenu: null,
        selectionBox: null,
      }));
    },
    [setState, setUiState, state.nodes, uiState.editingNodeId],
  );

  const onBeginRename = React.useCallback(
    (nodeId: string): void => {
      const node = findNodeById(state.nodes, nodeId);
      if (!node) {
        return;
      }

      setUiState((prev) => ({
        ...prev,
        editingNodeId: node.id,
        editingNameDraft: node.name,
      }));
    },
    [setUiState, state.nodes],
  );

  const onRenameCommit = React.useCallback((): void => {
    if (!uiState.editingNodeId) {
      return;
    }

    const nextName = uiState.editingNameDraft.trim();
    if (!nextName) {
      setUiState((prev) => ({
        ...prev,
        editingNodeId: null,
        editingNameDraft: '',
      }));
      return;
    }

    setState((prev) => {
      const node = findNodeById(prev.nodes, uiState.editingNodeId);
      if (!node) {
        return prev;
      }

      if (node.name !== nextName) {
        pushHistory();
      }
      node.name = nextName;
      return { ...prev, nodes: [...prev.nodes] };
    });

    setUiState((prev) => ({
      ...prev,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  }, [pushHistory, setState, setUiState, uiState.editingNameDraft, uiState.editingNodeId]);

  const onRenameCancel = React.useCallback((): void => {
    setUiState((prev) => ({
      ...prev,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  }, [setUiState]);

  const onSelectCreateType = React.useCallback(
    (type: EditorType): void => {
      pushHistory();
      setState((prev) => {
        const nextNode = createNode(`Untitled Node ${prev.nextNodeNumber}`, type);
        const nextNodes = [...prev.nodes];
        const nextNodeData = { ...prev.nodeDataById, [nextNode.id]: {} };
        const parentRef = uiState.pendingCreateParentRef;

        if (parentRef === 'root') {
          nextNodes.push(nextNode);
        } else {
          const parent = findNodeById(nextNodes, parentRef);
          if (!parent) {
            return prev;
          }
          parent.children.push(nextNode);
        }

        return {
          ...prev,
          nodes: nextNodes,
          selectedNodeId: nextNode.id,
          nextNodeNumber: prev.nextNodeNumber + 1,
          nodeDataById: nextNodeData,
        };
      });

      setUiState((prev) => ({
        ...prev,
        pendingCreateParentRef: null,
      }));
    },
    [pushHistory, setState, setUiState, uiState.pendingCreateParentRef],
  );

  const onConfirmDelete = React.useCallback((): void => {
    if (!uiState.pendingDeleteNodeId) {
      return;
    }

    const nodeBeforeDelete = findNodeById(state.nodes, uiState.pendingDeleteNodeId);
    if (nodeBeforeDelete) {
      pushHistory();
    }
    setState((prev) => {
      const nodeBeforeDelete = findNodeById(prev.nodes, uiState.pendingDeleteNodeId);
      if (!nodeBeforeDelete) {
        return prev;
      }

      const subtreeIds = collectSubtreeIds(nodeBeforeDelete);
      const nextNodes = [...prev.nodes];
      const wasRemoved = removeNodeById(nextNodes, uiState.pendingDeleteNodeId);
      if (!wasRemoved) {
        return prev;
      }

      const nextNodeData = { ...prev.nodeDataById };
      subtreeIds.forEach((nodeId) => {
        delete nextNodeData[nodeId];
      });

      const nextSelectedNodeId =
        prev.selectedNodeId === uiState.pendingDeleteNodeId ||
        !findNodeById(nextNodes, prev.selectedNodeId)
          ? findFirstNodeId(nextNodes)
          : prev.selectedNodeId;

      return {
        ...prev,
        nodes: nextNodes,
        selectedNodeId: nextSelectedNodeId,
        nodeDataById: nextNodeData,
      };
    });

    setUiState((prev) => ({
      ...prev,
      pendingDeleteNodeId: null,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  }, [pushHistory, setState, setUiState, state.nodes, uiState.pendingDeleteNodeId]);

  const onSaveSettings = React.useCallback((): void => {
    const parsed = Number(uiState.settingsDraftSidebarWidth);
    const nextSidebarWidth = Number.isFinite(parsed)
      ? clampSidebarWidth(parsed)
      : settings.sidebarWidth;
    const nextTheme = isAppTheme(uiState.settingsDraftTheme)
      ? uiState.settingsDraftTheme
      : settings.theme;
    const nextCustomThemeIdCandidate = uiState.settingsDraftCustomThemeId.trim();
    const nextCustomThemeId =
      nextCustomThemeIdCandidate &&
      (settings.customThemes ?? []).some(
        (theme) => theme.id === nextCustomThemeIdCandidate && theme.baseTheme === nextTheme,
      )
        ? nextCustomThemeIdCandidate
        : undefined;

    setSettings((prev) => ({
      ...prev,
      sidebarWidth: nextSidebarWidth,
      theme: nextTheme,
      activeCustomThemeId: nextCustomThemeId,
    }));
    setUiState((prev) => ({
      ...prev,
      isSettingsDialogOpen: false,
      settingsDraftSidebarWidth: String(nextSidebarWidth),
      settingsDraftTheme: nextTheme,
      settingsDraftCustomThemeId: nextCustomThemeId ?? '',
    }));
  }, [
    clampSidebarWidth,
    isAppTheme,
    setSettings,
    setUiState,
    settings.sidebarWidth,
    settings.theme,
    settings.customThemes,
    uiState.settingsDraftCustomThemeId,
    uiState.settingsDraftSidebarWidth,
    uiState.settingsDraftTheme,
  ]);

  return {
    onSelectNode,
    onBeginRename,
    onRenameCommit,
    onRenameCancel,
    onSelectCreateType,
    onConfirmDelete,
    onSaveSettings,
  };
};
