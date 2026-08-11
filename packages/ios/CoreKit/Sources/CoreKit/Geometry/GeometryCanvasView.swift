import ApiContracts
import CoreGraphics
import SwiftUI

/// Geometry AST → SwiftUI `Canvas` 动态渲染（Phase 2 · Visual AST）。
///
/// 设计文件要求：几何采用 Geometry AST → Swift Canvas / Shape 动态渲染，
/// 不依赖图片 URL / TikZ。本视图负责：
/// 1. 边界计算（`GeometryBounds`）；
/// 2. 数学坐标 → 屏幕坐标映射（`CoordinateTransformer`）；
/// 3. 每个元素类型的独立 drawer。
public struct GeometryCanvasView: View {
    /// 待渲染的 Geometry AST。
    public let ast: GeometryAST

    public init(ast: GeometryAST) {
        self.ast = ast
    }

    public var body: some View {
        Canvas { context, size in
            let bounds = GeometryBounds.compute(ast)
            let transformer = CoordinateTransformer(
                bounds: bounds,
                width: size.width,
                height: size.height,
                padding: 24
            )
            switch ast {
            case .coordinateSystem(let xRange, let yRange, let xStep, let yStep, let showGrid, let children):
                Self.drawCoordinateSystem(
                    context: &context,
                    transformer: transformer,
                    bounds: bounds,
                    xRange: xRange,
                    yRange: yRange,
                    xStep: xStep,
                    yStep: yStep,
                    showGrid: showGrid == true,
                    elements: children
                )
            case .scene(let elements, _):
                Self.drawElements(context: &context, transformer: transformer, elements: elements)
            }
        }
        .aspectRatio(CGSize(width: 4, height: 3), contentMode: .fit)
    }

    // MARK: - 元素分发

    private static func drawElements(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        elements: [GeometryElement]
    ) {
        let ordered = elements
            .filter { $0.visible != false }
            .sorted { priority($0) < priority($1) }
        for element in ordered {
            drawElement(context: &context, transformer: transformer, element: element)
        }
    }

    private static func priority(_ element: GeometryElement) -> Int {
        switch element.type {
        case "triangle", "polygon", "field", "box", "cylinder", "cone": return 0
        case "line", "vector", "circle", "ray": return 1
        case "functionCurve", "conic": return 2
        case "arc", "angle": return 3
        case "relation", "point": return 4
        case "label": return 5
        default: return 6
        }
    }

    private static func drawElement(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        switch element.type {
        case "point":
            drawPoint(context: &context, transformer: transformer, element: element)
        case "line":
            drawLine(context: &context, transformer: transformer, element: element)
        case "vector":
            drawVector(context: &context, transformer: transformer, element: element)
        case "field":
            drawField(context: &context, transformer: transformer, element: element)
        case "ray":
            drawRay(context: &context, transformer: transformer, element: element)
        case "triangle":
            drawPolygon(context: &context, transformer: transformer, element: element, closed: true)
        case "polygon":
            drawPolygon(context: &context, transformer: transformer, element: element, closed: true)
        case "circle":
            drawCircle(context: &context, transformer: transformer, element: element)
        case "arc":
            drawArc(context: &context, transformer: transformer, element: element)
        case "angle":
            drawAngle(context: &context, transformer: transformer, element: element)
        case "functionCurve":
            drawFunctionCurve(context: &context, transformer: transformer, element: element)
        case "conic":
            drawConic(context: &context, transformer: transformer, element: element)
        case "box":
            drawBox(context: &context, transformer: transformer, element: element)
        case "cylinder", "cone":
            drawSolid(context: &context, transformer: transformer, element: element)
        case "relation":
            drawRelation(context: &context, transformer: transformer, element: element)
        case "label":
            drawLabel(context: &context, transformer: transformer, element: element)
        default:
            break
        }
    }

    // MARK: - 元素 drawer

