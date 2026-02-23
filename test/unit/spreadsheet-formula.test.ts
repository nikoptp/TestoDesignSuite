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

  it('supports COUNT and COUNTA over ranges', () => {
    const cells = {
      A1: { raw: '2' },
      A2: { raw: 'hello' },
      A3: { raw: '' },
      A4: { raw: '=1+2' },
      B1: { raw: '=COUNT(A1:A4)' },
      B2: { raw: '=COUNTA(A1:A4)' },
    };

    expect(evaluateSpreadsheetCell('B1', cells)).toBe('2');
    expect(evaluateSpreadsheetCell('B2', cells)).toBe('3');
  });

  it('supports IF, ROUND and ABS functions', () => {
    const cells = {
      A1: { raw: '-2.345' },
      A2: { raw: '=ABS(A1)' },
      A3: { raw: '=ROUND(A2,2)' },
      A5: { raw: '=IF(A3,10,5)' },
    };

    expect(evaluateSpreadsheetCell('A2', cells)).toBe('2.345');
    expect(evaluateSpreadsheetCell('A3', cells)).toBe('2.35');
    expect(evaluateSpreadsheetCell('A5', cells)).toBe('10');
  });

  it('supports absolute references', () => {
    const cells = {
      A1: { raw: '7' },
      B2: { raw: '3' },
      C1: { raw: '=$A$1 + $B2' },
    };

    expect(evaluateSpreadsheetCell('C1', cells)).toBe('10');
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

    expect(evaluateSpreadsheetCell('A1', cells)).toBe('#NAME?');
  });

  it('returns #N/A for wrong function arity', () => {
    const cells = {
      A1: { raw: '=ABS(1,2)' },
    };

    expect(evaluateSpreadsheetCell('A1', cells)).toBe('#N/A');
  });
});
