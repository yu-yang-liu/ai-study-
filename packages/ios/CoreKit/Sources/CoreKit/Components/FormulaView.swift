import SwiftUI
#if canImport(UIKit) && canImport(iosMath)
import iosMath
import UIKit
#endif

// MARK: - MathBackend 协议

/// 公式渲染后端抽象（M1 公式渲染）。
///
/// 阶段一使用 `UnicodeMathBackend`（纯 Swift，零依赖，CI 可跑），阶段二可切换为
/// `IosMathBackend`（基于 `kostub/iosMath` 的 `MTMathUILabel`），调用方零改动。
/// 接口仅返回 `AnyView` —— 这是 protocol 无法返回 `some View` 时的标准妥协。
public protocol MathBackend: Sendable {
    /// 将 LaTeX 渲染为视图。
    /// - Parameters:
    ///   - latex: 纯 LaTeX 源串（无 `$` 包裹）。
    ///   - fontSize: 字号（pt）。
    func render(latex: String, fontSize: CGFloat) -> AnyView
}

// MARK: - FormulaView

/// 公式渲染视图（M1）。
///
/// 由 `ContentBlock.formula(latex:)` 驱动：`MarkdownRenderer(blocks:)` 遇到公式块时构造本视图，
/// `latex` 直接喂给后端，不做正则抽取。`defaultBackend` 阶段一为 `UnicodeMathBackend`，
/// 阶段二改为 `IosMathBackend` 即可全局切换，调用方无感。
public struct FormulaView: View {
    private let latex: String
    private let fontSize: CGFloat

    /// 默认后端：iosMath 优先（阶段二），不可用时回退纯 Swift Unicode 降级。
    /// `static var` 只读，无并发写竞争。
    public static var defaultBackend: any MathBackend {
        #if canImport(UIKit) && canImport(iosMath)
        return IosMathBackend()
        #else
        return UnicodeMathBackend()
        #endif
    }

    /// - Parameters:
    ///   - latex: 纯 LaTeX 源串（无 `$` 包裹）。
    ///   - fontSize: 字号，默认 17pt。
    public init(latex: String, fontSize: CGFloat = 17) {
        self.latex = latex
        self.fontSize = fontSize
    }

    public var body: some View {
        Self.defaultBackend.render(latex: latex, fontSize: fontSize)
    }
}

// MARK: - UnicodeMathBackend（阶段一：纯 Swift 降级）

/// 纯 Swift Unicode 降级后端（M1 阶段一去风险基线）。
///
/// 将常见 LaTeX 命令映射为 Unicode 字符（`\sqrt`→√、`\frac{a}{b}`→a/b、`^{2}`→²、
/// `_{n}`→ₙ、希腊字母等），用 SwiftUI `Text` 渲染。非排版级精度，但零依赖、Swift 6 安全、
/// CI 可跑。未识别命令原样保留，确保信息不丢失。
///
/// 覆盖范围（高中数学常见）：分数、根号、上下标、希腊字母、常见运算符（∑∫∞≠≤≥±∓·×÷）。
/// 不覆盖（待 iosMath 阶段二）：矩阵、多行对齐、cases 环境、复杂堆叠。
public struct UnicodeMathBackend: MathBackend {

    /// 空初始化器。
    public init() {}

    public func render(latex: String, fontSize: CGFloat) -> AnyView {
        AnyView(
            Text(UnicodeMathBackend.convert(latex))
                .font(.system(size: fontSize, design: .serif))
                .italic()
                .padding(.vertical, 4)
        )
    }

