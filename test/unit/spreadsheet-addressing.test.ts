import { describe, expect, it } from 'vitest';
import {
  columnIndexToLabel,
  columnLabelToIndex,
  expandCellRange,
  getCellRangeBounds,
  isCellWithinBounds,
  parseCellKey,
  toCellKey,
} from '../../src/features/spreadsheet/spreadsheet-addressing';

describe('spreadsheet-addressing', () => {
  it('converts column labels and indexes in both directions', () => {
    expect(columnLabelToIndex('A')).toBe(0);
    expect(columnLabelToIndex('Z')).toBe(25);
    expect(columnLabelToIndex('AA')).toBe(26);
    expect(columnIndexToLabel(0)).toBe('A');
    expect(columnIndexToLabel(25)).toBe('Z');
    expect(columnIndexToLabel(26)).toBe('AA');
  });

  it('parses and formats cell keys', () => {
    expect(parseCellKey('C12')).toEqual({ columnIndex: 2, rowIndex: 11 });
    expect(toCellKey(2, 11)).toBe('C12');
  });

  it('expands ranges inclusively', () => {
    expect(expandCellRange('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('computes range bounds and checks membership', () => {
    const bounds = getCellRangeBounds('C3', 'A1');
    expect(bounds).toEqual({
      minColumnIndex: 0,
      maxColumnIndex: 2,
      minRowIndex: 0,
      maxRowIndex: 2,
    });
    expect(isCellWithinBounds(1, 1, bounds)).toBe(true);
    expect(isCellWithinBounds(4, 1, bounds)).toBe(false);
  });
});
