import Foundation

// MARK: - ContentBlock

/// 结构化内容块（Phase 1 Science AST）。
///
/// 四类子 AST 映射（对齐 docs/SCIENCE_AST_IOS_ROADMAP.md）：
/// - Text AST       → `text` / `formula` / `image` / `table`
/// - Visual AST     → `visual`（Phase 1 占位；Phase 2 由 GeometryCanvasView 渲染）
/// - Solution AST   → `steps`（可展示的解题轨迹）
/// - Interaction AST→ `steps.interaction`（折叠 / 可选择等交互元数据）
///
/// 解码容错：
/// - `formula` 缺 `latex` 时回退 `content`（兼容 OCR 旧格式 formula-as-content）。
/// - `text` 缺 `content` 时降级为空串。
/// - 未知 `type` 降级为 `.text(content: "")`，单个坏块不会导致整响解码失败。
/// - `table` / `steps` 缺失核心数组时降级为空，保证客户端解析稳定。
public enum ContentBlock: Codable, Sendable, Equatable {
    /// 普通文本（Markdown 内联渲染）。
    case text(content: String)
    /// 数学公式（纯 LaTeX，无 `$` 包裹），交 `FormulaView` 渲染。
    case formula(latex: String)
    /// 图片（Phase 1 极少出现；示意图应以 Visual AST 表达，不依赖图片 URL）。
    case image(url: String, alt: String?)
    /// 表格（Text AST）。
    case table(headers: [String]?, rows: [[String]])
    /// 解题步骤（Solution AST），可递归包含公式 / 表格等块。
    case steps(title: String?, steps: [StepContent], interaction: InteractionHint?)
    /// 视觉内容（Visual AST）。Phase 2：`kind == "geometry"` 且携带 `GeometryAST` 时，
    /// 由 `GeometryCanvasView`（Swift Canvas/Shape）动态渲染；否则显示占位。
    case visual(kind: String, geometry: GeometryAST?)

    // MARK: CodingKeys

    private enum CodingKeys: String, CodingKey {
        case type
        case content
        case latex
        case url
        case alt
        case headers
        case rows
        case title
        case steps
        case interaction
        case kind
        case geometry
    }

    // MARK: Decodable

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "text":
            let content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
            self = .text(content: content)
        case "formula":
            // 优先 latex，缺省回退 content（OCR 旧格式把公式放在 content 字段）。
            let latex = try container.decodeIfPresent(String.self, forKey: .latex)
                ?? (try container.decodeIfPresent(String.self, forKey: .content))
                ?? ""
            self = .formula(latex: latex)
        case "image":
            let url = try container.decodeIfPresent(String.self, forKey: .url) ?? ""
            let alt = try container.decodeIfPresent(String.self, forKey: .alt)
            self = .image(url: url, alt: alt)
        case "table":
            let headers = try container.decodeIfPresent([String].self, forKey: .headers)
            let rows = try container.decodeIfPresent([[String]].self, forKey: .rows) ?? []
            self = .table(headers: headers, rows: rows)
        case "steps":
            let title = try container.decodeIfPresent(String.self, forKey: .title)
            let steps = try container.decodeIfPresent([StepContent].self, forKey: .steps) ?? []
            let interaction = try container.decodeIfPresent(InteractionHint.self, forKey: .interaction)
            self = .steps(title: title, steps: steps, interaction: interaction)
        case "visual":
            let kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? "placeholder"
            let geometry = try container.decodeIfPresent(GeometryAST.self, forKey: .geometry)
            self = .visual(kind: kind, geometry: geometry)
        default:
            // 未知 type 降级为空文本，保证整响可解码。
            self = .text(content: "")
        }
    }

    // MARK: Encodable

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let content):
            try container.encode("text", forKey: .type)
            try container.encode(content, forKey: .content)
        case .formula(let latex):
            try container.encode("formula", forKey: .type)
            try container.encode(latex, forKey: .latex)
        case .image(let url, let alt):
            try container.encode("image", forKey: .type)
            try container.encode(url, forKey: .url)
            try container.encodeIfPresent(alt, forKey: .alt)
        case .table(let headers, let rows):
            try container.encode("table", forKey: .type)
            try container.encodeIfPresent(headers, forKey: .headers)
            try container.encode(rows, forKey: .rows)
        case .steps(let title, let steps, let interaction):
            try container.encode("steps", forKey: .type)
            try container.encodeIfPresent(title, forKey: .title)
            try container.encode(steps, forKey: .steps)
            try container.encodeIfPresent(interaction, forKey: .interaction)
        case .visual(let kind, let geometry):
            try container.encode("visual", forKey: .type)
            try container.encode(kind, forKey: .kind)
            try container.encodeIfPresent(geometry, forKey: .geometry)
        }
    }
}

// MARK: - StepContent

/// 解题步骤内容（Solution AST 叶子，对应后端 `stepContentSchema`）。
public struct StepContent: Codable, Sendable, Equatable {
    /// 步骤标题，如「第一步：化简」。
    public let title: String?
    /// 步骤内容块（可递归包含公式 / 表格等）。
    public let blocks: [ContentBlock]
    /// 该步骤对错（批改场景）。
    public let isCorrect: Bool?
    /// 能力点 / 方法标签，如「配方法」。
    public let tag: String?

    private enum CodingKeys: String, CodingKey {
        case title
        case blocks
        case isCorrect
        case tag
    }

    public init(title: String? = nil, blocks: [ContentBlock], isCorrect: Bool? = nil, tag: String? = nil) {
        self.title = title
        self.blocks = blocks
        self.isCorrect = isCorrect
        self.tag = tag
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.title = try container.decodeIfPresent(String.self, forKey: .title)
        self.blocks = try container.decodeIfPresent([ContentBlock].self, forKey: .blocks) ?? []
        self.isCorrect = try container.decodeIfPresent(Bool.self, forKey: .isCorrect)
        self.tag = try container.decodeIfPresent(String.self, forKey: .tag)
    }
}

// MARK: - InteractionHint

/// Interaction AST（Phase 1 最小子集）：折叠 / 可选择。
public struct InteractionHint: Codable, Sendable, Equatable {
    /// 是否可折叠。
    public let collapsible: Bool?
    /// 是否可选中步骤。
    public let selectable: Bool?

    public init(collapsible: Bool? = nil, selectable: Bool? = nil) {
        self.collapsible = collapsible
        self.selectable = selectable
    }
}
