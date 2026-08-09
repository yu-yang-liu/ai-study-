import Foundation

/// 安全数学表达式求值器（Phase 2 · 函数曲线采样）。
///
/// 语法子集：`+ - * / ^`（乘方右结合）、括号、变量 `x`、常量 `pi` / `e`、
/// 单参函数 `sqrt/sin/cos/tan/asin/acos/atan/abs/log(10)/ln/exp`、
/// 双参函数 `min/max`。隐式乘法不支持（请显式写 `2*x`）。
///
/// 不使用 `eval` / 任意字符串执行，仅白名单语法；非法表达式返回 `nil`。
public enum ExpressionEvaluator {
    /// 对表达式在 `x` 处求值；非法或非有限结果返回 `nil`。
    public static func evaluate(_ expr: String, x: Double) -> Double? {
        let trimmed = expr.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        if let constant = Double(trimmed) { return constant }
        guard let tokens = Self.tokenize(trimmed) else { return nil }
        guard tokens.isEmpty == false else { return nil }
        var parser = Parser(tokens: tokens, x: x)
        return parser.parse()
    }

    // MARK: - Tokenizer

    private enum Token: Equatable {
        case number(Double)
        case identifier(String)
        case op(Character)
        case lparen
        case rparen
        case comma
    }

    private static func tokenize(_ input: String) -> [Token]? {
        var tokens: [Token] = []
        var index = input.startIndex
        while index < input.endIndex {
            let char = input[index]
            if char == " " || char == "\t" || char == "\n" || char == "\r" {
                index = input.index(after: index)
                continue
            }
            if char.isNumber || char == "." {
                var end = input.index(after: index)
                while end < input.endIndex, input[end].isNumber || input[end] == "." {
                    end = input.index(after: end)
                }
                guard let value = Double(String(input[index..<end])) else { return nil }
                tokens.append(.number(value))
                index = end
                continue
            }
            if char.isLetter || char == "_" {
                var end = input.index(after: index)
                while end < input.endIndex, input[end].isLetter || input[end].isNumber || input[end] == "_" {
                    end = input.index(after: end)
                }
                tokens.append(.identifier(String(input[index..<end])))
                index = end
                continue
            }
            switch char {
            case "+", "-", "*", "/", "^":
                tokens.append(.op(char))
            case "(":
                tokens.append(.lparen)
            case ")":
                tokens.append(.rparen)
            case ",":
                tokens.append(.comma)
            default:
                return nil
            }
            index = input.index(after: index)
        }
        return tokens
    }

    // MARK: - Parser（递归下降）

    private struct Parser {
        let tokens: [Token]
        let x: Double
        var position = 0

        mutating func parse() -> Double? {
            guard let value = parseExpr(), position == tokens.count else { return nil }
            return value.isFinite ? value : nil
        }

        private mutating func peek() -> Token? {
            position < tokens.count ? tokens[position] : nil
        }

        private mutating func next() -> Token? {
            guard position < tokens.count else { return nil }
            defer { position += 1 }
            return tokens[position]
        }

        private mutating func expect(_ kind: Token) -> Bool {
            guard let token = next() else { return false }
            return token == kind
        }

        private mutating func parseExpr() -> Double? {
            guard var left = parseTerm() else { return nil }
            while let token = peek() {
                guard case .op(let op) = token, op == "+" || op == "-" else { break }
                _ = next()
                guard let right = parseTerm() else { return nil }
                left = op == "+" ? left + right : left - right
            }
            return left
        }

        private mutating func parseTerm() -> Double? {
            guard var left = parseUnary() else { return nil }
            while let token = peek() {
                guard case .op(let op) = token, op == "*" || op == "/" else { break }
                _ = next()
                guard let right = parseUnary() else { return nil }
                if op == "/" && right == 0 { return nil }
                left = op == "*" ? left * right : left / right
            }
            return left
        }

        /// 一元负号：`-2^2 = -(2^2)`（乘方优先于负号）。
        private mutating func parseUnary() -> Double? {
            if case .op(let op)? = peek(), op == "-" || op == "+" {
                _ = next()
                guard let value = parseUnary() else { return nil }
                return op == "-" ? -value : value
            }
            return parsePower()
        }

        private mutating func parsePower() -> Double? {
            guard let base = parsePrimary() else { return nil }
            if case .op("^")? = peek() {
                _ = next()
                guard let exponent = parseUnary() else { return nil }
                let result = pow(base, exponent)
                return result.isFinite ? result : nil
            }
            return base
        }

        private mutating func parsePrimary() -> Double? {
            guard let token = next() else { return nil }
            switch token {
            case .number(let value):
                return value
            case .lparen:
                guard let value = parseExpr(), expect(.rparen) else { return nil }
                return value
            case .identifier(let name):
                return parseIdentifier(name)
            case .op, .rparen, .comma:
                return nil
            }
        }

        private mutating func parseIdentifier(_ name: String) -> Double? {
            if name == "x" { return x }
            if name == "pi" { return Double.pi }
            if name == "e" { return M_E }
            guard case .lparen? = next() else { return nil }
            let arity = ExpressionEvaluator.functions[name]?.arity
            guard let arity else { return nil }
            var args: [Double] = []
            for index in 0..<arity {
                if index > 0 {
                    guard expect(.comma) else { return nil }
                }
                guard let argument = parseExpr() else { return nil }
                args.append(argument)
            }
            guard expect(.rparen), let eval = ExpressionEvaluator.functions[name]?.eval else { return nil }
            return eval(args)
        }
    }

    // MARK: - 函数表

    nonisolated(unsafe) private static let functions: [String: (arity: Int, eval: ([Double]) -> Double?)] = [
        "sqrt": (1, { $0[0] < 0 ? nil : $0[0].squareRoot() }),
        "sin": (1, { sin($0[0]) }),
        "cos": (1, { cos($0[0]) }),
        "tan": (1, { tan($0[0]) }),
        "asin": (1, { abs($0[0]) > 1 ? nil : asin($0[0]) }),
        "acos": (1, { abs($0[0]) > 1 ? nil : acos($0[0]) }),
        "atan": (1, { atan($0[0]) }),
        "abs": (1, { abs($0[0]) }),
        "log": (1, { $0[0] <= 0 ? nil : log10($0[0]) }),
        "ln": (1, { $0[0] <= 0 ? nil : log($0[0]) }),
        "exp": (1, { exp($0[0]) }),
        "min": (2, { Swift.min($0[0], $0[1]) }),
        "max": (2, { Swift.max($0[0], $0[1]) }),
    ]
}
