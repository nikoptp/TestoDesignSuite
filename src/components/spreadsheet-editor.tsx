import React from 'react';
import type { CategoryNode, SpreadsheetData, SpreadsheetSheet } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import {
  columnIndexToLabel,
  getCellRangeBounds,
  isCellWithinBounds,
  parseCellKey,
  toCellKey,
} from '../features/spreadsheet/spreadsheet-addressing';
import { evaluateSpreadsheetCell } from '../features/spreadsheet/spreadsheet-formula';
import {
  DEFAULT_SPREADSHEET_COLUMN_WIDTH,
  DEFAULT_SPREADSHEET_ROW_HEIGHT,
} from '../features/spreadsheet/spreadsheet-grid-ops';

type SpreadsheetEditorProps = {
  node: CategoryNode;
  spreadsheet: SpreadsheetData;
  onEditStart: () => void;
  onEditEnd: () => void;
  onActiveCellChange: (cellKey: string) => void;
  onCellChange: (cellKey: string, raw: string, source?: 'typing' | 'quick-action') => void;
  onBatchChange: (
    patches: Array<{ cellKey: string; raw: string }>,
    source?: 'typing' | 'quick-action',
  ) => void;
  onInsertRow: (atRowIndex: number) => void;
  onDeleteRow: (atRowIndex: number) => void;
  onInsertColumn: (atColumnIndex: number) => void;
  onDeleteColumn: (atColumnIndex: number) => void;
  onResizeRow: (rowIndex: number, height: number) => void;
  onResizeColumn: (columnIndex: number, width: number) => void;
};

const findActiveSheet = (spreadsheet: SpreadsheetData): SpreadsheetSheet | null =>
  spreadsheet.sheets.find((sheet) => sheet.id === spreadsheet.activeSheetId) ?? spreadsheet.sheets[0] ?? null;

const normalizeMatrixText = (value: string): string[][] =>
  value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((row) => row.split('\t'));

