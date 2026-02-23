import { describe, expect, it } from 'vitest';
import type { SpreadsheetData } from '../../src/shared/types';
import {
  deleteSpreadsheetColumn,
  deleteSpreadsheetRow,
  insertSpreadsheetColumn,
  insertSpreadsheetRow,
  resizeSpreadsheetColumn,
  resizeSpreadsheetRow,
} from '../../src/features/spreadsheet/spreadsheet-grid-ops';

const createSpreadsheet = (): SpreadsheetData => ({
  sheets: [
    {
      id: 'sheet-1',
      name: 'Sheet 1',
      cells: {
        A1: { raw: '1' },
        B1: { raw: '2' },
        A2: { raw: '3' },
      },
    },
  ],
  activeSheetId: 'sheet-1',
  activeCellKey: 'A1',
  rowCount: 4,
  columnCount: 4,
  rowHeights: {},
  columnWidths: {},
});

describe('spreadsheet-grid-ops', () => {
  it('inserts a row and shifts cells below', () => {
    const input = createSpreadsheet();
    const result = insertSpreadsheetRow(input, 1);
    const cells = result.spreadsheet.sheets[0]?.cells ?? {};
    expect(result.spreadsheet.rowCount).toBe(5);
    expect(cells.A3?.raw).toBe('3');
  });

  it('deletes a row and shifts cells up', () => {
    const input = createSpreadsheet();
    const result = deleteSpreadsheetRow(input, 0);
    const cells = result.spreadsheet.sheets[0]?.cells ?? {};
    expect(result.spreadsheet.rowCount).toBe(3);
    expect(cells.A1?.raw).toBe('3');
    expect(cells.B1).toBeUndefined();
  });

  it('inserts a column and shifts cells right', () => {
    const input = createSpreadsheet();
    const result = insertSpreadsheetColumn(input, 1);
    const cells = result.spreadsheet.sheets[0]?.cells ?? {};
    expect(result.spreadsheet.columnCount).toBe(5);
    expect(cells.C1?.raw).toBe('2');
  });

  it('deletes a column and shifts cells left', () => {
    const input = createSpreadsheet();
    const result = deleteSpreadsheetColumn(input, 0);
    const cells = result.spreadsheet.sheets[0]?.cells ?? {};
    expect(result.spreadsheet.columnCount).toBe(3);
    expect(cells.A1?.raw).toBe('2');
    expect(cells.A2).toBeUndefined();
  });

  it('resizes row and column with clamping', () => {
    const input = createSpreadsheet();
    const resizedCol = resizeSpreadsheetColumn(input, 0, 999);
    const resizedRow = resizeSpreadsheetRow(resizedCol, 0, 1);
    expect(resizedRow.columnWidths?.['0']).toBe(320);
    expect(resizedRow.rowHeights?.['0']).toBe(22);
  });
});

