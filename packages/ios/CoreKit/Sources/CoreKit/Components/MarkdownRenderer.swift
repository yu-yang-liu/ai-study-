import SwiftUI
import ApiContracts

// MARK: - Markdown 节点类型

enum MarkdownNode: Sendable {
    case heading(level: Int, text: String)
    case paragraph(text: String)
    case codeBlock(language: String?, code: String)
    case unorderedList(items: [String])
    case orderedList(items: [String])
    case blockquote(text: String)
    case divider
    case blankLine
}

// MARK: - Markdown 解析器

struct MarkdownParser {
    func parse(_ markdown: String) -> [MarkdownNode] {
        let lines = markdown.components(separatedBy: .newlines)
        var nodes: [MarkdownNode] = []
        var i = 0

        while i < lines.count {
            let line = lines[i]

            // 空行
            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                nodes.append(.blankLine)
                i += 1
                continue
            }

            // 代码块
            if line.hasPrefix("```") {
                let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var codeLines: [String] = []
                i += 1
                while i < lines.count && !lines[i].hasPrefix("```") {
                    codeLines.append(lines[i])
                    i += 1
                }
                i += 1 // 跳过结束 ```
                nodes.append(.codeBlock(language: language.isEmpty ? nil : language, code: codeLines.joined(separator: "\n")))
                continue
            }

            // 标题
            if let heading = parseHeading(line) {
                nodes.append(heading)
                i += 1
                continue
            }

            // 分隔线
            if line.range(of: #"^[-*_]{3,}$"#, options: .regularExpression) != nil {
                nodes.append(.divider)
                i += 1
                continue
            }

            // 块引用
            if line.hasPrefix("> ") {
                nodes.append(.blockquote(text: String(line.dropFirst(2))))
                i += 1
                continue
            }

            // 无序列表
            if line.range(of: #"^[\-\*\+] "#, options: .regularExpression) != nil {
                var items: [String] = []
                while i < lines.count,
                      lines[i].range(of: #"^[\-\*\+] "#, options: .regularExpression) != nil {
                    items.append(String(lines[i].dropFirst(2)))
                    i += 1
                }
                nodes.append(.unorderedList(items: items))
                continue
            }

            // 有序列表
            if line.range(of: #"^\d+\. "#, options: .regularExpression) != nil {
                var items: [String] = []
                while i < lines.count,
                      lines[i].range(of: #"^\d+\. "#, options: .regularExpression) != nil {
                    items.append(lines[i].replacingOccurrences(of: #"^\d+\. "#, with: "", options: .regularExpression))
                    i += 1
                }
                nodes.append(.orderedList(items: items))
                continue
            }

            // 普通段落（合并连续的段落行）
            var paragraphLines: [String] = [line]
            i += 1
            while i < lines.count,
                  !lines[i].trimmingCharacters(in: .whitespaces).isEmpty,
                  !isBlockStart(lines[i]) {
                paragraphLines.append(lines[i])
                i += 1
            }
            nodes.append(.paragraph(text: paragraphLines.joined(separator: "\n")))
        }

        return nodes
    }

    private func parseHeading(_ line: String) -> MarkdownNode? {
        if line.hasPrefix("###### ") {
            return .heading(level: 6, text: String(line.dropFirst(7)))
        } else if line.hasPrefix("##### ") {
            return .heading(level: 5, text: String(line.dropFirst(6)))
        } else if line.hasPrefix("#### ") {
            return .heading(level: 4, text: String(line.dropFirst(5)))
        } else if line.hasPrefix("### ") {
            return .heading(level: 3, text: String(line.dropFirst(4)))
        } else if line.hasPrefix("## ") {
            return .heading(level: 2, text: String(line.dropFirst(3)))
        } else if line.hasPrefix("# ") {
            return .heading(level: 1, text: String(line.dropFirst(2)))
        }
        return nil
    }

    private func isBlockStart(_ line: String) -> Bool {
        return line.hasPrefix("#") ||
               line.hasPrefix("```") ||
               line.hasPrefix("> ") ||
               line.range(of: #"^[\-\*\+] "#, options: .regularExpression) != nil ||
               line.range(of: #"^\d+\. "#, options: .regularExpression) != nil ||
               line.range(of: #"^[-*_]{3,}$"#, options: .regularExpression) != nil
    }
}

// MARK: - 内联样式解析 (AttributedString)

enum InlineToken {
    case text(String)
    case bold(String)
    case italic(String)
    case inlineCode(String)
    case link(text: String, url: String)
}

struct InlineParser {
    func parse(_ text: String) -> [InlineToken] {
        // 简化内联解析：按优先级处理 `code` > **bold** > *italic* > [link](url) > plain
        var tokens: [InlineToken] = []
        var remaining = text

        while !remaining.isEmpty {
            // 内联代码
            if let range = remaining.range(of: "`[^`]+`", options: .regularExpression) {
                if remaining.startIndex < range.lowerBound {
                    let before = String(remaining[remaining.startIndex..<range.lowerBound])
                    parseFormatted(before, into: &tokens)
                }
                let code = String(remaining[remaining.index(after: range.lowerBound)..<remaining.index(before: range.upperBound)])
                tokens.append(.inlineCode(code))
                remaining = String(remaining[range.upperBound...])
                continue
            }

            // 加粗 **...**
            if let range = remaining.range(of: #"\*\*([^*]+)\*\*"#, options: .regularExpression) {
                if remaining.startIndex < range.lowerBound {
                    let before = String(remaining[remaining.startIndex..<range.lowerBound])
                    parseFormatted(before, into: &tokens)
                }
                let boldText = String(remaining[remaining.index(range.lowerBound, offsetBy: 2)..<remaining.index(range.upperBound, offsetBy: -2)])
                tokens.append(.bold(boldText))
                remaining = String(remaining[range.upperBound...])
                continue
            }

            // 斜体 *...* (单星号，不匹配双星)
            if let range = remaining.range(of: #"(?<!\*)\*([^*\n]+)\*(?!\*)"#, options: .regularExpression) {
                if remaining.startIndex < range.lowerBound {
                    let before = String(remaining[remaining.startIndex..<range.lowerBound])
                    parseFormatted(before, into: &tokens)
                }
                let italicText = String(remaining[remaining.index(after: range.lowerBound)..<remaining.index(before: range.upperBound)])
                tokens.append(.italic(italicText))
                remaining = String(remaining[range.upperBound...])
                continue
            }

            // 链接 [text](url)
            if let range = remaining.range(of: #"\[([^\]]+)\]\(([^)]+)\)"#, options: .regularExpression) {
                if remaining.startIndex < range.lowerBound {
                    let before = String(remaining[remaining.startIndex..<range.lowerBound])
                    parseFormatted(before, into: &tokens)
                }
                if let match = remaining[range].wholeMatch(of: try! Regex(#"\[([^\]]+)\]\(([^)]+)\)"#)) {
                    let text = String(match[1].substring!)
                    let url = String(match[2].substring!)
                    tokens.append(.link(text: text, url: url))
                }
                remaining = String(remaining[range.upperBound...])
                continue
            }

            // Plain text
            tokens.append(.text(remaining))
            break
        }

        return tokens
    }

    private func parseFormatted(_ text: String, into tokens: inout [InlineToken]) {
        tokens.append(contentsOf: parse(text))
    }
}

// MARK: - SwiftUI 原生 Markdown 渲染视图

public struct MarkdownRenderer: View {
    private let markdown: String?
    private let blocks: [ContentBlock]?

    @State private var nodes: [MarkdownNode] = []

    private let parser = MarkdownParser()
    private let inlineParser = InlineParser()

    /// 纯文本初始化（Chat/Plan 等场景保留）。内部走 Markdown 解析路径。
    public init(_ markdown: String) {
        self.markdown = markdown
        self.blocks = nil
    }

    /// 结构化块初始化（M1 公式渲染）。
    ///
    /// `text` 块复用现有 Markdown 段落渲染（保留 `**bold**` 等内联），`formula` 块交
    /// `FormulaView`，`image` 块用 `AsyncImage` + 文字降级（M1 极少，占位）。
    public init(blocks: [ContentBlock]) {
        self.blocks = blocks
        self.markdown = nil
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let blocks {
                ForEach(blocks.indices, id: \.self) { index in
                    blockView(for: blocks[index])
                }
            } else if let markdown {
                ForEach(nodes.indices, id: \.self) { index in
                    nodeView(for: nodes[index])
                }
            }
        }
        .onAppear {
            if let markdown { nodes = parser.parse(markdown) }
        }
        .onChange(of: markdown) { _, newValue in
            if let newValue { nodes = parser.parse(newValue) }
        }
    }

    // MARK: - Block 渲染（M1）

    @ViewBuilder
    private func blockView(for block: ContentBlock) -> some View {
        switch block {
        case .text(let content):
            if !content.isEmpty {
                paragraphView(text: content)
            }
        case .formula(let latex):
            if !latex.isEmpty {
                FormulaView(latex: latex)
            }
        case .image(let url, let alt):
            imageView(url: url, alt: alt)
        case .table(let headers, let rows):
            if !rows.isEmpty {
                TableBlockView(headers: headers, rows: rows)
            }
        case .steps(let title, let steps, let interaction):
            if !steps.isEmpty {
                StepsBlockView(title: title, steps: steps, interaction: interaction)
            }
        case .visual(let kind, let geometry):
            if kind == "geometry", let geometry {
                GeometryCanvasView(ast: geometry)
            } else {
                VisualPlaceholderView(kind: kind)
            }
        case .chart(let block):
            ChartCanvasView(block: block)
        case .circuit(let block):
            CircuitCanvasView(block: block)
        case .pedigree(let block):
            PedigreeCanvasView(block: block)
        case .graph(let block):
            GraphCanvasView(block: block)
        case .lab(let block):
            LabCanvasView(block: block)
        case .cell(let block):
            CellCanvasView(block: block)
        }
    }

    private func imageView(url: String, alt: String?) -> some View {
        Group {
            if let url = URL(string: url) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 120)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        Text(alt ?? "")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, minHeight: 60)
                    @unknown default:
                        Text(alt ?? "")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Text(alt ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private func nodeView(for node: MarkdownNode) -> some View {
        switch node {
        case .heading(let level, let text):
            headingView(level: level, text: text)

        case .paragraph(let text):
            paragraphView(text: text)

        case .codeBlock(let language, let code):
            codeBlockView(language: language, code: code)

        case .unorderedList(let items):
            unorderedListView(items: items)

        case .orderedList(let items):
            orderedListView(items: items)

        case .blockquote(let text):
            blockquoteView(text: text)

        case .divider:
            Divider()
                .padding(.vertical, 8)

        case .blankLine:
            Spacer().frame(height: 8)
        }
    }

    // MARK: - 各节点渲染

    private func headingView(level: Int, text: String) -> some View {
        let font: Font = {
            switch level {
            case 1: return .title
            case 2: return .title2
            case 3: return .title3
            case 4: return .headline
            default: return .subheadline
            }
        }()

        return Text(plainText(text))
            .font(font)
            .fontWeight(.bold)
            .padding(.top, level <= 3 ? 12 : 8)
            .padding(.bottom, 4)
    }

    private func paragraphView(text: String) -> some View {
        styledText(for: text)
            .font(.body)
            .padding(.vertical, 2)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func codeBlockView(language: String?, code: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let lang = language, !lang.isEmpty {
                Text(lang)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(.caption, design: .monospaced))
                    .padding(12)
            }
        }
        .background(Color.gray.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.vertical, 6)
    }

    private func unorderedListView(items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items.indices, id: \.self) { i in
                HStack(alignment: .top, spacing: 6) {
                    Text("•")
                        .font(.body)
                    styledText(for: items[i])
                        .font(.body)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func orderedListView(items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items.indices, id: \.self) { i in
                HStack(alignment: .top, spacing: 6) {
                    Text("\(i + 1).")
                        .font(.body)
                        .monospacedDigit()
                    styledText(for: items[i])
                        .font(.body)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func blockquoteView(text: String) -> some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color.gray.opacity(0.25))
                .frame(width: 3)
            styledText(for: text)
                .font(.body)
                .italic()
                .foregroundStyle(.secondary)
                .padding(.leading, 8)
        }
        .padding(.vertical, 4)
    }

    // MARK: - 内联样式 Text

    /// 仅生成纯文本（去除 markdown 标记），用于标题等不需要内联样式的地方
    private func plainText(_ text: String) -> String {
        text.replacingOccurrences(of: #"\*\*([^*]+)\*\*"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"(?<!\*)\*([^*\n]+)\*(?!\*)"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"`([^`]+)`"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"\[([^\]]+)\]\([^)]+\)"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: "_", with: "") // 简单去除下划线，不实现 __bold__
    }

    /// 生成带内联样式的 Text
    @ViewBuilder
    private func styledText(for text: String) -> some View {
        let tokens = inlineParser.parse(text)
        if tokens.count == 1, case .text(let plain) = tokens[0] {
            Text(plain)
        } else {
            tokens.reduce(Text("")) { result, token in
                result + tokenToText(token)
            }
        }
    }

    private func tokenToText(_ token: InlineToken) -> Text {
        switch token {
        case .text(let str):
            return Text(str)
        case .bold(let str):
            return Text(str).bold()
        case .italic(let str):
            return Text(str).italic()
        case .inlineCode(let str):
            return Text(str)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.pink)
        case .link(let text, _):
            // 内嵌 HTML 渲染禁止：链接仅作显示，不执行跳转
            return Text(text)
                .foregroundStyle(.blue)
                .underline()
        }
    }
}

#Preview {
    ScrollView {
        MarkdownRenderer("""
        # 标题一
        ## 标题二
        这是一段普通文本，包含**加粗**和*斜体*以及`行内代码`。

        ### 无序列表
        - 项目一
        - 项目二
        - 项目三

        ### 有序列表
        1. 第一步
        2. 第二步
        3. 第三步

        ### 代码块
        ```swift
        let x = 10
        print(x)
        ```

        > 这是一段引用文本。

        ---
        结尾段落。
        """)
        .padding()
    }
}
