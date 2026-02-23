const COLUMN_LABEL_REGEX = /^[A-Z]+$/;
const CELL_KEY_REGEX = /^([A-Z]+)([1-9]\d*)$/;

export const DEFAULT_SPREADSHEET_ROW_COUNT = 50;
export const DEFAULT_SPREADSHEET_COLUMN_COUNT = 26;
export const MIN_SPREADSHEET_ROW_COUNT = 1;
export const MAX_SPREADSHEET_ROW_COUNT = 500;
export const MIN_SPREADSHEET_COLUMN_COUNT = 1;
export const MAX_SPREADSHEET_COLUMN_COUNT = 52;

export const isSpreadsheetCellKey = (value: string): boolean =>
  CELL_KEY_REGEX.test(value.trim().toUpperCase());

export const columnLabelToIndex = (label: string): number | null => {
  const normalized = label.trim().toUpperCase();
  if (!COLUMN_LABEL_REGEX.test(normalized)) {
    return null;
  }

  let index = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i) - 64;
    index = index * 26 + code;
  }

  return index - 1;
};

export const columnIndexToLabel = (index: number): string => {
  let value = Math.floor(index);
  if (!Number.isFinite(value) || value < 0) {
    return 'A';
  }

  let result = '';
  while (value >= 0) {
    result = String.fromCharCode((value % 26) + 65) + result;
    value = Math.floor(value / 26) - 1;
  }
  return result;
};

export const parseCellKey = (
  key: string,
): { columnIndex: number; rowIndex: number } | null => {
  const normalized = key.trim().toUpperCase();
  const match = normalized.match(CELL_KEY_REGEX);
  if (!match) {
    return null;
  }

  const columnIndex = columnLabelToIndex(match[1]);
  if (columnIndex === null) {
    return null;
  }

  const rowNumber = Number(match[2]);
  if (!Number.isInteger(rowNumber) || rowNumber < 1) {
    return null;
  }

  return {
    columnIndex,
    rowIndex: rowNumber - 1,
  };
};

export const toCellKey = (columnIndex: number, rowIndex: number): string =>
  `${columnIndexToLabel(columnIndex)}${Math.max(0, Math.floor(rowIndex)) + 1}`;

export const expandCellRange = (fromKey: string, toKey: string): string[] => {
  const from = parseCellKey(fromKey);
  const to = parseCellKey(toKey);
  if (!from || !to) {
    return [];
  }

  const minColumn = Math.min(from.columnIndex, to.columnIndex);
  const maxColumn = Math.max(from.columnIndex, to.columnIndex);
  const minRow = Math.min(from.rowIndex, to.rowIndex);
  const maxRow = Math.max(from.rowIndex, to.rowIndex);

  const keys: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      keys.push(toCellKey(column, row));
    }
  }
  return keys;
};

export type SpreadsheetRangeBounds = {
  minColumnIndex: number;
  maxColumnIndex: number;
  minRowIndex: number;
  maxRowIndex: number;
};

export const getCellRangeBounds = (
  fromKey: string,
  toKey: string,
): SpreadsheetRangeBounds | null => {
  const from = parseCellKey(fromKey);
  const to = parseCellKey(toKey);
  if (!from || !to) {
    return null;
  }

  return {
    minColumnIndex: Math.min(from.columnIndex, to.columnIndex),
    maxColumnIndex: Math.max(from.columnIndex, to.columnIndex),
    minRowIndex: Math.min(from.rowIndex, to.rowIndex),
    maxRowIndex: Math.max(from.rowIndex, to.rowIndex),
  };
};

export const isCellWithinBounds = (
  columnIndex: number,
  rowIndex: number,
  bounds: SpreadsheetRangeBounds | null,
): boolean => {
  if (!bounds) {
    return false;
  }
  return (
    columnIndex >= bounds.minColumnIndex &&
    columnIndex <= bounds.maxColumnIndex &&
    rowIndex >= bounds.minRowIndex &&
    rowIndex <= bounds.maxRowIndex
  );
};
