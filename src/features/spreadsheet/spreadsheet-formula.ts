import {
  expandCellRange,
  isSpreadsheetCellKey,
} from './spreadsheet-addressing';

type SpreadsheetCellValue = {
  raw: string;
};

export type SpreadsheetCellMap = Record<string, SpreadsheetCellValue>;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'identifier'; value: string }
  | { kind: 'cell'; value: string }
  | { kind: 'plus' }
  | { kind: 'minus' }
  | { kind: 'multiply' }
  | { kind: 'divide' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'colon' };

type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'cell'; key: string }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: AstNode; right: AstNode }
  | { kind: 'unary'; operator: '+' | '-'; value: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] }
  | { kind: 'range'; from: string; to: string };

type EvalErrorCode = '#ERROR!' | '#DIV/0!' | '#REF!' | '#VALUE!' | '#CYCLE!';

type EvalResult =
  | { ok: true; value: number }
  | { ok: false; code: EvalErrorCode };

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isLetter = (char: string): boolean => char.toLowerCase() !== char.toUpperCase();

const tokenize = (expression: string): Token[] | null => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1;
      continue;
    }
    if (char === '+') {
      tokens.push({ kind: 'plus' });
      index += 1;
      continue;
    }
    if (char === '-') {
      tokens.push({ kind: 'minus' });
      index += 1;
      continue;
    }
    if (char === '*') {
      tokens.push({ kind: 'multiply' });
      index += 1;
      continue;
    }
    if (char === '/') {
      tokens.push({ kind: 'divide' });
      index += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ kind: 'lparen' });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'rparen' });
      index += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ kind: 'comma' });
      index += 1;
      continue;
    }
    if (char === ':') {
      tokens.push({ kind: 'colon' });
      index += 1;
      continue;
    }

    if (isDigit(char) || char === '.') {
      let end = index + 1;
      while (end < expression.length && (isDigit(expression[end]) || expression[end] === '.')) {
        end += 1;
      }
      const parsed = Number(expression.slice(index, end));
      if (!Number.isFinite(parsed)) {
        return null;
      }
      tokens.push({ kind: 'number', value: parsed });
      index = end;
      continue;
    }

    if (isLetter(char)) {
      let end = index + 1;
      while (end < expression.length && isLetter(expression[end])) {
        end += 1;
      }
      while (end < expression.length && isDigit(expression[end])) {
        end += 1;
      }
      const value = expression.slice(index, end).toUpperCase();
      if (isSpreadsheetCellKey(value)) {
        tokens.push({ kind: 'cell', value });
      } else {
        tokens.push({ kind: 'identifier', value });
      }
      index = end;
      continue;
    }

    return null;
  }

  return tokens;
};

const parseFormula = (tokens: Token[]): AstNode | null => {
  let cursor = 0;

  const peek = (): Token | null => tokens[cursor] ?? null;
  const consume = (): Token | null => {
    const token = tokens[cursor] ?? null;
    if (token) {
      cursor += 1;
    }
    return token;
  };

  const parsePrimary = (): AstNode | null => {
    const token = consume();
    if (!token) {
      return null;
    }

    if (token.kind === 'number') {
      return { kind: 'number', value: token.value };
    }
    if (token.kind === 'cell') {
      if (peek()?.kind === 'colon') {
        consume();
        const endToken = consume();
        if (!endToken || endToken.kind !== 'cell') {
          return null;
        }
        return {
          kind: 'range',
          from: token.value,
          to: endToken.value,
        };
      }
      return { kind: 'cell', key: token.value };
    }
    if (token.kind === 'identifier') {
      if (peek()?.kind !== 'lparen') {
        return null;
      }
      consume();
      const args: AstNode[] = [];
      if (peek()?.kind !== 'rparen') {
        let shouldContinue = true;
        while (shouldContinue) {
          const arg = parseExpression();
          if (!arg) {
            return null;
          }
          args.push(arg);
          if (peek()?.kind === 'comma') {
            consume();
          } else {
            shouldContinue = false;
          }
        }
      }

      if (peek()?.kind !== 'rparen') {
        return null;
      }
      consume();
      return { kind: 'call', name: token.value, args };
    }
    if (token.kind === 'lparen') {
      const value = parseExpression();
      if (!value || peek()?.kind !== 'rparen') {
        return null;
      }
      consume();
      return value;
    }

    return null;
  };

  const parseUnary = (): AstNode | null => {
    const token = peek();
    if (token?.kind === 'plus' || token?.kind === 'minus') {
      consume();
      const value = parseUnary();
      if (!value) {
        return null;
      }
      return {
        kind: 'unary',
        operator: token.kind === 'plus' ? '+' : '-',
        value,
      };
    }
    return parsePrimary();
  };

  const parseTerm = (): AstNode | null => {
    let left = parseUnary();
    if (!left) {
      return null;
    }

    while (peek()?.kind === 'multiply' || peek()?.kind === 'divide') {
      const operatorToken = consume();
      const right = parseUnary();
      if (!right || !operatorToken) {
        return null;
      }
      left = {
        kind: 'binary',
        operator: operatorToken.kind === 'multiply' ? '*' : '/',
        left,
        right,
      };
    }

    return left;
  };

  const parseExpression = (): AstNode | null => {
    let left = parseTerm();
    if (!left) {
      return null;
    }

    while (peek()?.kind === 'plus' || peek()?.kind === 'minus') {
      const operatorToken = consume();
      const right = parseTerm();
      if (!right || !operatorToken) {
        return null;
      }
      left = {
        kind: 'binary',
        operator: operatorToken.kind === 'plus' ? '+' : '-',
        left,
        right,
      };
    }

    return left;
  };

  const root = parseExpression();
  if (!root || cursor < tokens.length) {
    return null;
  }
  return root;
};