    private static func drawPoint(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        let point = CGPoint(x: transformer.x(element.x ?? 0), y: transformer.y(element.y ?? 0))
        let rect = CGRect(x: point.x - 4, y: point.y - 4, width: 8, height: 8)
        let color = color(element.color, fallback: .gray900)
        context.fill(Path(ellipseIn: rect), with: .color(color))
        context.stroke(Path(ellipseIn: rect), with: .color(.white), lineWidth: 1.2)
        if let label = element.label {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: point.x + 7, y: point.y - 7),
                color: color,
                size: 14,
                anchor: .leading
            )
        }
    }

    private static func drawLine(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let from = element.from, from.count >= 2, let to = element.to, to.count >= 2 else { return }
        let path = segmentPath(from: from, to: to, transformer: transformer)
        let dash: [CGFloat] = element.style == "dashed" ? [6, 4] : []
        context.stroke(
            path,
            with: .color(color(element.color, fallback: .gray900)),
            style: StrokeStyle(lineWidth: 1.5, dash: dash)
        )
        if let label = element.label {
            let mid = CGPoint(
                x: transformer.x((from[0] + to[0]) / 2),
                y: transformer.y((from[1] + to[1]) / 2) - 8
            )
            drawText(context: &context, label, at: mid, color: .gray600, size: 13, anchor: .center)
        }
    }

    private static func drawVector(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let from = element.from, from.count >= 2, let to = element.to, to.count >= 2 else { return }
        let color = color(element.color, fallback: .vectorRed)
        let start = CGPoint(x: transformer.x(from[0]), y: transformer.y(from[1]))
        let end = CGPoint(x: transformer.x(to[0]), y: transformer.y(to[1]))
        let dx = Double(end.x - start.x)
        let dy = Double(end.y - start.y)
        let length = hypot(dx, dy)
        guard length > 1 else { return }
        let unitX = dx / length
        let unitY = dy / length
        let tip = CGPoint(x: end.x - CGFloat(unitX * 3), y: end.y - CGFloat(unitY * 3))
        let size = min(18, max(9, CGFloat(length) * 0.22))
        let base = CGPoint(x: tip.x - CGFloat(unitX * Double(size)), y: tip.y - CGFloat(unitY * Double(size)))
        let perp = CGVector(
            dx: -CGFloat(unitY * Double(size) * 0.45),
            dy: CGFloat(unitX * Double(size) * 0.45)
        )

        context.stroke(segmentPath(from: from, to: to, transformer: transformer), with: .color(color), lineWidth: 2)

        var head = Path()
        head.move(to: CGPoint(x: base.x + perp.dx, y: base.y + perp.dy))
        head.addLine(to: CGPoint(x: base.x - perp.dx, y: base.y - perp.dy))
        head.addLine(to: tip)
        head.closeSubpath()
        context.fill(head, with: .color(color))

        if let label = element.label {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: (start.x + end.x) / 2 + 8, y: (start.y + end.y) / 2 - 8),
                color: color,
                size: 14,
                anchor: .leading
            )
        }
    }

    /// 箭头（沿 from→to 方向，尖端在 to）。
    private static func arrowHead(
        context: inout GraphicsContext,
        from start: CGPoint,
        to end: CGPoint,
        color: Color,
        size: CGFloat
    ) {
        let dx = Double(end.x - start.x)
        let dy = Double(end.y - start.y)
        let length = hypot(dx, dy)
        guard length > 1 else { return }
        let ux = dx / length
        let uy = dy / length
        let base = CGPoint(x: end.x - CGFloat(ux * Double(size)), y: end.y - CGFloat(uy * Double(size)))
        let perp = CGVector(
            dx: -CGFloat(uy * Double(size) * 0.45),
            dy: CGFloat(ux * Double(size) * 0.45)
        )
        var head = Path()
        head.move(to: CGPoint(x: base.x + perp.dx, y: base.y + perp.dy))
        head.addLine(to: CGPoint(x: base.x - perp.dx, y: base.y - perp.dy))
        head.addLine(to: end)
        head.closeSubpath()
        context.fill(head, with: .color(color))
    }

    /// 场线（P1-3）：平行线带或放射线，方向由 from→to 决定。
    private static func drawField(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let from = element.from, from.count >= 2, let to = element.to, to.count >= 2 else { return }
        let color = color(element.color, fallback: .blue.opacity(0.65))
        let density = max(1, element.density ?? 5)
        let dash: [CGFloat] = element.style == "dashed" ? [5, 4] : []
        let style = StrokeStyle(lineWidth: 1.2, dash: dash)

        let dx = to[0] - from[0]
        let dy = to[1] - from[1]
        let length = hypot(dx, dy)
        guard length > 0.01 else { return }
        let ux = dx / length
        let uy = dy / length

        if element.radial == true, let center = element.center, center.count >= 2 {
            let startAngle = atan2(from[1] - center[1], from[0] - center[0])
            let endAngle = atan2(to[1] - center[1], to[0] - center[0])
            let centerPoint = CGPoint(x: transformer.x(center[0]), y: transformer.y(center[1]))
            for i in 0..<density {
                let t = density <= 1 ? 0 : Double(i) / Double(density - 1)
                let angle = startAngle + (endAngle - startAngle) * t
                let endPoint = CGPoint(
                    x: transformer.x(center[0] + cos(angle) * length),
                    y: transformer.y(center[1] + sin(angle) * length)
                )
                var path = Path()
                path.move(to: centerPoint)
                path.addLine(to: endPoint)
                context.stroke(path, with: .color(color), style: style)
                arrowHead(context: &context, from: centerPoint, to: endPoint, color: color, size: 7)
            }
        } else {
            let width = element.width ?? 4
            let nx = -uy
            let ny = ux
            for i in 0..<density {
                let t = density <= 1 ? 0 : Double(i) / Double(density - 1) - 0.5
                let offset = t * width
                let p0x = from[0] + nx * offset
                let p0y = from[1] + ny * offset
                let p1x = to[0] + nx * offset
                let p1y = to[1] + ny * offset
                let path = segmentPath(from: [p0x, p0y], to: [p1x, p1y], transformer: transformer)
                context.stroke(path, with: .color(color), style: style)
                arrowHead(
                    context: &context,
                    from: CGPoint(x: transformer.x(p0x), y: transformer.y(p0y)),
                    to: CGPoint(x: transformer.x(p1x), y: transformer.y(p1y)),
                    color: color,
                    size: 7
                )
            }
        }
    }

    /// 光路（P1-3）：折线 + 方向箭头。
    private static func drawRay(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        let points = element.points ?? []
        guard points.count >= 2 else { return }
        let color = color(element.color, fallback: .blue)
        let dash: [CGFloat] = element.style == "dashed" ? [5, 4] : []
        let style = StrokeStyle(lineWidth: 1.8, dash: dash)
        var path = Path()
        var mapped: [CGPoint] = []
        for point in points where point.count >= 2 {
            let p = CGPoint(x: transformer.x(point[0]), y: transformer.y(point[1]))
            mapped.append(p)
            if mapped.count == 1 {
                path.move(to: p)
            } else {
                path.addLine(to: p)
            }
        }
        context.stroke(path, with: .color(color), style: style)

        let arrow = element.arrow ?? "end"
        let size: CGFloat = 10
        if arrow == "start" || arrow == "both", mapped.count > 1, let first = mapped.first {
            arrowHead(context: &context, from: mapped[1], to: first, color: color, size: size)
        }
        if arrow == "end" || arrow == "both", mapped.count > 1, let last = mapped.last {
            arrowHead(context: &context, from: mapped[mapped.count - 2], to: last, color: color, size: size)
        }

        if let label = element.label, mapped.count > 1 {
            let mid = mapped[mapped.count / 2]
            drawText(context: &context, label, at: CGPoint(x: mid.x + 8, y: mid.y - 8), color: .gray600, size: 13, anchor: .leading)
        }
    }

    private static func drawPolygon(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement,
        closed: Bool
    ) {
        let vertices = element.type == "triangle" ? element.vertices ?? [] : element.points ?? []
        guard vertices.count >= 3 else { return }
        let color = color(element.color, fallback: .gray900)
        var path = Path()
        for (index, vertex) in vertices.enumerated() where vertex.count >= 2 {
            let point = CGPoint(x: transformer.x(vertex[0]), y: transformer.y(vertex[1]))
            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        if closed {
            path.closeSubpath()
        }
        context.stroke(path, with: .color(color), lineWidth: 1.5)

        let labels = element.labels ?? []
        if labels.count == vertices.count {
            let mapped = vertices.map { CGPoint(x: transformer.x($0[0]), y: transformer.y($0[1])) }
            let centroid = mapped.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
            let count = CGFloat(mapped.count)
            let center = CGPoint(x: centroid.x / count, y: centroid.y / count)
            for (index, vertex) in mapped.enumerated() {
                let label = labels[index]
                guard !label.isEmpty else { continue }
                let dx = Double(vertex.x - center.x)
                let dy = Double(vertex.y - center.y)
                let length = hypot(dx, dy)
                let offset: CGFloat = length > 0.5 ? 18 : 14
                let point = CGPoint(
                    x: vertex.x + CGFloat(dx / max(length, 0.001)) * offset,
                    y: vertex.y + CGFloat(dy / max(length, 0.001)) * offset
                )
                drawText(context: &context, label, at: point, color: color, size: 15, anchor: .center)
            }
        }
    }

    private static func drawCircle(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let center = element.center, center.count >= 2, let radius = element.radius else { return }
        let color = color(element.color, fallback: .gray900)
        let point = CGPoint(x: transformer.x(center[0]), y: transformer.y(center[1]))
        let screenRadius = CGFloat(radius * transformer.scale)
        let rect = CGRect(
            x: point.x - screenRadius,
            y: point.y - screenRadius,
            width: screenRadius * 2,
            height: screenRadius * 2
        )
        if element.fill == "light" {
            context.fill(Path(ellipseIn: rect), with: .color(Color.blue.opacity(0.08)))
        }
        context.stroke(Path(ellipseIn: rect), with: .color(color), lineWidth: 1.5)
        if let label = element.label {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: point.x + screenRadius + 6, y: point.y - 6),
                color: color,
                size: 14,
                anchor: .leading
            )
        }
    }

    private static func drawArc(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let center = element.center, center.count >= 2,
              let radius = element.radius,
              let startAngle = element.startAngle,
              let endAngle = element.endAngle else { return }
        let color = color(element.color, fallback: .gray900)
        let path = arcPath(
            center: center,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            transformer: transformer,
            segments: 48
        )
        context.stroke(path, with: .color(color), lineWidth: 1.5)
        if let label = element.label {
            let mid = (startAngle + endAngle) / 2
            let radians = mid * .pi / 180
            let point = CGPoint(
                x: transformer.x(center[0] + cos(radians) * radius * 1.15),
                y: transformer.y(center[1] + sin(radians) * radius * 1.15)
            )
            drawText(context: &context, label, at: point, color: color, size: 14, anchor: .center)
        }
    }

    private static func drawAngle(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let vertex = element.vertex, vertex.count >= 2,
              let from = element.from, from.count >= 2,
              let to = element.to, to.count >= 2 else { return }
        let color = color(element.color, fallback: .angleAmber)
        let angleFrom = atan2(from[1] - vertex[1], from[0] - vertex[0]) * 180 / .pi
        let angleTo = atan2(to[1] - vertex[1], to[0] - vertex[0]) * 180 / .pi
        var start = angleFrom
        var end = angleTo
        var delta = (angleTo - angleFrom).truncatingRemainder(dividingBy: 360)
        if delta < 0 { delta += 360 }
        if delta > 180 {
            swap(&start, &end)
            delta = 360 - delta
        }
        guard delta >= 1 else { return }

        let side1 = hypot(from[0] - vertex[0], from[1] - vertex[1])
        let side2 = hypot(to[0] - vertex[0], to[1] - vertex[1])
        let radius = element.radius ?? max(min(side1, side2) * 0.25, 0.25)
        let arc = arcPath(
            center: vertex,
            radius: radius,
            startAngle: start,
            endAngle: end,
            transformer: transformer,
            segments: 36
        )
        var wedge = arc
        wedge.addLine(to: CGPoint(x: transformer.x(vertex[0]), y: transformer.y(vertex[1])))
        wedge.closeSubpath()
        context.fill(wedge, with: .color(Color.orange.opacity(0.25)))
        context.stroke(arc, with: .color(color), lineWidth: 1.2)

        let mid = start + delta / 2
        let radians = mid * .pi / 180
        let labelPoint = CGPoint(
            x: transformer.x(vertex[0] + cos(radians) * radius * 1.3),
            y: transformer.y(vertex[1] + sin(radians) * radius * 1.3)
        )
        if let degrees = element.degrees {
            drawText(context: &context, "\(Self.tickLabel(degrees))°", at: labelPoint, color: color, size: 13, anchor: .center)
        } else if let label = element.label {
            drawText(context: &context, label, at: labelPoint, color: color, size: 13, anchor: .center)
        }
    }

    private static func drawFunctionCurve(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        let range = element.xRange ?? [-5, 5]
        let xMin = range.first ?? -5
        let xMax = range.count > 1 ? range[1] : 5
        let count = max(element.samples ?? 160, 2)
        let color = color(element.color, fallback: .curveBlue)
        var path = Path()
        var started = false
        for index in 0...count {
            let x = xMin + (xMax - xMin) * Double(index) / Double(count)
            guard let y = ExpressionEvaluator.evaluate(element.expr ?? "", x: x) else { continue }
            let point = CGPoint(x: transformer.x(x), y: transformer.y(y))
            if started {
                path.addLine(to: point)
            } else {
                path.move(to: point)
                started = true
            }
        }
        if started {
            context.stroke(path, with: .color(color), lineWidth: 2)
        }
        if let label = element.label, let lastPoint = path.currentPoint {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: lastPoint.x - 4, y: lastPoint.y - 8),
                color: color,
                size: 14,
                anchor: .trailing
            )
        }
    }

    private static func drawConic(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let center = element.center, center.count >= 2, let a = element.a else { return }
        let b = element.b ?? a
        let rotation = (element.rotation ?? 0) * .pi / 180
        let kind = element.kind ?? "ellipse"
        var path = Path()
        var started = false
        let count = 180

        for index in 0...count {
            let t = -Double.pi + (2 * Double.pi * Double(index) / Double(count))
            let local: (Double, Double)
            switch kind {
            case "parabola":
                local = (a * t * t / 4, b * t)
            case "hyperbola":
                let cosValue = cos(t)
                guard abs(cosValue) > 0.12 else { continue }
                local = (a / cosValue, b * tan(t))
            default:
                local = (a * cos(t), b * sin(t))
            }
            let x = center[0] + local.0 * cos(rotation) - local.1 * sin(rotation)
            let y = center[1] + local.0 * sin(rotation) + local.1 * cos(rotation)
            let point = CGPoint(x: transformer.x(x), y: transformer.y(y))
            if started {
                path.addLine(to: point)
            } else {
                path.move(to: point)
                started = true
            }
        }
        guard started else { return }
        context.stroke(
            path,
            with: .color(color(element.color, fallback: .curveBlue)),
            style: StrokeStyle(lineWidth: 1.8, dash: kind == "hyperbola" ? [6, 4] : [])
        )
        if let label = element.label {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: transformer.x(center[0] + a), y: transformer.y(center[1])),
                color: color(element.color, fallback: .curveBlue),
                size: 13,
                anchor: .leading
            )
        }
    }

    private static func drawBox(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        let vertices = element.vertices ?? []
        guard vertices.count >= 8 else { return }
        let strokeColor = color(element.color, fallback: .gray900)
        var edges = Set<String>()
        for face in element.faces ?? [] {
            guard face.count >= 2 else { continue }
            for index in face.indices {
                let a = face[index]
                let b = face[(index + 1) % face.count]
                guard a >= 0, b >= 0, a < vertices.count, b < vertices.count else { continue }
                let key = a < b ? "\(a)-\(b)" : "\(b)-\(a)"
                if edges.insert(key).inserted {
                    context.stroke(
                        segmentPath(from: vertices[a], to: vertices[b], transformer: transformer),
                        with: .color(strokeColor),
                        style: StrokeStyle(lineWidth: 1.4, dash: index % 2 == 0 ? [] : [5, 4])
                    )
                }
            }
        }
        if let label = element.label, let first = vertices.first, first.count >= 2 {
            drawText(
                context: &context,
                label,
                at: CGPoint(x: transformer.x(first[0]), y: transformer.y(first[1])),
                color: strokeColor,
                size: 13,
                anchor: .leading
            )
        }
    }

    private static func drawSolid(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let base = element.base, base.count >= 2,
              let direction = element.direction, direction.count >= 2,
              let radius = element.radius,
              let height = element.height else { return }
        let length = max(hypot(direction[0], direction[1]), 0.001)
        let ux = direction[0] / length
        let uy = direction[1] / length
        let top = [base[0] + ux * height, base[1] + uy * height]
        let color = color(element.color, fallback: .gray900)
        let perpendicular = [-uy, ux]

        func ellipsePath(center: [Double]) -> Path {
            var path = Path()
            for index in 0...40 {
                let angle = 2 * Double.pi * Double(index) / 40
                let point = [
                    center[0] + cos(angle) * radius,
                    center[1] + sin(angle) * radius * 0.35,
                ]
                let screen = CGPoint(x: transformer.x(point[0]), y: transformer.y(point[1]))
                if index == 0 { path.move(to: screen) } else { path.addLine(to: screen) }
            }
            return path
        }

        context.stroke(ellipsePath(center: base), with: .color(color), lineWidth: 1.4)
        context.stroke(ellipsePath(center: top), with: .color(color), style: StrokeStyle(lineWidth: 1.4, dash: [5, 4]))
        let sideOffsets = [-radius, radius]
        for offset in sideOffsets {
            let from = [base[0] + perpendicular[0] * offset, base[1] + perpendicular[1] * offset]
            let to = [top[0] + perpendicular[0] * offset, top[1] + perpendicular[1] * offset]
            context.stroke(segmentPath(from: from, to: to, transformer: transformer), with: .color(color), lineWidth: 1.4)
        }
        if element.type == "cone" {
            let apex = [top[0], top[1]]
            context.stroke(
                segmentPath(
                    from: [base[0] - perpendicular[0] * radius, base[1] - perpendicular[1] * radius],
                    to: apex,
                    transformer: transformer
                ),
                with: .color(color),
                lineWidth: 1.4
            )
            context.stroke(
                segmentPath(
                    from: [base[0] + perpendicular[0] * radius, base[1] + perpendicular[1] * radius],
                    to: apex,
                    transformer: transformer
                ),
                with: .color(color),
                lineWidth: 1.4
            )
        }
    }

    private static func drawRelation(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        guard let from = element.from, let to = element.to else { return }
        let relationColor = color(element.color, fallback: .angleAmber)
        context.stroke(
            segmentPath(from: from, to: to, transformer: transformer),
            with: .color(relationColor),
            style: StrokeStyle(lineWidth: 1.2, dash: [4, 4])
        )
        let mid = CGPoint(
            x: (transformer.x(from[0]) + transformer.x(to[0])) / 2,
            y: (transformer.y(from[1]) + transformer.y(to[1])) / 2 - 8
        )
        drawText(
            context: &context,
            element.label ?? element.relation ?? "",
            at: mid,
            color: relationColor,
            size: 12,
            anchor: .center
        )
    }

    private static func drawLabel(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        element: GeometryElement
    ) {
        let anchor: UnitPoint
        switch element.anchor {
        case "start":
            anchor = .leading
        case "end":
            anchor = .trailing
        default:
            anchor = .center
        }
        drawText(
            context: &context,
            element.text ?? "",
            at: CGPoint(x: transformer.x(element.x ?? 0), y: transformer.y(element.y ?? 0)),
            color: color(element.color, fallback: .gray900),
            size: 14,
            anchor: anchor
        )
    }

    // MARK: - 坐标系 / 网格

    private static func drawCoordinateSystem(
        context: inout GraphicsContext,
        transformer: CoordinateTransformer,
        bounds: SceneBounds,
        xRange: [Double],
        yRange: [Double],
        xStep: Double?,
        yStep: Double?,
        showGrid: Bool,
        elements: [GeometryElement]
    ) {
        let xMin = xRange.first ?? bounds.xMin
        let xMax = xRange.count > 1 ? xRange[1] : bounds.xMax
        let yMin = yRange.first ?? bounds.yMin
        let yMax = yRange.count > 1 ? yRange[1] : bounds.yMax
        let axisColor = Color.gray400
        let gridColor = Color.gray200

        if showGrid {
            let gx = xStep ?? niceStep(min: xMin, max: xMax, targetCount: 8)
            var xTick = (xMin / gx).rounded(.up) * gx
            while xTick <= xMax {
                if abs(xTick) > 1e-9 {
                    let sx = transformer.x(xTick)
                    context.stroke(
                        Path { path in
                            path.move(to: CGPoint(x: sx, y: transformer.y(yMin)))
                            path.addLine(to: CGPoint(x: sx, y: transformer.y(yMax)))
                        },
                        with: .color(gridColor),
                        lineWidth: 1
                    )
                }
                xTick += gx
            }
            let gy = yStep ?? niceStep(min: yMin, max: yMax, targetCount: 6)
            var yTick = (yMin / gy).rounded(.up) * gy
            while yTick <= yMax {
                if abs(yTick) > 1e-9 {
                    let sy = transformer.y(yTick)
                    context.stroke(
                        Path { path in
                            path.move(to: CGPoint(x: transformer.x(xMin), y: sy))
                            path.addLine(to: CGPoint(x: transformer.x(xMax), y: sy))
                        },
                        with: .color(gridColor),
                        lineWidth: 1
                    )
                }
                yTick += gy
            }
        }

        let axisY = transformer.y(0)
        let axisX = transformer.x(0)
        let hasXAxis = yMin < 0 && yMax > 0
        let hasYAxis = xMin < 0 && xMax > 0

        if hasXAxis {
            let path = Path { path in
                path.move(to: CGPoint(x: transformer.x(xMin), y: axisY))
                path.addLine(to: CGPoint(x: transformer.x(xMax), y: axisY))
            }
            context.stroke(path, with: .color(axisColor), lineWidth: 1.2)
            context.fill(arrowHead(at: CGPoint(x: transformer.x(xMax), y: axisY), angle: .pi, size: 9), with: .color(axisColor))
        }
        if hasYAxis {
            let path = Path { path in
                path.move(to: CGPoint(x: axisX, y: transformer.y(yMin)))
                path.addLine(to: CGPoint(x: axisX, y: transformer.y(yMax)))
            }
            context.stroke(path, with: .color(axisColor), lineWidth: 1.2)
            context.fill(arrowHead(at: CGPoint(x: axisX, y: transformer.y(yMax)), angle: -.pi / 2, size: 9), with: .color(axisColor))
        }

        if hasXAxis {
            let gx = xStep ?? niceStep(min: xMin, max: xMax, targetCount: 8)
            var xTick = (xMin / gx).rounded(.up) * gx
            while xTick <= xMax {
                if abs(xTick) > 1e-9 {
                    let sx = transformer.x(xTick)
                    let tick = Path { path in
                        path.move(to: CGPoint(x: sx, y: axisY - 3))
                        path.addLine(to: CGPoint(x: sx, y: axisY + 3))
                    }
                    context.stroke(tick, with: .color(axisColor), lineWidth: 1)
                    drawText(
                        context: &context,
                        Self.tickLabel(xTick),
                        at: CGPoint(x: sx, y: axisY + 18),
                        color: axisColor,
                        size: 11,
                        anchor: .center
                    )
                }
                xTick += gx
            }
            drawText(context: &context, "x", at: CGPoint(x: transformer.x(xMax), y: axisY - 16), color: axisColor, size: 12, anchor: .trailing)
        }
        if hasYAxis {
            let gy = yStep ?? niceStep(min: yMin, max: yMax, targetCount: 6)
            var yTick = (yMin / gy).rounded(.up) * gy
            while yTick <= yMax {
                if abs(yTick) > 1e-9 {
                    let sy = transformer.y(yTick)
                    let tick = Path { path in
                        path.move(to: CGPoint(x: axisX - 3, y: sy))
                        path.addLine(to: CGPoint(x: axisX + 3, y: sy))
                    }
                    context.stroke(tick, with: .color(axisColor), lineWidth: 1)
                    drawText(
                        context: &context,
                        Self.tickLabel(yTick),
                        at: CGPoint(x: axisX - 7, y: sy),
                        color: axisColor,
                        size: 11,
                        anchor: .trailing
                    )
                }
                yTick += gy
            }
            drawText(context: &context, "y", at: CGPoint(x: axisX + 16, y: transformer.y(yMax)), color: axisColor, size: 12, anchor: .leading)
        }

        drawElements(context: &context, transformer: transformer, elements: elements)
    }

    /// 选择视觉舒适的刻度步长（1/2/2.5/5 × 10^k）。
    private static func niceStep(min: Double, max: Double, targetCount: Double) -> Double {
        let raw = Swift.max((max - min) / Swift.max(targetCount, 1), 1e-9)
        let power = pow(10, floor(log10(raw)))
        for candidate in [1.0, 2.0, 2.5, 5.0, 10.0] where raw <= candidate * power {
            return candidate * power
        }
        return 10 * power
    }

    private static func tickLabel(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if rounded == rounded.rounded() {
            return String(Int(rounded))
        }
        return String(rounded)
    }

    // MARK: - 工具

    private static func segmentPath(from: [Double], to: [Double], transformer: CoordinateTransformer) -> Path {
        Path { path in
            path.move(to: CGPoint(x: transformer.x(from[0]), y: transformer.y(from[1])))
            path.addLine(to: CGPoint(x: transformer.x(to[0]), y: transformer.y(to[1])))
        }
    }

    private static func arcPath(
        center: [Double],
        radius: Double,
        startAngle: Double,
        endAngle: Double,
        transformer: CoordinateTransformer,
        segments: Int
    ) -> Path {
        var path = Path()
        guard radius > 0, segments >= 2 else { return path }
        let start = startAngle * .pi / 180
        let end = endAngle * .pi / 180
        for index in 0...segments {
            let angle = start + (end - start) * Double(index) / Double(segments)
            let x = center[0] + cos(angle) * radius
            let y = center[1] + sin(angle) * radius
            let point = CGPoint(x: transformer.x(x), y: transformer.y(y))
            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        return path
    }

    private static func arrowHead(at point: CGPoint, angle: CGFloat, size: CGFloat) -> Path {
        let radians = Double(angle)
        let tip = CGPoint(
            x: point.x + CGFloat(cos(radians) * Double(size)),
            y: point.y + CGFloat(sin(radians) * Double(size))
        )
        let base = CGPoint(
            x: point.x - CGFloat(cos(radians) * Double(size)),
            y: point.y - CGFloat(sin(radians) * Double(size))
        )
        let perp = CGVector(
            dx: -CGFloat(sin(radians) * Double(size) * 0.45),
            dy: CGFloat(cos(radians) * Double(size) * 0.45)
        )
        var path = Path()
        path.move(to: CGPoint(x: base.x + perp.dx, y: base.y + perp.dy))
        path.addLine(to: CGPoint(x: base.x - perp.dx, y: base.y - perp.dy))
        path.addLine(to: tip)
        path.closeSubpath()
        return path
    }

    private static func drawText(
        context: inout GraphicsContext,
        _ text: String,
        at point: CGPoint,
        color: Color,
        size: CGFloat,
        anchor: UnitPoint
    ) {
        context.draw(
            Text(text)
                .font(.system(size: size))
                .foregroundStyle(color),
            at: point,
            anchor: anchor
        )
    }

    /// CSS 颜色解析：支持 `#RRGGBB` 与常用色名；无法解析时返回 fallback。
    private static func color(_ css: String?, fallback: Color) -> Color {
        guard let css, !css.isEmpty else { return fallback }
        if let named = Self.namedColors[css.lowercased()] {
            return named
        }
        guard css.hasPrefix("#"), css.count == 7,
              let value = UInt64(css.dropFirst(), radix: 16) else {
            return fallback
        }
        return Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }

    private static let namedColors: [String: Color] = [
        "black": .black,
        "white": .white,
        "red": .red,
        "blue": .blue,
        "green": .green,
        "orange": .orange,
        "gray": .gray,
        "grey": .gray,
        "purple": .purple,
        "yellow": .yellow,
    ]
}