export const SpreadsheetEditor = ({
  node,
  spreadsheet,
  onEditStart,
  onEditEnd,
  onActiveCellChange,
  onCellChange,
  onBatchChange,
  onInsertRow,
  onDeleteRow,
  onInsertColumn,
  onDeleteColumn,
  onResizeRow,
  onResizeColumn,
}: SpreadsheetEditorProps): React.ReactElement => {
  const activeSheet = React.useMemo(() => findActiveSheet(spreadsheet), [spreadsheet]);
  const [isEditingCell, setIsEditingCell] = React.useState(false);
  const [editSource, setEditSource] = React.useState<'grid' | 'formula' | null>(null);
  const [isFormulaInputFocused, setIsFormulaInputFocused] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState('');
  const [rangeAnchorKey, setRangeAnchorKey] = React.useState<string | null>(null);
  const [rangeFocusKey, setRangeFocusKey] = React.useState<string | null>(null);
  const [isMouseSelectingRange, setIsMouseSelectingRange] = React.useState(false);
  const selectedCellKey = spreadsheet.activeCellKey;
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const editStartRawRef = React.useRef('');

  React.useEffect(() => {
    setIsEditingCell(false);
    setEditSource(null);
    setRangeAnchorKey(null);
    setRangeFocusKey(null);
    setIsMouseSelectingRange(false);
  }, [node.id]);

  React.useEffect(() => {
    if (!isMouseSelectingRange) {
      return;
    }

    const onWindowMouseUp = (): void => {
      setIsMouseSelectingRange(false);
    };

    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isMouseSelectingRange]);

  React.useEffect(() => {
    if (!activeSheet) {
      return;
    }
    if (isFormulaInputFocused) {
      return;
    }
    setDraftValue(activeSheet.cells[selectedCellKey]?.raw ?? '');
  }, [activeSheet, isFormulaInputFocused, selectedCellKey]);

  const displayCache = React.useMemo(() => new Map<string, string>(), [activeSheet]);

  const selectedCoords = React.useMemo(() => parseCellKey(selectedCellKey), [selectedCellKey]);
  const activeRangeBounds = React.useMemo(() => {
    const anchor = rangeAnchorKey ?? selectedCellKey;
    const focus = rangeFocusKey ?? selectedCellKey;
    return getCellRangeBounds(anchor, focus);
  }, [rangeAnchorKey, rangeFocusKey, selectedCellKey]);

  const commitCellEdit = React.useCallback((): void => {
    if (!activeSheet) {
      return;
    }
    onCellChange(selectedCellKey, draftValue, 'typing');
    setIsEditingCell(false);
    setEditSource(null);
    onEditEnd();
    editStartRawRef.current = draftValue;
  }, [activeSheet, draftValue, onCellChange, onEditEnd, selectedCellKey]);

  const startCellEdit = React.useCallback((source: 'grid' | 'formula'): void => {
    if (!activeSheet) {
      return;
    }
    const startRaw = activeSheet.cells[selectedCellKey]?.raw ?? '';
    editStartRawRef.current = startRaw;
    setDraftValue(startRaw);
    setIsEditingCell(true);
    setEditSource(source);
    onEditStart();
  }, [activeSheet, onEditStart, selectedCellKey]);

  const cancelCellEdit = React.useCallback((): void => {
    onCellChange(selectedCellKey, editStartRawRef.current, 'quick-action');
    setIsEditingCell(false);
    setEditSource(null);
    onEditEnd();
    setDraftValue(editStartRawRef.current);
  }, [onCellChange, onEditEnd, selectedCellKey]);

  const moveSelection = React.useCallback(
    (rowDelta: number, columnDelta: number, extendSelection: boolean): void => {
      if (!selectedCoords) {
        return;
      }
      const nextColumn = Math.max(0, Math.min(spreadsheet.columnCount - 1, selectedCoords.columnIndex + columnDelta));
      const nextRow = Math.max(0, Math.min(spreadsheet.rowCount - 1, selectedCoords.rowIndex + rowDelta));
      const nextKey = toCellKey(nextColumn, nextRow);
      onActiveCellChange(nextKey);
      if (extendSelection) {
        setRangeAnchorKey((prev) => prev ?? selectedCellKey);
        setRangeFocusKey(nextKey);
        return;
      }
      setRangeAnchorKey(nextKey);
      setRangeFocusKey(nextKey);
    },
    [onActiveCellChange, selectedCellKey, selectedCoords, spreadsheet.columnCount, spreadsheet.rowCount],
  );

  const onGridKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (!activeSheet) {
        return;
      }

      if (isEditingCell) {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitCellEdit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelCellEdit();
        }
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        startCellEdit('grid');
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1, 0, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1, 0, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(0, -1, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(0, 1, event.shiftKey);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (!isEditingCell) {
          const startRaw = activeSheet.cells[selectedCellKey]?.raw ?? '';
          editStartRawRef.current = startRaw;
          onEditStart();
        }
        setDraftValue(event.key);
        setIsEditingCell(true);
        setEditSource('grid');
      }
    },
    [
      activeSheet,
      cancelCellEdit,
      commitCellEdit,
      isEditingCell,
      moveSelection,
      onEditEnd,
      onEditStart,
      selectedCellKey,
      startCellEdit,
    ],
  );

  const onGridCopy = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>): void => {
      if (!activeSheet) {
        return;
      }
      event.preventDefault();
      if (!activeRangeBounds) {
        event.clipboardData.setData('text/plain', activeSheet.cells[selectedCellKey]?.raw ?? '');
        return;
      }

      const rows: string[] = [];
      for (let rowIndex = activeRangeBounds.minRowIndex; rowIndex <= activeRangeBounds.maxRowIndex; rowIndex += 1) {
        const values: string[] = [];
        for (
          let columnIndex = activeRangeBounds.minColumnIndex;
          columnIndex <= activeRangeBounds.maxColumnIndex;
          columnIndex += 1
        ) {
          const cellKey = toCellKey(columnIndex, rowIndex);
          values.push(activeSheet.cells[cellKey]?.raw ?? '');
        }
        rows.push(values.join('\t'));
      }
      event.clipboardData.setData('text/plain', rows.join('\n'));
    },
    [activeRangeBounds, activeSheet, selectedCellKey],
  );

  const onGridPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>): void => {
      if (!activeSheet || !selectedCoords) {
        return;
      }
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      if (!text) {
        return;
      }
      const matrix = normalizeMatrixText(text);
      const patches: Array<{ cellKey: string; raw: string }> = [];
      const startRow = activeRangeBounds?.minRowIndex ?? selectedCoords.rowIndex;
      const startColumn = activeRangeBounds?.minColumnIndex ?? selectedCoords.columnIndex;
      matrix.forEach((row, rowOffset) => {
        row.forEach((value, columnOffset) => {
          const rowIndex = startRow + rowOffset;
          const columnIndex = startColumn + columnOffset;
          if (rowIndex >= spreadsheet.rowCount || columnIndex >= spreadsheet.columnCount) {
            return;
          }
          patches.push({
            cellKey: toCellKey(columnIndex, rowIndex),
            raw: value,
          });
        });
      });

      onBatchChange(patches, 'quick-action');
      if (patches.length > 0) {
        const endCellKey = toCellKey(
          Math.min(spreadsheet.columnCount - 1, startColumn + matrix[0].length - 1),
          Math.min(spreadsheet.rowCount - 1, startRow + matrix.length - 1),
        );
        const startCellKey = toCellKey(startColumn, startRow);
        setRangeAnchorKey(startCellKey);
        setRangeFocusKey(endCellKey);
        onActiveCellChange(startCellKey);
      }
    },
    [
      activeRangeBounds,
      activeSheet,
      onActiveCellChange,
      onBatchChange,
      selectedCoords,
      spreadsheet.columnCount,
      spreadsheet.rowCount,
    ],
  );

  const selectedDisplayValue = React.useMemo(() => {
    if (!activeSheet) {
      return '';
    }
    return evaluateSpreadsheetCell(selectedCellKey, activeSheet.cells, displayCache);
  }, [activeSheet, displayCache, selectedCellKey]);

  const selectedColumnWidth = selectedCoords
    ? spreadsheet.columnWidths?.[String(selectedCoords.columnIndex)] ?? DEFAULT_SPREADSHEET_COLUMN_WIDTH
    : DEFAULT_SPREADSHEET_COLUMN_WIDTH;
  const selectedRowHeight = selectedCoords
    ? spreadsheet.rowHeights?.[String(selectedCoords.rowIndex)] ?? DEFAULT_SPREADSHEET_ROW_HEIGHT
    : DEFAULT_SPREADSHEET_ROW_HEIGHT;

  return (
    <section className="spreadsheet-root">
      <header className="spreadsheet-toolbar">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">Editor type: {editorTypeMeta(node.editorType).label}</p>
        </div>
        <div className="spreadsheet-toolbar-actions">
          <div className="spreadsheet-status-chip">{selectedCellKey}</div>
          {selectedCoords ? (
            <>
              <div className="spreadsheet-shape-actions">
                <button
                  type="button"
                  onClick={() => onInsertRow(selectedCoords.rowIndex)}
                  title="Insert row at selection"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRow(selectedCoords.rowIndex)}
                  title="Delete selected row"
                >
                  - Row
                </button>
                <button
                  type="button"
                  onClick={() => onInsertColumn(selectedCoords.columnIndex)}
                  title="Insert column at selection"
                >
                  + Col
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteColumn(selectedCoords.columnIndex)}
                  title="Delete selected column"
                >
                  - Col
                </button>
              </div>
              <div className="spreadsheet-size-controls">
                <label>
                  W
                  <input
                    type="number"
                    min={72}
                    max={320}
                    value={Math.round(selectedColumnWidth)}
                    onChange={(event) =>
                      onResizeColumn(selectedCoords.columnIndex, Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  H
                  <input
                    type="number"
                    min={22}
                    max={120}
                    value={Math.round(selectedRowHeight)}
                    onChange={(event) =>
                      onResizeRow(selectedCoords.rowIndex, Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="spreadsheet-formula-bar">
        <label htmlFor="spreadsheet-formula-input">Formula</label>
        <input
          id="spreadsheet-formula-input"
          value={isEditingCell || isFormulaInputFocused ? draftValue : activeSheet?.cells[selectedCellKey]?.raw ?? ''}
          placeholder="Type value or formula (=A1+B1)"
          onFocus={() => {
            setIsFormulaInputFocused(true);
            if (!isEditingCell) {
              startCellEdit('formula');
            } else if (editSource !== 'formula') {
              setEditSource('formula');
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftValue(nextValue);
            onCellChange(selectedCellKey, nextValue, 'typing');
          }}
          onBlur={() => {
            setIsFormulaInputFocused(false);
            commitCellEdit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitCellEdit();
              gridRef.current?.focus();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancelCellEdit();
              gridRef.current?.focus();
            }
          }}
        />
        <input
          className="spreadsheet-formula-preview"
          aria-label="Formula result"
          readOnly
          value={selectedDisplayValue}
        />
      </div>

      <div
        ref={gridRef}
        className="spreadsheet-grid-shell"
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onCopy={onGridCopy}
        onPaste={onGridPaste}
        onMouseUp={() => setIsMouseSelectingRange(false)}
      >
        {activeSheet ? (
          <table className="spreadsheet-grid" role="grid" aria-label="Spreadsheet grid">
            <thead>
              <tr>
                <th className="spreadsheet-corner" aria-hidden="true"></th>
                {Array.from({ length: spreadsheet.columnCount }).map((_, columnIndex) => (
                  <th
                    key={`column-${columnIndex}`}
                    className="spreadsheet-column-header"
                    scope="col"
                    style={{
                      width:
                        spreadsheet.columnWidths?.[String(columnIndex)] ??
                        DEFAULT_SPREADSHEET_COLUMN_WIDTH,
                      minWidth:
                        spreadsheet.columnWidths?.[String(columnIndex)] ??
                        DEFAULT_SPREADSHEET_COLUMN_WIDTH,
                    }}
                  >
                    {columnIndexToLabel(columnIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: spreadsheet.rowCount }).map((_, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  <th
                    className="spreadsheet-row-header"
                    scope="row"
                    style={{
                      height:
                        spreadsheet.rowHeights?.[String(rowIndex)] ??
                        DEFAULT_SPREADSHEET_ROW_HEIGHT,
                    }}
                  >
                    {rowIndex + 1}
                  </th>
                  {Array.from({ length: spreadsheet.columnCount }).map((__, columnIndex) => {
                    const cellKey = toCellKey(columnIndex, rowIndex);
                    const display = evaluateSpreadsheetCell(cellKey, activeSheet.cells, displayCache);
                    const isSelected = cellKey === selectedCellKey;
                    const isEditing = isSelected && isEditingCell && editSource === 'grid';
                    const isRangeSelected = isCellWithinBounds(
                      columnIndex,
                      rowIndex,
                      activeRangeBounds,
                    );

                    return (
                      <td
                        key={cellKey}
                        className={`spreadsheet-cell${isSelected ? ' selected' : ''}${isRangeSelected ? ' range-selected' : ''}`}
                        style={{
                          width:
                            spreadsheet.columnWidths?.[String(columnIndex)] ??
                            DEFAULT_SPREADSHEET_COLUMN_WIDTH,
                          minWidth:
                            spreadsheet.columnWidths?.[String(columnIndex)] ??
                            DEFAULT_SPREADSHEET_COLUMN_WIDTH,
                          height:
                            spreadsheet.rowHeights?.[String(rowIndex)] ??
                            DEFAULT_SPREADSHEET_ROW_HEIGHT,
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setIsMouseSelectingRange(true);
                          if (isSelected) {
                            return;
                          }
                          onActiveCellChange(cellKey);
                          if (event.shiftKey) {
                            setRangeAnchorKey((prev) => prev ?? selectedCellKey);
                            setRangeFocusKey(cellKey);
                          } else {
                            setRangeAnchorKey(cellKey);
                            setRangeFocusKey(cellKey);
                          }
                          setIsEditingCell(false);
                          onEditEnd();
                        }}
                        onMouseEnter={() => {
                          if (!isMouseSelectingRange) {
                            return;
                          }
                          onActiveCellChange(cellKey);
                          setRangeFocusKey(cellKey);
                        }}
                        onDoubleClick={() => {
                          onActiveCellChange(cellKey);
                          setRangeAnchorKey(cellKey);
                          setRangeFocusKey(cellKey);
                          startCellEdit('grid');
                        }}
                      >
                        {isEditing ? (
                          <input
                            className="spreadsheet-cell-input"
                            autoFocus
                            value={draftValue}
                            onChange={(event) => setDraftValue(event.target.value)}
                            onBlur={commitCellEdit}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitCellEdit();
                                moveSelection(1, 0, false);
                                gridRef.current?.focus();
                              } else if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelCellEdit();
                                gridRef.current?.focus();
                              }
                            }}
                          />
                        ) : (
                          <span className={display.startsWith('#') ? 'spreadsheet-cell-error' : undefined}>
                            {display}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="editor-empty">No sheet data available.</div>
        )}
      </div>
    </section>
  );
};
