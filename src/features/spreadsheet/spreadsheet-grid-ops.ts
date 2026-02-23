import type { SpreadsheetCell, SpreadsheetData, SpreadsheetSheet } from '../../shared/types';
import {
  MAX_SPREADSHEET_COLUMN_COUNT,
  MAX_SPREADSHEET_ROW_COUNT,
  MIN_SPREADSHEET_COLUMN_COUNT,
  MIN_SPREADSHEET_ROW_COUNT,
  parseCellKey,
  toCellKey,
} from './spreadsheet-addressing';

export const DEFAULT_SPREADSHEET_COLUMN_WIDTH = 120;
export const DEFAULT_SPREADSHEET_ROW_HEIGHT = 30;
export const MIN_SPREADSHEET_COLUMN_WIDTH = 72;
export const MAX_SPREADSHEET_COLUMN_WIDTH = 320;
export const MIN_SPREADSHEET_ROW_HEIGHT = 22;
export const MAX_SPREADSHEET_ROW_HEIGHT = 120;

type SpreadsheetShapeChange = {
  spreadsheet: SpreadsheetData;
  activeCellKey: string;
};

const activeSheetFromSpreadsheet = (spreadsheet: SpreadsheetData): SpreadsheetSheet | null =>
  spreadsheet.sheets.find((sheet) => sheet.id === spreadsheet.activeSheetId) ?? spreadsheet.sheets[0] ?? null;

const clampRowCount = (value: number): number =>
  Math.min(MAX_SPREADSHEET_ROW_COUNT, Math.max(MIN_SPREADSHEET_ROW_COUNT, value));

const clampColumnCount = (value: number): number =>
  Math.min(MAX_SPREADSHEET_COLUMN_COUNT, Math.max(MIN_SPREADSHEET_COLUMN_COUNT, value));

const clampColumnWidth = (value: number): number =>
  Math.min(
    MAX_SPREADSHEET_COLUMN_WIDTH,
    Math.max(
      MIN_SPREADSHEET_COLUMN_WIDTH,
      Math.round(Number.isFinite(value) ? value : DEFAULT_SPREADSHEET_COLUMN_WIDTH),
    ),
  );

const clampRowHeight = (value: number): number =>
  Math.min(
    MAX_SPREADSHEET_ROW_HEIGHT,
    Math.max(
      MIN_SPREADSHEET_ROW_HEIGHT,
      Math.round(Number.isFinite(value) ? value : DEFAULT_SPREADSHEET_ROW_HEIGHT),
    ),
  );

const shiftIndexedSizes = (
  source: Record<string, number> | undefined,
  fromIndex: number,
  delta: 1 | -1,
  limit: number,
): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!source) {
    return result;
  }

  Object.entries(source).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= limit) {
      return;
    }
    if (delta === 1 && index >= fromIndex) {
      if (index + 1 < limit) {
        result[String(index + 1)] = value;
      }
      return;
    }
    if (delta === -1) {
      if (index === fromIndex) {
        return;
      }
      if (index > fromIndex) {
        result[String(index - 1)] = value;
        return;
      }
    }
    result[String(index)] = value;
  });

  return result;
};

const remapCells = (
  cells: Record<string, SpreadsheetCell>,
  rowMapper: (rowIndex: number) => number | null,
  columnMapper: (columnIndex: number) => number | null,
): Record<string, SpreadsheetCell> => {
  const next: Record<string, SpreadsheetCell> = {};

  Object.entries(cells).forEach(([cellKey, value]) => {
    const parsed = parseCellKey(cellKey);
    if (!parsed) {
      return;
    }

    const mappedRowIndex = rowMapper(parsed.rowIndex);
    const mappedColumnIndex = columnMapper(parsed.columnIndex);
    if (mappedRowIndex === null || mappedColumnIndex === null) {
      return;
    }

    next[toCellKey(mappedColumnIndex, mappedRowIndex)] = value;
  });

  return next;
};

const normalizeActiveCellForShape = (
  activeCellKey: string,
  rowCount: number,
  columnCount: number,
): string => {
  const parsed = parseCellKey(activeCellKey);
  if (!parsed) {
    return 'A1';
  }

  const rowIndex = Math.max(0, Math.min(rowCount - 1, parsed.rowIndex));
  const columnIndex = Math.max(0, Math.min(columnCount - 1, parsed.columnIndex));
  return toCellKey(columnIndex, rowIndex);
};