// MARK: - 预览用色板（避免直接依赖 Color+Brand 内部命名）

private extension Color {
    static let gray900 = Color(red: 0.12, green: 0.16, blue: 0.22)
    static let gray600 = Color(red: 0.39, green: 0.44, blue: 0.51)
    static let gray400 = Color(red: 0.58, green: 0.64, blue: 0.71)
    static let gray200 = Color(red: 0.89, green: 0.91, blue: 0.94)
    static let vectorRed = Color(red: 0.86, green: 0.15, blue: 0.15)
    static let curveBlue = Color(red: 0.15, green: 0.39, blue: 0.92)
    static let angleAmber = Color(red: 0.85, green: 0.53, blue: 0.03)
}

// MARK: - 预览

#Preview("三角形 + 角") {
    GeometryCanvasView(
        ast: .scene(
            elements: [
                .triangle(vertices: [[0, 0], [5, 0], [2, 3.5]], labels: ["A", "B", "C"]),
                .angle(vertex: [0, 0], from: [5, 0], to: [2, 3.5], degrees: 60),
            ],
            bounds: nil
        )
    )
    .padding()
}

#Preview("坐标系 + 函数曲线") {
    GeometryCanvasView(
        ast: .coordinateSystem(
            xRange: [-3, 3],
            yRange: [-1, 6],
            xStep: nil,
            yStep: nil,
            showGrid: true,
            children: [
                .functionCurve(expr: "x^2", color: "#2563eb", label: "y=x²"),
                .functionCurve(expr: "x + 2", color: "#dc2626", label: "y=x+2"),
            ]
        )
    )
    .padding()
}

