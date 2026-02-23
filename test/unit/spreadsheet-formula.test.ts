import { describe, expect, it } from 'vitest';
import { evaluateSpreadsheetCell } from '../../src/features/spreadsheet/spreadsheet-formula';

describe('spreadsheet-formula', () => {
  it('evaluates arithmetic cell formulas', () => {
    const cells = {
      A1: { raw: '2' },
      A2: { raw: '3' },
      A3: { raw: '=A1*A2+4' },
    };

    expect(evaluateSpreadsheetCell('A3', cells)).toBe('10');
  });

  it('supports SUM and AVG on ranges', () => {
    const cells = {
      A1: { raw: '2' },
      A2: { raw: '4' },
      A3: { raw: '6' },
      B1: { raw: '=SUM(A1:A3)' },
      B2: { raw: '=AVG(A1:A3)' },
    };

    expect(evaluateSpreadsheetCell('B1', cells)).toBe('12');
    expect(evaluateSpreadsheetCell('B2', cells)).toBe('4');
  });

  it('returns cycle error for circular references', () => {
    const cells = {
      A1: { raw: '=B1' },
      B1: { raw: '=A1' },
    };

    expect(evaluateSpreadsheetCell('A1', cells)).toBe('#CYCLE!');
    expect(evaluateSpreadsheetCell('B1', cells)).toBe('#CYCLE!');
  });

  it('returns division by zero error', () => {
    const cells = {
      A1: { raw: '=10/0' },
    };

    expect(evaluateSpreadsheetCell('A1', cells)).toBe('#DIV/0!');
  });

  it('returns parse error for unsupported formulas', () => {
    const cells = {
      A1: { raw: '=UNKNOWN(1)' },
    };

    expect(evaluateSpreadsheetCell('A1', cells)).toBe('#ERROR!');
  });
});

