import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState } from '../../../shared/types';
import { getDocumentMarkdownForNode } from '../../app/app-model';

type UseDocumentEditorActionsOptions = {
  nodeId: string;
  documentEditSessionsRef: MutableRefObject<Set<string>>;
  documentQuickUndoNodeIdRef: MutableRefObject<string | null>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  pushHistory: () => void;
};

type UseDocumentEditorActionsResult = {
  onMarkdownEditStart: () => void;
  onMarkdownEditEnd: () => void;
  onMarkdownChange: (value: string, source?: 'typing' | 'quick-action') => void;
};

export const useDocumentEditorActions = ({
  nodeId,
  documentEditSessionsRef,
  documentQuickUndoNodeIdRef,
  setState,
  pushHistory,
}: UseDocumentEditorActionsOptions): UseDocumentEditorActionsResult => {
  const onMarkdownEditStart = React.useCallback((): void => {
    documentEditSessionsRef.current.delete(nodeId);
  }, [documentEditSessionsRef, nodeId]);

  const onMarkdownEditEnd = React.useCallback((): void => {
    documentEditSessionsRef.current.delete(nodeId);
  }, [documentEditSessionsRef, nodeId]);

  const onMarkdownChange = React.useCallback(
    (value: string, source: 'typing' | 'quick-action' = 'typing'): void => {
      if (source === 'quick-action') {
        pushHistory();
        documentEditSessionsRef.current.delete(nodeId);
        documentQuickUndoNodeIdRef.current = nodeId;
      } else {
        if (!documentEditSessionsRef.current.has(nodeId)) {
          pushHistory();
          documentEditSessionsRef.current.add(nodeId);
        }
        documentQuickUndoNodeIdRef.current = null;
      }

      setState((prev) => {
        const currentValue = getDocumentMarkdownForNode(prev, nodeId);
        if (currentValue === value) {
          return prev;
        }
        return {
          ...prev,
          nodeDataById: {
            ...prev.nodeDataById,
            [nodeId]: {
              ...(prev.nodeDataById[nodeId] ?? {}),
              document: {
                markdown: value,
              },
            },
          },
        };
      });
    },
    [documentEditSessionsRef, documentQuickUndoNodeIdRef, nodeId, pushHistory, setState],
  );

  return {
    onMarkdownEditStart,
    onMarkdownEditEnd,
    onMarkdownChange,
  };
};