export const insertSpreadsheetRow = (
  spreadsheet: SpreadsheetData,
  atRowIndex: number,
): SpreadsheetShapeChange => {
  const activeSheet = activeSheetFromSpreadsheet(spreadsheet);
  if (!activeSheet || spreadsheet.rowCount >= MAX_SPREADSHEET_ROW_COUNT) {
    return {
      spreadsheet,
      activeCellKey: spreadsheet.activeCellKey,
    };
  }

  const nextRowCount = clampRowCount(spreadsheet.rowCount + 1);
  const targetRowIndex = Math.max(0, Math.min(spreadsheet.rowCount - 1, atRowIndex));
  const nextCells = remapCells(
    activeSheet.cells,
    (rowIndex) => (rowIndex >= targetRowIndex ? rowIndex + 1 : rowIndex),
    (columnIndex) => columnIndex,
  );

  const nextSheets = spreadsheet.sheets.map((sheet) =>
    sheet.id === activeSheet.id
      ? {
          ...sheet,
          cells: nextCells,
        }
      : sheet,
  );

  const nextActiveCellKey = (() => {
    const parsed = parseCellKey(spreadsheet.activeCellKey);
    if (!parsed) {
      return normalizeActiveCellForShape(spreadsheet.activeCellKey, nextRowCount, spreadsheet.columnCount);
    }
    if (parsed.rowIndex >= targetRowIndex) {
      return toCellKey(parsed.columnIndex, parsed.rowIndex + 1);
    }
    return toCellKey(parsed.columnIndex, parsed.rowIndex);
  })();

  return {
    spreadsheet: {
      ...spreadsheet,
      sheets: nextSheets,
      rowCount: nextRowCount,
      activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, nextRowCount, spreadsheet.columnCount),
      rowHeights: shiftIndexedSizes(spreadsheet.rowHeights, targetRowIndex, 1, nextRowCount),
    },
    activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, nextRowCount, spreadsheet.columnCount),
  };
};

export const deleteSpreadsheetRow = (
  spreadsheet: SpreadsheetData,
  atRowIndex: number,
): SpreadsheetShapeChange => {
  const activeSheet = activeSheetFromSpreadsheet(spreadsheet);
  if (!activeSheet || spreadsheet.rowCount <= MIN_SPREADSHEET_ROW_COUNT) {
    return {
      spreadsheet,
      activeCellKey: spreadsheet.activeCellKey,
    };
  }

  const targetRowIndex = Math.max(0, Math.min(spreadsheet.rowCount - 1, atRowIndex));
  const nextRowCount = clampRowCount(spreadsheet.rowCount - 1);
  const nextCells = remapCells(
    activeSheet.cells,
    (rowIndex) => {
      if (rowIndex === targetRowIndex) {
        return null;
      }
      if (rowIndex > targetRowIndex) {
        return rowIndex - 1;
      }
      return rowIndex;
    },
    (columnIndex) => columnIndex,
  );

  const nextSheets = spreadsheet.sheets.map((sheet) =>
    sheet.id === activeSheet.id
      ? {
          ...sheet,
          cells: nextCells,
        }
      : sheet,
  );

  const parsedActive = parseCellKey(spreadsheet.activeCellKey);
  const nextActiveCellKey = parsedActive
    ? toCellKey(
        parsedActive.columnIndex,
        parsedActive.rowIndex > targetRowIndex
          ? parsedActive.rowIndex - 1
          : Math.min(parsedActive.rowIndex, nextRowCount - 1),
      )
    : 'A1';

  return {
    spreadsheet: {
      ...spreadsheet,
      sheets: nextSheets,
      rowCount: nextRowCount,
      activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, nextRowCount, spreadsheet.columnCount),
      rowHeights: shiftIndexedSizes(spreadsheet.rowHeights, targetRowIndex, -1, spreadsheet.rowCount),
    },
    activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, nextRowCount, spreadsheet.columnCount),
  };
};