const toNumericCellValue = (display: string): EvalResult => {
  const trimmed = display.trim();
  if (!trimmed) {
    return { ok: true, value: 0 };
  }
  if (trimmed.startsWith('#')) {
    if (trimmed === '#DIV/0!') {
      return { ok: false, code: '#DIV/0!' };
    }
    if (trimmed === '#CYCLE!') {
      return { ok: false, code: '#CYCLE!' };
    }
    return { ok: false, code: '#REF!' };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, code: '#VALUE!' };
  }
  return { ok: true, value };
};

const numberToDisplay = (value: number): string => {
  if (Object.is(value, -0)) {
    return '0';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(10)));
};

const evaluateAst = (
  ast: AstNode,
  cells: SpreadsheetCellMap,
  evaluateCellNumeric: (cellKey: string) => EvalResult,
): EvalResult => {
  if (ast.kind === 'number') {
    return { ok: true, value: ast.value };
  }
  if (ast.kind === 'cell') {
    return evaluateCellNumeric(ast.key);
  }
  if (ast.kind === 'range') {
    return { ok: false, code: '#ERROR!' };
  }
  if (ast.kind === 'unary') {
    const inner = evaluateAst(ast.value, cells, evaluateCellNumeric);
    if (!inner.ok) {
      return inner;
    }
    return {
      ok: true,
      value: ast.operator === '+' ? inner.value : -inner.value,
    };
  }
  if (ast.kind === 'binary') {
    const left = evaluateAst(ast.left, cells, evaluateCellNumeric);
    if (!left.ok) {
      return left;
    }
    const right = evaluateAst(ast.right, cells, evaluateCellNumeric);
    if (!right.ok) {
      return right;
    }

    if (ast.operator === '+') {
      return { ok: true, value: left.value + right.value };
    }
    if (ast.operator === '-') {
      return { ok: true, value: left.value - right.value };
    }
    if (ast.operator === '*') {
      return { ok: true, value: left.value * right.value };
    }
    if (right.value === 0) {
      return { ok: false, code: '#DIV/0!' };
    }
    return { ok: true, value: left.value / right.value };
  }
  if (ast.kind === 'call') {
    const normalizedName = ast.name.toUpperCase();
    if (
      normalizedName !== 'SUM' &&
      normalizedName !== 'AVG' &&
      normalizedName !== 'MIN' &&
      normalizedName !== 'MAX'
    ) {
      return { ok: false, code: '#ERROR!' };
    }

    const values: number[] = [];
    for (const arg of ast.args) {
      if (arg.kind === 'range') {
        const keys = expandCellRange(arg.from, arg.to);
        if (keys.length === 0) {
          return { ok: false, code: '#REF!' };
        }
        for (const key of keys) {
          const evaluated = evaluateCellNumeric(key);
          if (!evaluated.ok) {
            return evaluated;
          }
          values.push(evaluated.value);
        }
        continue;
      }
      const evaluated = evaluateAst(arg, cells, evaluateCellNumeric);
      if (!evaluated.ok) {
        return evaluated;
      }
      values.push(evaluated.value);
    }

    if (values.length === 0) {
      return { ok: false, code: '#ERROR!' };
    }

    if (normalizedName === 'SUM') {
      return { ok: true, value: values.reduce((sum, value) => sum + value, 0) };
    }
    if (normalizedName === 'AVG') {
      return { ok: true, value: values.reduce((sum, value) => sum + value, 0) / values.length };
    }
    if (normalizedName === 'MIN') {
      return { ok: true, value: Math.min(...values) };
    }
    return { ok: true, value: Math.max(...values) };
  }

  return { ok: false, code: '#ERROR!' };
};

const getNormalizedCellRaw = (cells: SpreadsheetCellMap, cellKey: string): string => {
  const record = cells[cellKey];
  if (!record || typeof record.raw !== 'string') {
    return '';
  }
  return record.raw;
};

export const evaluateSpreadsheetCell = (
  cellKey: string,
  cells: SpreadsheetCellMap,
  cache: Map<string, string> = new Map<string, string>(),
  stack: Set<string> = new Set<string>(),
): string => {
  const normalizedKey = cellKey.trim().toUpperCase();
  const cached = cache.get(normalizedKey);
  if (cached !== undefined) {
    return cached;
  }

  if (stack.has(normalizedKey)) {
    return '#CYCLE!';
  }

  const raw = getNormalizedCellRaw(cells, normalizedKey);
  if (!raw.startsWith('=')) {
    cache.set(normalizedKey, raw);
    return raw;
  }

  const expression = raw.slice(1).trim();
  if (!expression) {
    cache.set(normalizedKey, '');
    return '';
  }

  const tokens = tokenize(expression);
  if (!tokens) {
    cache.set(normalizedKey, '#ERROR!');
    return '#ERROR!';
  }
  const ast = parseFormula(tokens);
  if (!ast) {
    cache.set(normalizedKey, '#ERROR!');
    return '#ERROR!';
  }

  stack.add(normalizedKey);
  const evaluateCellNumeric = (targetKey: string): EvalResult => {
    if (!isSpreadsheetCellKey(targetKey)) {
      return { ok: false, code: '#REF!' };
    }
    const display = evaluateSpreadsheetCell(targetKey, cells, cache, stack);
    return toNumericCellValue(display);
  };
  const result = evaluateAst(ast, cells, evaluateCellNumeric);
  stack.delete(normalizedKey);

  const display = result.ok ? numberToDisplay(result.value) : result.code;
  cache.set(normalizedKey, display);
  return display;
};
