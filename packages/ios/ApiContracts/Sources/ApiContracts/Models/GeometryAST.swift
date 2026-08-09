import Foundation

// MARK: - SceneBounds

/// 场景边界（数学坐标，y 向上）。
public struct SceneBounds: Codable, Sendable, Equatable {
    public let xMin: Double
    public let yMin: Double
    public let xMax: Double
    public let yMax: Double

    public init(xMin: Double, yMin: Double, xMax: Double, yMax: Double) {
        self.xMin = xMin
        self.yMin = yMin
        self.xMax = xMax
        self.yMax = yMax
    }
}

// MARK: - GeometryElement

/// 几何元素（Phase 2 · Visual AST）。
///
/// 对应后端 `GeometryElement`（visual-ast v1）：所有字段可选以兼容解码，
/// 渲染器按 `type` 分发到对应 drawer。`type` 取值：
/// `point` / `line` / `vector` / `triangle` / `polygon` / `circle` / `arc` /
/// `angle` / `functionCurve` / `label`。
public struct GeometryElement: Codable, Sendable, Equatable {
    /// 元素类型。
    public let type: String
    /// 元素标注文本（顶点字母 / 中文说明）。
    public let label: String?
    /// CSS 颜色（`#RRGGBB` 或基础色名）。
    public let color: String?
    /// 是否渲染，缺省 true。
    public let visible: Bool?
    /// point / label 坐标。
    public let x: Double?
    public let y: Double?
    /// line / vector 端点。
    public let from: [Double]?
    public let to: [Double]?
    /// triangle 顶点。
    public let vertices: [[Double]]?
    /// polygon 顶点。
    public let points: [[Double]]?
    /// triangle / polygon 顶点标注。
    public let labels: [String]?
    /// circle / arc 圆心。
    public let center: [Double]?
    /// circle / arc 半径。
    public let radius: Double?
    /// circle 填充（none / light）。
    public let fill: String?
    /// arc 起止角（度）。
    public let startAngle: Double?
    public let endAngle: Double?
    /// angle 顶点。
    public let vertex: [Double]?
    /// angle 度数标注。
    public let degrees: Double?
    /// functionCurve 表达式。
    public let expr: String?
    /// functionCurve x 采样范围。
    public let xRange: [Double]?
    /// functionCurve 采样点数。
    public let samples: Int?
    /// label 文本。
    public let text: String?
    /// label 锚点（start / middle / end）。
    public let anchor: String?
    /// line 线型（solid / dashed）。
    public let style: String?

    /// 显式成员初始化（字段均可选，便于预览 / 测试构造）。
    public init(
        type: String,
        label: String? = nil,
        color: String? = nil,
        visible: Bool? = nil,
        x: Double? = nil,
        y: Double? = nil,
        from: [Double]? = nil,
        to: [Double]? = nil,
        vertices: [[Double]]? = nil,
        points: [[Double]]? = nil,
        labels: [String]? = nil,
        center: [Double]? = nil,
        radius: Double? = nil,
        fill: String? = nil,
        startAngle: Double? = nil,
        endAngle: Double? = nil,
        vertex: [Double]? = nil,
        degrees: Double? = nil,
        expr: String? = nil,
        xRange: [Double]? = nil,
        samples: Int? = nil,
        text: String? = nil,
        anchor: String? = nil,
        style: String? = nil
    ) {
        self.type = type
        self.label = label
        self.color = color
        self.visible = visible
        self.x = x
        self.y = y
        self.from = from
        self.to = to
        self.vertices = vertices
        self.points = points
        self.labels = labels
        self.center = center
        self.radius = radius
        self.fill = fill
        self.startAngle = startAngle
        self.endAngle = endAngle
        self.vertex = vertex
        self.degrees = degrees
        self.expr = expr
        self.xRange = xRange
        self.samples = samples
        self.text = text
        self.anchor = anchor
        self.style = style
    }

    /// 便捷构造：点。
    public static func point(x: Double, y: Double, label: String? = nil, color: String? = nil) -> GeometryElement {
        GeometryElement(type: "point", label: label, color: color, x: x, y: y)
    }

    /// 便捷构造：线段。
    public static func line(from: [Double], to: [Double], style: String? = nil, label: String? = nil) -> GeometryElement {
        GeometryElement(type: "line", label: label, from: from, to: to, style: style)
    }