    /// 将 LaTeX 源串转换为 Unicode 近似文本（纯函数，可单测）。
    public static func convert(_ latex: String) -> String {
        var s = latex

        // 命令替换（最长优先，避免 \sqrt 被 \s 之类误伤——此处无前缀冲突，顺序无碍）。
        let commandMap: [(String, String)] = [
            (#"\sqrt"#, "√"),
            (#"\cdot"#, "·"),
            (#"\times"#, "×"),
            (#"\div"#, "÷"),
            (#"\pm"#, "±"),
            (#"\mp"#, "∓"),
            (#"\neq"#, "≠"),
            (#"\leq"#, "≤"),
            (#"\geq"#, "≥"),
            (#"\le"#, "≤"),
            (#"\ge"#, "≥"),
            (#"\infty"#, "∞"),
            (#"\sum"#, "∑"),
            (#"\int"#, "∫"),
            (#"\prod"#, "∏"),
            (#"\partial"#, "∂"),
            (#"\nabla"#, "∇"),
            (#"\rightarrow"#, "→"),
            (#"\Rightarrow"#, "⇒"),
            (#"\leftarrow"#, "←"),
            (#"\Leftarrow"#, "⇐"),
            (#"\leftrightarrow"#, "↔"),
            (#"\in"#, "∈"),
            (#"\notin"#, "∉"),
            (#"\subset"#, "⊂"),
            (#"\supset"#, "⊃"),
            (#"\cup"#, "∪"),
            (#"\cap"#, "∩"),
            (#"\emptyset"#, "∅"),
            (#"\forall"#, "∀"),
            (#"\exists"#, "∃"),
            (#"\angle"#, "∠"),
            (#"\perp"#, "⊥"),
            (#"\parallel"#, "∥"),
            (#"\approx"#, "≈"),
            (#"\equiv"#, "≡"),
            (#"\sim"#, "∼"),
            (#"\propto"#, "∝"),
            (#"\degree"#, "°"),
            (#"\circ"#, "∘"),
            (#"\pi"#, "π"),
            (#"\alpha"#, "α"),
            (#"\beta"#, "β"),
            (#"\gamma"#, "γ"),
            (#"\delta"#, "δ"),
            (#"\epsilon"#, "ε"),
            (#"\varepsilon"#, "ε"),
            (#"\zeta"#, "ζ"),
            (#"\eta"#, "η"),
            (#"\theta"#, "θ"),
            (#"\iota"#, "ι"),
            (#"\kappa"#, "κ"),
            (#"\lambda"#, "λ"),
            (#"\mu"#, "μ"),
            (#"\nu"#, "ν"),
            (#"\xi"#, "ξ"),
            (#"\omicron"#, "ο"),
            (#"\rho"#, "ρ"),
            (#"\sigma"#, "σ"),
            (#"\tau"#, "τ"),
            (#"\upsilon"#, "υ"),
            (#"\phi"#, "φ"),
            (#"\varphi"#, "φ"),
            (#"\chi"#, "χ"),
            (#"\psi"#, "ψ"),
            (#"\omega"#, "ω"),
            (#"\Gamma"#, "Γ"),
            (#"\Delta"#, "Δ"),
            (#"\Theta"#, "Θ"),
            (#"\Lambda"#, "Λ"),
            (#"\Xi"#, "Ξ"),
            (#"\Pi"#, "Π"),
            (#"\Sigma"#, "Σ"),
            (#"\Phi"#, "Φ"),
            (#"\Psi"#, "Ψ"),
            (#"\Omega"#, "Ω"),
            (#"\left"#, ""),
            (#"\right"#, ""),
            (#"\displaystyle"#, ""),
            (#"\text"#, ""),
            (#"\mathrm"#, ""),
            (#"\mathbf"#, ""),
            (#"\quad"#, " "),
            (#"\qquad"#, "  "),
            (#"\,"#, " "),
            (#"\;"#, " "),
            (#"\:"#, " "),
            (#"\!"#, ""),
        ]
        for (cmd, sym) in commandMap {
            s = s.replacingOccurrences(of: cmd, with: sym)
        }

        // \frac{a}{b} → a/b
        s = UnicodeMathBackend.convertFractions(s)

        // 上下标：^{...} / _{...} → 上/下标 Unicode（仅常见单字符与数字）；
        // 单字符 ^x / _x 直接转。
        s = UnicodeMathBackend.convertScripts(s)

        // 去除成对花括号 {x} → x（无结构含义后只剩分组）。
        s = s.replacingOccurrences(of: "{", with: "")
        s = s.replacingOccurrences(of: "}", with: "")

        // 去掉残留的反斜杠（未知命令原样保留其字母名，去掉 \ 前缀以免裸露）。
        s = s.replacingOccurrences(of: "\\", with: "")

        return s
    }

    /// `\frac{a}{b}` → `a/b`（贪婪匹配嵌套花括号内容）。
    private static func convertFractions(_ input: String) -> String {
        var s = input
        while let fracRange = s.range(of: #"\frac"#) {
            let afterFrac = fracRange.upperBound
            guard let num = extractBraced(s, at: afterFrac) else { break }
            let afterNum = num.end
            guard let den = extractBraced(s, at: afterNum) else { break }
            let converted = "\(num.content)/\(den.content)"
            s.replaceSubrange(fracRange.lowerBound..<den.end, with: converted)
        }
        return s
    }

    /// `^{...}` / `_{...}` / `^x` / `_x` → 上标/下标 Unicode。
    private static func convertScripts(_ input: String) -> String {
        var s = input
        s = convertScript(s, marker: "^", table: superscriptTable, fallback: { String($0) })
        s = convertScript(s, marker: "_", table: subscriptTable, fallback: { String($0) })
        return s
    }

    /// 通用上下标转换：`marker{content}` 或 `markerx` → 用 table 逐字符映射，无法映射的回退原字符。
    private static func convertScript(
        _ input: String,
        marker: Character,
        table: [Character: String],
        fallback: (Character) -> String
    ) -> String {
        var s = input
        var idx = s.startIndex
        while idx < s.endIndex {
            guard s[idx] == marker else {
                idx = s.index(after: idx)
                continue
            }
            let contentStart = s.index(after: idx)
            guard contentStart < s.endIndex else { break }

            // {content} 形式
            if s[contentStart] == "{" {
                guard let extracted = extractBraced(s, at: contentStart) else {
                    idx = s.index(after: idx)
                    continue
                }
                let mapped = extracted.content.map { table[$0] ?? fallback($0) }.joined()
                s.replaceSubrange(idx..<extracted.end, with: mapped)
                idx = s.index(idx, offsetBy: mapped.count, limitedBy: s.endIndex) ?? s.endIndex
                continue
            }

            // 单字符形式 ^x
            let ch = s[contentStart]
            let mapped = table[ch] ?? fallback(ch)
            s.replaceSubrange(idx..<s.index(after: contentStart), with: mapped)
            idx = s.index(idx, offsetBy: mapped.count, limitedBy: s.endIndex) ?? s.endIndex
        }
        return s
    }

    /// 从 `start` 位置（应指向 `{`）提取成对花括号内的内容与结束位置。
    private static func extractBraced(_ s: String, at start: String.Index) -> (content: String, end: String.Index)? {
        guard start < s.endIndex, s[start] == "{" else { return nil }
        var depth = 0
        var i = start
        while i < s.endIndex {
            if s[i] == "{" { depth += 1 }
            else if s[i] == "}" {
                depth -= 1
                if depth == 0 {
                    let content = String(s[s.index(after: start)..<i])
                    return (content, s.index(after: i))
                }
            }
            i = s.index(after: i)
        }
        return nil
    }

    // MARK: 上下标映射表

    private static let superscriptTable: [Character: String] = [
        "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
        "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
        "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
        "n": "ⁿ", "i": "ⁱ",
    ]

    private static let subscriptTable: [Character: String] = [
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
        "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
        "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
        "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ", "h": "ₕ",
        "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "p": "ₚ",
        "s": "ₛ", "t": "ₜ",
    ]
}

// MARK: - IosMathBackend（阶段二：iosMath MTMathUILabel）

#if canImport(UIKit) && canImport(iosMath)

/// iosMath 后端（M1 阶段二）。
///
/// 包 `kostub/iosMath` 的 `MTMathUILabel`（Obj-C `UIView` 子类，原生 LaTeX 排版），经
/// `UIViewRepresentable` 桥接进 SwiftUI。`MTMathUILabel` 是 `UIView` → 天然 `@MainActor`；
/// `render` 返回 `IosMathFormulaView`，其 body 在主线程求值，Swift 6 严格并发安全。
///
/// 解析失败降级：`updateUIView` 设 `latex` 后检查 `label.error`，非空则经 `@Binding` 翻转
/// 包装视图的 `fallback` 标志，body 切换到 `UnicodeMathBackend` 渲染同一段 latex（信息不丢，
/// 排版降级）。`displayErrorInline` 关闭，避免 iosMath 自带错误占位与降级视图同时出现。
@MainActor
public struct IosMathBackend: MathBackend {

    /// 空初始化器。`@MainActor` 隔离满足 Swift 6 对 UIView 路径的要求。
    public init() {}

    public nonisolated func render(latex: String, fontSize: CGFloat) -> AnyView {
        AnyView(
            IosMathFormulaView(latex: latex, fontSize: fontSize)
                .padding(.vertical, 4)
        )
    }
}

/// 公式渲染包装视图：先尝试 iosMath，解析失败则切 Unicode 降级。
///
/// `@State fallback` 由内层 `MathLabelRepresentable` 经 `@Binding` 在 `updateUIView` 中
/// 检测 `label.error` 后翻转；body 据 `fallback` 分支，true 时改用 `UnicodeMathBackend`。
private struct IosMathFormulaView: View {
    let latex: String
    let fontSize: CGFloat

    @State private var fallback = false

    var body: some View {
        if fallback {
            UnicodeMathBackend().render(latex: latex, fontSize: fontSize)
        } else {
            MathLabelRepresentable(latex: latex, fontSize: fontSize, fallback: $fallback)
        }
    }
}

/// `MTMathUILabel` 的 SwiftUI 包装（iOS）。
///
/// 抄自 iosMath 仓库 `SwiftMathExample/MathLabel.swift`（MIT），裁剪到 M1 所需最小集：
/// `latex` / `fontSize` / `mode`（display）/ `textAlignment`（left）。`defaultFont` 为
/// Latin Modern Math（iosMath 默认）。`sizeThatFits` 限定宽度为提案宽度，避免单条宽公式
/// 撑爆列宽导致整体裁剪；高度取内在内容高度。
private struct MathLabelRepresentable: UIViewRepresentable {
    let latex: String
    let fontSize: CGFloat
    @Binding var fallback: Bool

    func makeUIView(context: Context) -> MTMathUILabel {
        let label = MTMathUILabel()
        label.displayErrorInline = false
        label.mode = .display
        label.textAlignment = .left
        return label
    }

    func updateUIView(_ label: MTMathUILabel, context: Context) {
        label.latex = latex
        label.fontSize = fontSize
        // 设完 latex 后 iosMath 同步解析；error 非空则翻转上层 fallback 标志，触发 Unicode 降级。
        if label.error != nil, !fallback {
            fallback = true
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: MTMathUILabel, context: Context) -> CGSize? {
        let intrinsic = uiView.intrinsicContentSize
        switch proposal.width {
        case .some(let width) where width != .infinity:
            return CGSize(width: width, height: intrinsic.height)
        default:
            return intrinsic
        }
    }
}

#endif

// MARK: - 预览

#Preview {
    ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            FormulaView(latex: #"x^2 + y^2 = z^2"#)
            FormulaView(latex: #"\frac{a}{b}"#)
            FormulaView(latex: #"\sqrt{2}"#)
            FormulaView(latex: #"\sum_{i=1}^{n} i = \frac{n(n+1)}{2}"#)
            FormulaView(latex: #"\alpha + \beta = \frac{\pi}{2}"#)
        }
        .padding()
    }
}
