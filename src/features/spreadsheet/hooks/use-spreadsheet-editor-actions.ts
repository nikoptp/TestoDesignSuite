import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState } from '../../../shared/types';
import { updateNodeSpreadsheetData } from '../../app/workspace-node-updaters';
import {
  deleteSpreadsheetColumn,
  deleteSpreadsheetRow,
  insertSpreadsheetColumn,
  insertSpreadsheetRow,
  resizeSpreadsheetColumn,
  resizeSpreadsheetRow,
} from '../spreadsheet-grid-ops';

type SpreadsheetCellPatch = {
  cellKey: string;
  raw: string;
};

type UseSpreadsheetEditorActionsOptions = {
  nodeId: string;
  spreadsheetEditSessionsRef: MutableRefObject<Set<string>>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  pushHistory: () => void;
};

type UseSpreadsheetEditorActionsResult = {
  onSpreadsheetEditStart: () => void;
  onSpreadsheetEditEnd: () => void;
  onSpreadsheetActiveCellChange: (cellKey: string) => void;
  onSpreadsheetCellChange: (cellKey: string, raw: string, source?: 'typing' | 'quick-action') => void;
  onSpreadsheetBatchChange: (
    patches: SpreadsheetCellPatch[],
    source?: 'typing' | 'quick-action',
  ) => void;
  onSpreadsheetInsertRow: (atRowIndex: number) => void;
  onSpreadsheetDeleteRow: (atRowIndex: number) => void;
  onSpreadsheetInsertColumn: (atColumnIndex: number) => void;
  onSpreadsheetDeleteColumn: (atColumnIndex: number) => void;
  onSpreadsheetResizeRow: (rowIndex: number, height: number) => void;
  onSpreadsheetResizeColumn: (columnIndex: number, width: number) => void;
};

const normalizeCellKey = (value: string): string => value.trim().toUpperCase();

export const useSpreadsheetEditorActions = ({
  nodeId,
  spreadsheetEditSessionsRef,
  setState,
  pushHistory,
}: UseSpreadsheetEditorActionsOptions): UseSpreadsheetEditorActionsResult => {
  const onSpreadsheetEditStart = React.useCallback((): void => {
    spreadsheetEditSessionsRef.current.delete(nodeId);
  }, [nodeId, spreadsheetEditSessionsRef]);

  const onSpreadsheetEditEnd = React.useCallback((): void => {
    spreadsheetEditSessionsRef.current.delete(nodeId);
  }, [nodeId, spreadsheetEditSessionsRef]);

  const pushHistoryForSource = React.useCallback(
    (source: 'typing' | 'quick-action'): void => {
      if (source === 'quick-action') {
        pushHistory();
        spreadsheetEditSessionsRef.current.delete(nodeId);
        return;
      }
      if (!spreadsheetEditSessionsRef.current.has(nodeId)) {
        pushHistory();
        spreadsheetEditSessionsRef.current.add(nodeId);
      }
    },
    [nodeId, pushHistory, spreadsheetEditSessionsRef],
  );

  const onSpreadsheetActiveCellChange = React.useCallback(
    (cellKey: string): void => {
      const nextKey = normalizeCellKey(cellKey);
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          if (spreadsheet.activeCellKey === nextKey) {
            return spreadsheet;
          }
          return {
            ...spreadsheet,
            activeCellKey: nextKey,
          };
        }),
      );
    },
    [nodeId, setState],
  );

  const onSpreadsheetBatchChange = React.useCallback(
    (patches: SpreadsheetCellPatch[], source: 'typing' | 'quick-action' = 'typing'): void => {
      if (patches.length === 0) {
        return;
      }

      pushHistoryForSource(source);
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          const activeSheet =
            spreadsheet.sheets.find((sheet) => sheet.id === spreadsheet.activeSheetId) ??
            spreadsheet.sheets[0];
          if (!activeSheet) {
            return spreadsheet;
          }

          let changed = false;
          const nextCells = { ...activeSheet.cells };
          patches.forEach((patch) => {
            const cellKey = normalizeCellKey(patch.cellKey);
            if (!cellKey) {
              return;
            }
            const raw = patch.raw;
            const currentRaw = activeSheet.cells[cellKey]?.raw ?? '';
            if (currentRaw === raw) {
              return;
            }
            changed = true;
            if (!raw.trim()) {
              delete nextCells[cellKey];
            } else {
              nextCells[cellKey] = { raw };
            }
          });
          if (!changed) {
            return spreadsheet;
          }

          const nextSheets = spreadsheet.sheets.map((sheet) =>
            sheet.id === activeSheet.id
              ? {
                  ...sheet,
                  cells: nextCells,
                }
              : sheet,
          );
          return {
            ...spreadsheet,
            sheets: nextSheets,
          };
        }),
      );
    },
    [nodeId, pushHistoryForSource, setState],
  );

  const onSpreadsheetCellChange = React.useCallback(
    (cellKey: string, raw: string, source: 'typing' | 'quick-action' = 'typing'): void => {
      onSpreadsheetBatchChange([{ cellKey, raw }], source);
    },
    [onSpreadsheetBatchChange],
  );

  const onSpreadsheetInsertRow = React.useCallback(
    (atRowIndex: number): void => {
      pushHistory();
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          const next = insertSpreadsheetRow(spreadsheet, atRowIndex);
          return next.spreadsheet;
        }),
      );
    },
    [nodeId, pushHistory, setState],
  );

  const onSpreadsheetDeleteRow = React.useCallback(
    (atRowIndex: number): void => {
      pushHistory();
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          const next = deleteSpreadsheetRow(spreadsheet, atRowIndex);
          return next.spreadsheet;
        }),
      );
    },
    [nodeId, pushHistory, setState],
  );

  const onSpreadsheetInsertColumn = React.useCallback(
    (atColumnIndex: number): void => {
      pushHistory();
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          const next = insertSpreadsheetColumn(spreadsheet, atColumnIndex);
          return next.spreadsheet;
        }),
      );
    },
    [nodeId, pushHistory, setState],
  );

  const onSpreadsheetDeleteColumn = React.useCallback(
    (atColumnIndex: number): void => {
      pushHistory();
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) => {
          const next = deleteSpreadsheetColumn(spreadsheet, atColumnIndex);
          return next.spreadsheet;
        }),
      );
    },
    [nodeId, pushHistory, setState],
  );

  const onSpreadsheetResizeRow = React.useCallback(
    (rowIndex: number, height: number): void => {
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) =>
          resizeSpreadsheetRow(spreadsheet, rowIndex, height),
        ),
      );
    },
    [nodeId, setState],
  );

  const onSpreadsheetResizeColumn = React.useCallback(
    (columnIndex: number, width: number): void => {
      setState((prev) =>
        updateNodeSpreadsheetData(prev, nodeId, (spreadsheet) =>
          resizeSpreadsheetColumn(spreadsheet, columnIndex, width),
        ),
      );
    },
    [nodeId, setState],
  );

  return {
    onSpreadsheetEditStart,
    onSpreadsheetEditEnd,
    onSpreadsheetActiveCellChange,
    onSpreadsheetCellChange,
    onSpreadsheetBatchChange,
    onSpreadsheetInsertRow,
    onSpreadsheetDeleteRow,
    onSpreadsheetInsertColumn,
    onSpreadsheetDeleteColumn,
    onSpreadsheetResizeRow,
    onSpreadsheetResizeColumn,
  };
};
