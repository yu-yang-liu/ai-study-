/**
 * 安全数学表达式求值（eval 评分用）。
 *
 * 与 `packages/visual-ast/src/expr.ts` 保持一致（零依赖移植），
 * 供 functionCurve 表达式采样对比；不使用 eval / Function。
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'op'; op: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' };

const FUNCTIONS: Record<string, { arity: 1 | 2; fn: (...args: number[]) => number | null }> = {
  sqrt: { arity: 1, fn: (x) => (x < 0 ? null : Math.sqrt(x)) },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  asin: { arity: 1, fn: (x) => (Math.abs(x) > 1 ? null : Math.asin(x)) },
  acos: { arity: 1, fn: (x) => (Math.abs(x) > 1 ? null : Math.acos(x)) },
  atan: { arity: 1, fn: Math.atan },
  abs: { arity: 1, fn: Math.abs },
  log: { arity: 1, fn: (x) => (x <= 0 ? null : Math.log10(x)) },
  ln: { arity: 1, fn: (x) => (x <= 0 ? null : Math.log(x)) },
  exp: { arity: 1, fn: Math.exp },
  min: { arity: 2, fn: Math.min },
  max: { arity: 2, fn: Math.max },
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/** 对表达式在 x 处求值；非法或非有限结果返回 null。 */
export function evalExpr(expr: string, x: number): number | null {
  const trimmed = expr.trim();
  if (trimmed === '') return null;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch {
    return null;
  }
  if (tokens.length === 0) return null;

  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];
  const expect = (kind: Token['kind']): boolean => {
    const t = next();
    return t !== undefined && t.kind === kind;
  };

  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    for (;;) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.op !== '+' && t.op !== '-')) break;
      const op = (next() as { op: string }).op;
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    for (;;) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.op !== '*' && t.op !== '/')) break;
      const op = (next() as { op: string }).op;
      const right = parseUnary();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };

  const parseUnary = (): number | null => {
    const t = peek();
    if (t && t.kind === 'op' && (t.op === '-' || t.op === '+')) {
      next();
      const v = parseUnary();
      return v === null ? null : t.op === '-' ? -v : v;
    }
    return parsePower();
  };

  const parsePower = (): number | null => {
    const base = parsePrimary();
    if (base === null) return null;
    const t = peek();
    if (t && t.kind === 'op' && t.op === '^') {
      next();
      const exponent = parseUnary();
      if (exponent === null) return null;
      const result = Math.pow(base, exponent);
      return Number.isFinite(result) ? result : null;
    }
    return base;
  };

  const parsePrimary = (): number | null => {
    const t = next();
    if (!t) return null;
    if (t.kind === 'num') return t.value;
    if (t.kind === 'lparen') {
      const value = parseExpr();
      return expect('rparen') ? value : null;
    }
    if (t.kind === 'ident') {
      if (t.name === 'x') return x;
      const constant = CONSTANTS[t.name];
      if (constant !== undefined) return constant;
      const fn = FUNCTIONS[t.name];
      if (!fn || !expect('lparen')) return null;
      const args: number[] = [];
      for (let i = 0; i < fn.arity; i++) {
        if (i > 0 && !expect('comma')) return null;
        const value = parseExpr();
        if (value === null) return null;
        args.push(value);
      }
      return expect('rparen') ? fn.fn(...args) : null;
    }
    return null;
  };

  const result = parseExpr();
  if (result === null || pos !== tokens.length) return null;
  return Number.isFinite(result) ? result : null;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      const value = Number(input.slice(i, j));
      if (!Number.isFinite(value)) throw new Error(`bad number: ${input.slice(i, j)}`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j]!)) j++;
      tokens.push({ kind: 'ident', name: input.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ kind: 'op', op: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i++;
      continue;
    }
    throw new Error(`unexpected char: ${ch}`);
  }
  return tokens;
}
