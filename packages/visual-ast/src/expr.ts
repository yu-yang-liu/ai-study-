/**
 * 安全数学表达式求值器（初等函数子集）。
 *
 * 目的：为 functionCurve 提供确定性采样，绝不使用 eval / Function。
 * 语法：+ - * / ^（右结合）、括号、数字、变量 x、常量 pi/e、
 * 单参函数 sqrt/sin/cos/tan/asin/acos/atan/abs/log(10)/ln/exp、
 * 双参函数 min/max。隐式乘法不支持，请显式写 `2*x`。
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "op"; op: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

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

/**
 * 对表达式求值。expr 非法或结果非有限时返回 null。
 * 输入为数字或数字字符串时原样返回（允许直接把 functionCurve.expr 写成常量）。
 */
export function evaluateExpression(expr: string, x: number): number | null {
  const trimmed = expr.trim();
  if (trimmed === "") return null;
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
  function peek(): Token | undefined {
    return tokens[pos];
  }
  function next(): Token | undefined {
    return tokens[pos++];
  }
  function expect(kind: Token["kind"], what?: string): Token | undefined {
    const t = next();
    if (!t || t.kind !== kind) throw new Error(`expected ${what ?? kind}`);
    return t;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek()?.kind === "op" && (peek() as { op: string }).op === "+" || peek()?.kind === "op" && (peek() as { op: string }).op === "-") {
      const op = (next() as { op: string }).op;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseUnary();
    if (left === null) return null;
    while (peek()?.kind === "op" && ((peek() as { op: string }).op === "*" || (peek() as { op: string }).op === "/")) {
      const op = (next() as { op: string }).op;
      const right = parseUnary();
      if (right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseUnary(): number | null {
    if (peek()?.kind === "op" && (peek() as { op: string }).op === "-") {
      next();
      const v = parseUnary();
      return v === null ? null : -v;
    }
    if (peek()?.kind === "op" && (peek() as { op: string }).op === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): number | null {
    const base = parsePrimary();
    if (base === null) return null;
    if (peek()?.kind === "op" && (peek() as { op: string }).op === "^") {
      next();
      const exp = parseUnary();
      if (exp === null) return null;
      const pow = Math.pow(base, exp);
      return Number.isFinite(pow) ? pow : null;
    }
    return base;
  }

  function parsePrimary(): number | null {
    const t = peek();
    if (!t) throw new Error("unexpected end");
    if (t.kind === "num") {
      next();
      return t.value;
    }
    if (t.kind === "lparen") {
      next();
      const v = parseExpr();
      expect("rparen", ")");
      return v;
    }
    if (t.kind === "ident") {
      next();
      if (t.name === "x") return x;
      if (t.name in CONSTANTS) return CONSTANTS[t.name];
      const fn = FUNCTIONS[t.name];
      if (!fn) throw new Error(`unknown identifier: ${t.name}`);
      expect("lparen", "(");
      const args: number[] = [];
      for (let i = 0; i < fn.arity; i++) {
        if (i > 0) expect("comma", ",");
        const v = parseExpr();
        if (v === null) return null;
        args.push(v);
      }
      expect("rparen", ")");
      return fn.fn(...args);
    }
    throw new Error("unexpected token");
  }

  try {
    const result = parseExpr();
    if (pos !== tokens.length) throw new Error("trailing tokens");
    return result !== null && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch >= "0" && ch <= "9" || ch === ".") {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const raw = input.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`bad number: ${raw}`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++;
      tokens.push({ kind: "ident", name: input.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    throw new Error(`unexpected char: ${ch}`);
  }
  return tokens;
}
