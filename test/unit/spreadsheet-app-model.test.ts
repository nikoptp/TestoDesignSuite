import { describe, expect, it } from 'vitest';
import type { PersistedTreeState } from '../../src/shared/types';
import {
  ensureSpreadsheetData,
  getSpreadsheetForNode,
} from '../../src/features/app/app-model';

const createBaseState = (): PersistedTreeState => ({
  nodes: [
    {
      id: 'node-sheet',
      name: 'Sheet Node',
      editorType: 'spreadsheet',
      children: [],
    },
  ],
  selectedNodeId: 'node-sheet',
  nextNodeNumber: 2,
  nodeDataById: {},
});

describe('spreadsheet app-model helpers', () => {
  it('returns default spreadsheet payload when missing', () => {
    const spreadsheet = getSpreadsheetForNode(createBaseState(), 'node-sheet');
    expect(spreadsheet.rowCount).toBe(50);
    expect(spreadsheet.columnCount).toBe(26);
    expect(spreadsheet.activeCellKey).toBe('A1');
  });

  it('normalizes malformed spreadsheet payload', () => {
    const state: PersistedTreeState = {
      ...createBaseState(),
      nodeDataById: {
        'node-sheet': {
          spreadsheet: {
            sheets: [
              {
                id: '',
                name: '',
                cells: {
                  bad: { raw: 'x' } as unknown as { raw: string },
                  a1: { raw: '1' } as unknown as { raw: string },
                } as unknown as Record<string, { raw: string }>,
              },
            ],
            activeSheetId: 'missing',
            activeCellKey: 'bad',
            rowCount: 0,
            columnCount: 500,
            rowHeights: {
              '-1': 10,
              '0': 999,
              '4': 44,
            },
            columnWidths: {
              '0': 30,
              '2': 999,
            },
          },
        },
      },
    };

    const ensured = ensureSpreadsheetData(state, 'node-sheet');
    const spreadsheet = getSpreadsheetForNode(ensured, 'node-sheet');

    expect(spreadsheet.sheets[0]?.id).toBe('sheet-1');
    expect(spreadsheet.sheets[0]?.name).toBe('Sheet 1');
    expect(spreadsheet.sheets[0]?.cells.A1?.raw).toBe('1');
    expect(spreadsheet.activeCellKey).toBe('A1');
    expect(spreadsheet.rowCount).toBe(1);
    expect(spreadsheet.columnCount).toBe(52);
    expect(spreadsheet.rowHeights?.['0']).toBe(120);
    expect(spreadsheet.rowHeights?.['4']).toBeUndefined();
    expect(spreadsheet.columnWidths?.['0']).toBe(72);
    expect(spreadsheet.columnWidths?.['2']).toBe(320);
  });
});
