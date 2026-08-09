import ApiContracts
import CoreGraphics
import Foundation

/// 数学坐标 → 屏幕坐标变换（y 向上 → y 向下，等比缩放居中）。
public struct CoordinateTransformer: Sendable {
    /// 当前边界（数学坐标）。
    public let bounds: SceneBounds
    /// 每数学单位的屏幕像素数。
    public let scale: Double
    /// 屏幕原点 x 偏移。
    public let offsetX: Double
    /// 屏幕原点 y 偏移。
    public let offsetY: Double

    public init(bounds: SceneBounds, width: CGFloat, height: CGFloat, padding: CGFloat) {
        let safeWidth = Double(max(width - 2 * padding, 1))
        let safeHeight = Double(max(height - 2 * padding, 1))
        let safeBounds = Self.degenerateSafe(bounds)
        let bw = max(safeBounds.xMax - safeBounds.xMin, 1e-9)
        let bh = max(safeBounds.yMax - safeBounds.yMin, 1e-9)
        self.bounds = safeBounds
        self.scale = min(safeWidth / bw, safeHeight / bh)
        self.offsetX = (Double(width) - bw * scale) / 2
        self.offsetY = (Double(height) - bh * scale) / 2
    }

    /// 数学 x → 屏幕 x。
    public func x(_ mathX: Double) -> CGFloat {
        CGFloat(offsetX + (mathX - bounds.xMin) * scale)
    }

    /// 数学 y → 屏幕 y（y 向上翻转）。
    public func y(_ mathY: Double) -> CGFloat {
        CGFloat(offsetY + (bounds.yMax - mathY) * scale)
    }

    /// 退化边界（宽/高为 0）时各向外扩 0.5，避免除零与重叠。
    private static func degenerateSafe(_ bounds: SceneBounds) -> SceneBounds {
        var result = bounds
        if result.xMax - result.xMin < 1e-6 {
            result.xMin -= 0.5
            result.xMax += 0.5
        }
        if result.yMax - result.yMin < 1e-6 {
            result.yMin -= 0.5
            result.yMax += 0.5
        }
        return result
    }
}

/// Geometry AST 边界计算（Phase 2 · 渲染前适配）。
public enum GeometryBounds {
    /// 计算渲染边界（数学坐标）。
    ///
    /// 优先级：显式 `bounds` > 坐标轴 `xRange/yRange` > 元素自动适配。
    public static func compute(_ ast: GeometryAST) -> SceneBounds {
        switch ast {
        case .coordinateSystem(let xRange, let yRange, _, _, _, _):
            return SceneBounds(
                xMin: xRange.first ?? -5,
                yMin: yRange.first ?? -5,
                xMax: xRange.count > 1 ? xRange[1] : 5,
                yMax: yRange.count > 1 ? yRange[1] : 5
            )
        case .scene(let elements, let bounds):
            if let bounds { return bounds }
            var xs: [Double] = []
            var ys: [Double] = []
            for element in elements {
                collect(&xs, &ys, element)
            }
            if xs.isEmpty {
                return SceneBounds(xMin: -5, yMin: -5, xMax: 5, yMax: 5)
            }
            return SceneBounds(
                xMin: xs.min() ?? -5,
                yMin: ys.min() ?? -5,
                xMax: xs.max() ?? 5,
                yMax: ys.max() ?? 5
            )
        }
    }

    /// 收集元素坐标点（函数曲线按采样点参与边界）。
    private static func collect(_ xs: inout [Double], _ ys: inout [Double], _ element: GeometryElement) {
        func push(_ point: [Double]?) {
            guard let point, point.count >= 2 else { return }
            xs.append(point[0])
            ys.append(point[1])
        }
        switch element.type {
        case "point", "label":
            if let x = element.x, let y = element.y {
                xs.append(x)
                ys.append(y)
            }
        case "line", "vector":
            push(element.from)
            push(element.to)
        case "triangle":
            for vertex in element.vertices ?? [] {
                push(vertex)
            }
        case "polygon":
            for point in element.points ?? [] {
                push(point)
            }
        case "circle", "arc":
            if let center = element.center, center.count >= 2, let radius = element.radius {
                xs.append(center[0] - radius)
                xs.append(center[0] + radius)
                ys.append(center[1] - radius)
                ys.append(center[1] + radius)
            }
        case "angle":
            push(element.vertex)
            push(element.from)
            push(element.to)
        case "functionCurve":
            let range = element.xRange ?? [-5, 5]
            let xMin = range.first ?? -5
            let xMax = range.count > 1 ? range[1] : 5
            let count = max(element.samples ?? 160, 2)
            var found = false
            for index in 0...count {
                let x = xMin + (xMax - xMin) * Double(index) / Double(count)
                if let y = ExpressionEvaluator.evaluate(element.expr ?? "", x: x) {
                    xs.append(x)
                    ys.append(y)
                    found = true
                }
            }
            if !found {
                xs.append(xMin)
                xs.append(xMax)
                ys.append(-1)
                ys.append(1)
            }
        default:
            break
        }
    }
}
