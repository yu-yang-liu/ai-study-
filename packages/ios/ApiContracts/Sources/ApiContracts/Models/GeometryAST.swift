import Foundation

// MARK: - SceneBounds

/// 鍦烘櫙杈圭晫锛堟暟瀛﹀潗鏍囷紝y 鍚戜笂锛夈€?
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

/// 鍑犱綍鍏冪礌锛圥hase 2 路 Visual AST锛夈€?
///
/// 瀵瑰簲鍚庣 `GeometryElement`锛坴isual-ast v1锛夛細鎵€鏈夊瓧娈靛彲閫変互鍏煎瑙ｇ爜锛?
/// 娓叉煋鍣ㄦ寜 `type` 鍒嗗彂鍒板搴?drawer銆俙type` 鍙栧€硷細
/// `point` / `line` / `vector` / `triangle` / `polygon` / `circle` / `arc` /
/// `angle` / `functionCurve` / `label`銆?
public struct GeometryElement: Codable, Sendable, Equatable {
    /// 鍏冪礌绫诲瀷銆?
    public let type: String
    /// 鍏冪礌鏍囨敞鏂囨湰锛堥《鐐瑰瓧姣?/ 涓枃璇存槑锛夈€?
    public let label: String?
    /// CSS 棰滆壊锛坄#RRGGBB` 鎴栧熀纭€鑹插悕锛夈€?
    public let color: String?
    /// 鏄惁娓叉煋锛岀己鐪?true銆?
    public let visible: Bool?
    /// point / label 鍧愭爣銆?
    public let x: Double?
    public let y: Double?
    /// line / vector 绔偣銆?
    public let from: [Double]?
    public let to: [Double]?
    /// triangle 椤剁偣銆?
    public let vertices: [[Double]]?
    /// polygon 椤剁偣銆?
    public let points: [[Double]]?
    /// triangle / polygon 椤剁偣鏍囨敞銆?
    public let labels: [String]?
    /// circle / arc 鍦嗗績銆?
    public let center: [Double]?
    /// circle / arc 鍗婂緞銆?
    public let radius: Double?
    /// circle 濉厖锛坣one / light锛夈€?
    public let fill: String?
    /// arc 璧锋瑙掞紙搴︼級銆?
    public let startAngle: Double?
    public let endAngle: Double?
    /// angle 椤剁偣銆?
    public let vertex: [Double]?
    /// angle 搴︽暟鏍囨敞銆?
    public let degrees: Double?
    /// functionCurve 琛ㄨ揪寮忋€?
    public let expr: String?
    /// functionCurve x 閲囨牱鑼冨洿銆?
    public let xRange: [Double]?
    /// functionCurve 閲囨牱鐐规暟銆?
    public let samples: Int?
    /// label 鏂囨湰銆?
    public let text: String?
    /// label 閿氱偣锛坰tart / middle / end锛夈€?
    public let anchor: String?
    /// line 绾垮瀷锛坰olid / dashed锛夈€?
    public let style: String?
    /// field 鍦虹嚎绫诲瀷锛坋lectric / magnetic / contour锛夈€?
    public let kind: String?
    /// field 骞宠绾垮甫瀹藉害銆?
    public let width: Double?
    /// field 鍦虹嚎鏉℃暟銆?
    public let density: Int?
    /// field 鏄惁鏀惧皠鐘讹紙浠?center 杈愬皠锛夈€?
    public let radial: Bool?
    /// ray 绠ご浣嶇疆锛坰tart / end / both / none锛夈€?
    public let arrow: String?
    public let base: [Double]?
    public let direction: [Double]?
    public let height: Double?
    public let a: Double?
    public let b: Double?
    public let rotation: Double?
    public let faces: [[Int]]?
    public let relation: String?

    /// 鏄惧紡鎴愬憳鍒濆鍖栵紙瀛楁鍧囧彲閫夛紝渚夸簬棰勮 / 娴嬭瘯鏋勯€狅級銆?
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
        style: String? = nil,
        kind: String? = nil,
        width: Double? = nil,
        density: Int? = nil,
        radial: Bool? = nil,
        arrow: String? = nil,
        base: [Double]? = nil,
        direction: [Double]? = nil,
        height: Double? = nil,
        a: Double? = nil,
        b: Double? = nil,
        rotation: Double? = nil,
        faces: [[Int]]? = nil,
        relation: String? = nil
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
        self.kind = kind
        self.width = width
        self.density = density
        self.radial = radial
        self.arrow = arrow
        self.base = base
        self.direction = direction
        self.height = height
        self.a = a
        self.b = b
        self.rotation = rotation
        self.faces = faces
        self.relation = relation
    }

    /// 渚挎嵎鏋勯€狅細鐐广€?
    public static func point(x: Double, y: Double, label: String? = nil, color: String? = nil) -> GeometryElement {
        GeometryElement(type: "point", label: label, color: color, x: x, y: y)
    }

    /// 渚挎嵎鏋勯€狅細绾挎銆?
    public static func line(from: [Double], to: [Double], style: String? = nil, label: String? = nil) -> GeometryElement {
        GeometryElement(type: "line", label: label, from: from, to: to, style: style)
    }

    /// 渚挎嵎鏋勯€狅細甯︾澶村悜閲忋€?
    public static func vector(from: [Double], to: [Double], label: String? = nil, color: String? = nil) -> GeometryElement {
        GeometryElement(type: "vector", label: label, color: color, from: from, to: to)
    }

    /// 渚挎嵎鏋勯€狅細涓夎褰€?
    public static func triangle(vertices: [[Double]], labels: [String]? = nil) -> GeometryElement {
        GeometryElement(type: "triangle", vertices: vertices, labels: labels)
    }

    /// 渚挎嵎鏋勯€狅細鍦嗐€?
    public static func circle(center: [Double], radius: Double, fill: String? = nil, label: String? = nil) -> GeometryElement {
        GeometryElement(type: "circle", label: label, center: center, radius: radius, fill: fill)
    }

    /// 渚挎嵎鏋勯€狅細瑙掓爣璁般€?
    public static func angle(vertex: [Double], from: [Double], to: [Double], degrees: Double? = nil) -> GeometryElement {
        GeometryElement(type: "angle", from: from, to: to, vertex: vertex, degrees: degrees)
    }

    /// 渚挎嵎鏋勯€狅細鍑芥暟鏇茬嚎銆?
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

/// Geometry AST 鏍硅妭鐐癸紙Phase 2 路 Visual AST锛屽搴?visual-ast `GeometryAST`锛夈€?
///
/// 鍥惧儚涓嶆槸鍥剧墖锛欰I 鍙緭鍑虹粨鏋勫寲鏁版嵁锛宨OS 鐢?`GeometryCanvasView`
/// 锛圫wift `Canvas` / `Shape`锛夊姩鎬佹覆鏌擄紝涓嶄緷璧栧浘鐗?URL / TikZ銆?
public enum GeometryAST: Codable, Sendable, Equatable {
    /// 鑷敱鍦烘櫙锛堝钩闈㈠嚑浣?/ 鍔涘绀烘剰锛夈€?
    case scene(elements: [GeometryElement], bounds: SceneBounds?)
    /// 骞抽潰鐩磋鍧愭爣绯伙紙鍑芥暟鍥惧儚 / 瑙ｆ瀽鍑犱綍锛夈€?
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
            // 鏈煡鏍圭被鍨嬮檷绾т负绌?scene锛屼繚璇佹暣鍧楀彲瑙ｇ爜銆?
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