    /// 便捷构造：带箭头向量。
    public static func vector(from: [Double], to: [Double], label: String? = nil, color: String? = nil) -> GeometryElement {
        GeometryElement(type: "vector", label: label, color: color, from: from, to: to)
    }

    /// 便捷构造：三角形。
    public static func triangle(vertices: [[Double]], labels: [String]? = nil) -> GeometryElement {
        GeometryElement(type: "triangle", vertices: vertices, labels: labels)
    }

    /// 便捷构造：圆。
    public static func circle(center: [Double], radius: Double, fill: String? = nil, label: String? = nil) -> GeometryElement {
        GeometryElement(type: "circle", label: label, center: center, radius: radius, fill: fill)
    }

    /// 便捷构造：角标记。
    public static func angle(vertex: [Double], from: [Double], to: [Double], degrees: Double? = nil) -> GeometryElement {
        GeometryElement(type: "angle", from: from, to: to, vertex: vertex, degrees: degrees)
    }

    /// 便捷构造：函数曲线。
    public static func functionCurve(
        expr: String,
        xRange: [Double]? = nil,
        samples: Int? = nil,
        color: String? = nil,
        label: String? = nil
    ) -> GeometryElement {
        GeometryElement(type: "functionCurve", label: label, color: color, expr: expr, xRange: xRange, samples: samples)
    }
}

// MARK: - GeometryAST

/// Geometry AST 根节点（Phase 2 · Visual AST，对应 visual-ast `GeometryAST`）。
///
/// 图像不是图片：AI 只输出结构化数据，iOS 由 `GeometryCanvasView`
/// （Swift `Canvas` / `Shape`）动态渲染，不依赖图片 URL / TikZ。
public enum GeometryAST: Codable, Sendable, Equatable {
    /// 自由场景（平面几何 / 力学示意）。
    case scene(elements: [GeometryElement], bounds: SceneBounds?)
    /// 平面直角坐标系（函数图像 / 解析几何）。
    case coordinateSystem(
        xRange: [Double],
        yRange: [Double],
        xStep: Double?,
        yStep: Double?,
        showGrid: Bool?,
        children: [GeometryElement]
    )

    private enum CodingKeys: String, CodingKey {
        case type
        case elements
        case bounds
        case xRange
        case yRange
        case xStep
        case yStep
        case showGrid
        case children
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "scene":
            let elements = try container.decodeIfPresent([GeometryElement].self, forKey: .elements) ?? []
            let bounds = try container.decodeIfPresent(SceneBounds.self, forKey: .bounds)
            self = .scene(elements: elements, bounds: bounds)
        case "coordinateSystem":
            let xRange = try container.decodeIfPresent([Double].self, forKey: .xRange) ?? []
            let yRange = try container.decodeIfPresent([Double].self, forKey: .yRange) ?? []
            let xStep = try container.decodeIfPresent(Double.self, forKey: .xStep)
            let yStep = try container.decodeIfPresent(Double.self, forKey: .yStep)
            let showGrid = try container.decodeIfPresent(Bool.self, forKey: .showGrid)
            let children = try container.decodeIfPresent([GeometryElement].self, forKey: .children) ?? []
            self = .coordinateSystem(
                xRange: xRange,
                yRange: yRange,
                xStep: xStep,
                yStep: yStep,
                showGrid: showGrid,
                children: children
            )
        default:
            // 未知根类型降级为空 scene，保证整块可解码。
            self = .scene(elements: [], bounds: nil)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .scene(let elements, let bounds):
            try container.encode("scene", forKey: .type)
            try container.encode(elements, forKey: .elements)
            try container.encodeIfPresent(bounds, forKey: .bounds)
        case .coordinateSystem(let xRange, let yRange, let xStep, let yStep, let showGrid, let children):
            try container.encode("coordinateSystem", forKey: .type)
            try container.encode(xRange, forKey: .xRange)
            try container.encode(yRange, forKey: .yRange)
            try container.encodeIfPresent(xStep, forKey: .xStep)
            try container.encodeIfPresent(yStep, forKey: .yStep)
            try container.encodeIfPresent(showGrid, forKey: .showGrid)
            try container.encode(children, forKey: .children)
        }
    }
}