export const insertSpreadsheetColumn = (
  spreadsheet: SpreadsheetData,
  atColumnIndex: number,
): SpreadsheetShapeChange => {
  const activeSheet = activeSheetFromSpreadsheet(spreadsheet);
  if (!activeSheet || spreadsheet.columnCount >= MAX_SPREADSHEET_COLUMN_COUNT) {
    return {
      spreadsheet,
      activeCellKey: spreadsheet.activeCellKey,
    };
  }

  const nextColumnCount = clampColumnCount(spreadsheet.columnCount + 1);
  const targetColumnIndex = Math.max(0, Math.min(spreadsheet.columnCount - 1, atColumnIndex));
  const nextCells = remapCells(
    activeSheet.cells,
    (rowIndex) => rowIndex,
    (columnIndex) => (columnIndex >= targetColumnIndex ? columnIndex + 1 : columnIndex),
  );

  const nextSheets = spreadsheet.sheets.map((sheet) =>
    sheet.id === activeSheet.id
      ? {
          ...sheet,
          cells: nextCells,
        }
      : sheet,
  );

  const parsedActive = parseCellKey(spreadsheet.activeCellKey);
  const nextActiveCellKey = parsedActive
    ? toCellKey(
        parsedActive.columnIndex >= targetColumnIndex
          ? parsedActive.columnIndex + 1
          : parsedActive.columnIndex,
        parsedActive.rowIndex,
      )
    : 'A1';

  return {
    spreadsheet: {
      ...spreadsheet,
      sheets: nextSheets,
      columnCount: nextColumnCount,
      activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, spreadsheet.rowCount, nextColumnCount),
      columnWidths: shiftIndexedSizes(spreadsheet.columnWidths, targetColumnIndex, 1, nextColumnCount),
    },
    activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, spreadsheet.rowCount, nextColumnCount),
  };
};

export const deleteSpreadsheetColumn = (
  spreadsheet: SpreadsheetData,
  atColumnIndex: number,
): SpreadsheetShapeChange => {
  const activeSheet = activeSheetFromSpreadsheet(spreadsheet);
  if (!activeSheet || spreadsheet.columnCount <= MIN_SPREADSHEET_COLUMN_COUNT) {
    return {
      spreadsheet,
      activeCellKey: spreadsheet.activeCellKey,
    };
  }

  const targetColumnIndex = Math.max(0, Math.min(spreadsheet.columnCount - 1, atColumnIndex));
  const nextColumnCount = clampColumnCount(spreadsheet.columnCount - 1);
  const nextCells = remapCells(
    activeSheet.cells,
    (rowIndex) => rowIndex,
    (columnIndex) => {
      if (columnIndex === targetColumnIndex) {
        return null;
      }
      if (columnIndex > targetColumnIndex) {
        return columnIndex - 1;
      }
      return columnIndex;
    },
  );

  const nextSheets = spreadsheet.sheets.map((sheet) =>
    sheet.id === activeSheet.id
      ? {
          ...sheet,
          cells: nextCells,
        }
      : sheet,
  );

  const parsedActive = parseCellKey(spreadsheet.activeCellKey);
  const nextActiveCellKey = parsedActive
    ? toCellKey(
        parsedActive.columnIndex > targetColumnIndex
          ? parsedActive.columnIndex - 1
          : Math.min(parsedActive.columnIndex, nextColumnCount - 1),
        parsedActive.rowIndex,
      )
    : 'A1';

  return {
    spreadsheet: {
      ...spreadsheet,
      sheets: nextSheets,
      columnCount: nextColumnCount,
      activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, spreadsheet.rowCount, nextColumnCount),
      columnWidths: shiftIndexedSizes(spreadsheet.columnWidths, targetColumnIndex, -1, spreadsheet.columnCount),
    },
    activeCellKey: normalizeActiveCellForShape(nextActiveCellKey, spreadsheet.rowCount, nextColumnCount),
  };
};

export const resizeSpreadsheetColumn = (
  spreadsheet: SpreadsheetData,
  columnIndex: number,
  width: number,
): SpreadsheetData => {
  if (columnIndex < 0 || columnIndex >= spreadsheet.columnCount) {
    return spreadsheet;
  }
  const clampedWidth = clampColumnWidth(width);
  const key = String(columnIndex);
  if ((spreadsheet.columnWidths ?? {})[key] === clampedWidth) {
    return spreadsheet;
  }
  return {
    ...spreadsheet,
    columnWidths: {
      ...(spreadsheet.columnWidths ?? {}),
      [key]: clampedWidth,
    },
  };
};

export const resizeSpreadsheetRow = (
  spreadsheet: SpreadsheetData,
  rowIndex: number,
  height: number,
): SpreadsheetData => {
  if (rowIndex < 0 || rowIndex >= spreadsheet.rowCount) {
    return spreadsheet;
  }
  const clampedHeight = clampRowHeight(height);
  const key = String(rowIndex);
  if ((spreadsheet.rowHeights ?? {})[key] === clampedHeight) {
    return spreadsheet;
  }
  return {
    ...spreadsheet,
    rowHeights: {
      ...(spreadsheet.rowHeights ?? {}),
      [key]: clampedHeight,
    },
  };
};