#Preview("力的合成") {
    GeometryCanvasView(
        ast: .scene(
            elements: [
                .point(x: 0, y: 0, label: "O"),
                .vector(from: [0, 0], to: [3, 0], label: "F₁"),
                .vector(from: [0, 0], to: [1.5, 2.6], label: "F₂"),
                .line(from: [3, 0], to: [4.5, 2.6], style: "dashed"),
                .line(from: [1.5, 2.6], to: [4.5, 2.6], style: "dashed"),
                .vector(from: [0, 0], to: [4.5, 2.6], label: "F合", color: "#2563eb"),
            ],
            bounds: nil
        )
    )
    .padding()
}

#Preview("匀强电场 + 光路反射") {
    GeometryCanvasView(
        ast: .scene(
            elements: [
                GeometryElement(
                    type: "field",
                    label: "E",
                    from: [0, 0],
                    to: [6, 0],
                    kind: "electric",
                    width: 4,
                    density: 5
                ),
                GeometryElement(
                    type: "ray",
                    label: "反射光线",
                    points: [[-4, 3], [0, 0], [4, 3]],
                    arrow: "end"
                ),
                GeometryElement(type: "line", label: "法线", from: [0, -2], to: [0, 2], style: "dashed"),
            ],
            bounds: nil
        )
    )
    .padding()
}
