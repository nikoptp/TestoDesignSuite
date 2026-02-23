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

type EvalErrorCode = '#ERROR!' | '#DIV/0!' | '#REF!' | '#VALUE!' | '#CYCLE!' | '#NAME?' | '#N/A';

type EvalResult =
  | { ok: true; value: number }
  | { ok: false; code: EvalErrorCode };

const CELL_REFERENCE_REGEX = /^\$?[A-Z]+\$?[1-9]\d*$/;

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isLetter = (char: string): boolean => char.toLowerCase() !== char.toUpperCase();

const normalizeFormulaCellReference = (value: string): string => value.replace(/\$/g, '').toUpperCase();

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

    if (char === '$' || isLetter(char)) {
      const remaining = expression.slice(index);
      const cellMatch = remaining.match(/^\$?[A-Za-z]+\$?[1-9]\d*/);
      if (cellMatch && CELL_REFERENCE_REGEX.test(cellMatch[0].toUpperCase())) {
        tokens.push({
          kind: 'cell',
          value: normalizeFormulaCellReference(cellMatch[0]),
        });
        index += cellMatch[0].length;
        continue;
      }
      if (char === '$') {
        return null;
      }

      let end = index + 1;
      while (
        end < expression.length &&
        (isLetter(expression[end]) || isDigit(expression[end]) || expression[end] === '_')
      ) {
        end += 1;
      }
      tokens.push({
        kind: 'identifier',
        value: expression.slice(index, end).toUpperCase(),
      });
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
    if (
      trimmed === '#DIV/0!' ||
      trimmed === '#CYCLE!' ||
      trimmed === '#N/A' ||
      trimmed === '#NAME?' ||
      trimmed === '#REF!'
    ) {
      return { ok: false, code: trimmed as EvalErrorCode };
    }
    return { ok: false, code: '#ERROR!' };
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
  evaluateCellDisplay: (cellKey: string) => string,
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
    const inner = evaluateAst(ast.value, cells, evaluateCellNumeric, evaluateCellDisplay);
    if (!inner.ok) {
      return inner;
    }
    return {
      ok: true,
      value: ast.operator === '+' ? inner.value : -inner.value,
    };
  }
  if (ast.kind === 'binary') {
    const left = evaluateAst(ast.left, cells, evaluateCellNumeric, evaluateCellDisplay);
    if (!left.ok) {
      return left;
    }
    const right = evaluateAst(ast.right, cells, evaluateCellNumeric, evaluateCellDisplay);
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
    const supportedFunctions = new Set(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'ROUND', 'ABS', 'IF']);
    if (!supportedFunctions.has(normalizedName)) {
      return { ok: false, code: '#NAME?' };
    }

    const evaluateNodeAsDisplay = (node: AstNode): { ok: true; display: string } | { ok: false; code: EvalErrorCode } => {
      if (node.kind === 'range') {
        return { ok: false, code: '#ERROR!' };
      }
      if (node.kind === 'cell') {
        return { ok: true, display: evaluateCellDisplay(node.key) };
      }
      const evaluated = evaluateAst(node, cells, evaluateCellNumeric, evaluateCellDisplay);
      if (!evaluated.ok) {
        return evaluated;
      }
      return { ok: true, display: numberToDisplay(evaluated.value) };
    };

    const collectArgumentDisplays = (node: AstNode): { ok: true; values: string[] } | { ok: false; code: EvalErrorCode } => {
      if (node.kind === 'range') {
        const keys = expandCellRange(node.from, node.to);
        if (keys.length === 0) {
          return { ok: false, code: '#REF!' };
        }
        return {
          ok: true,
          values: keys.map((key) => evaluateCellDisplay(key)),
        };
      }

      const display = evaluateNodeAsDisplay(node);
      if (!display.ok) {
        return display;
      }
      return { ok: true, values: [display.display] };
    };

    if (normalizedName === 'IF') {
      if (ast.args.length < 2 || ast.args.length > 3) {
        return { ok: false, code: '#N/A' };
      }
      const condition = evaluateAst(ast.args[0], cells, evaluateCellNumeric, evaluateCellDisplay);
      if (!condition.ok) {
        return condition;
      }
      const branch = condition.value !== 0 ? ast.args[1] : ast.args[2];
      if (!branch) {
        return { ok: false, code: '#N/A' };
      }
      return evaluateAst(branch, cells, evaluateCellNumeric, evaluateCellDisplay);
    }

    const displays: string[] = [];
    for (const arg of ast.args) {
      const evaluated = collectArgumentDisplays(arg);
      if (!evaluated.ok) {
        return evaluated;
      }
      displays.push(...evaluated.values);
    }

    if (normalizedName === 'COUNTA') {
      const count = displays.filter((display) => display.trim().length > 0).length;
      return { ok: true, value: count };
    }

    if (normalizedName === 'COUNT') {
      const count = displays.reduce((sum, display) => {
        if (!display.trim()) {
          return sum;
        }
        const numeric = toNumericCellValue(display);
        return numeric.ok ? sum + 1 : sum;
      }, 0);
      return { ok: true, value: count };
    }

    const numericValues: number[] = [];
    for (const display of displays) {
      const numeric = toNumericCellValue(display);
      if (!numeric.ok) {
        return numeric;
      }
      numericValues.push(numeric.value);
    }

    if (normalizedName === 'SUM') {
      return { ok: true, value: numericValues.reduce((sum, value) => sum + value, 0) };
    }
    if (normalizedName === 'AVG') {
      if (numericValues.length === 0) {
        return { ok: false, code: '#DIV/0!' };
      }
      return {
        ok: true,
        value: numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
      };
    }
    if (normalizedName === 'MIN') {
      if (numericValues.length === 0) {
        return { ok: false, code: '#N/A' };
      }
      return { ok: true, value: Math.min(...numericValues) };
    }
    if (normalizedName === 'MAX') {
      if (numericValues.length === 0) {
        return { ok: false, code: '#N/A' };
      }
      return { ok: true, value: Math.max(...numericValues) };
    }
    if (normalizedName === 'ABS') {
      if (numericValues.length !== 1) {
        return { ok: false, code: '#N/A' };
      }
      return { ok: true, value: Math.abs(numericValues[0]) };
    }
    if (normalizedName === 'ROUND') {
      if (numericValues.length < 1 || numericValues.length > 2) {
        return { ok: false, code: '#N/A' };
      }
      const decimals = numericValues.length === 1 ? 0 : Math.trunc(numericValues[1]);
      const factor = 10 ** Math.abs(decimals);
      if (decimals >= 0) {
        return { ok: true, value: Math.round(numericValues[0] * factor) / factor };
      }
      return { ok: true, value: Math.round(numericValues[0] / factor) * factor };
    }
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
  const normalizedKey = normalizeFormulaCellReference(cellKey.trim());
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
  const evaluateCellDisplay = (targetKey: string): string =>
    evaluateSpreadsheetCell(targetKey, cells, cache, stack);

  const evaluateCellNumeric = (targetKey: string): EvalResult => {
    if (!isSpreadsheetCellKey(targetKey)) {
      return { ok: false, code: '#REF!' };
    }
    const display = evaluateCellDisplay(targetKey);
    return toNumericCellValue(display);
  };
  const result = evaluateAst(ast, cells, evaluateCellNumeric, evaluateCellDisplay);
  stack.delete(normalizedKey);

  const display = result.ok ? numberToDisplay(result.value) : result.code;
  cache.set(normalizedKey, display);
  return display;
};
