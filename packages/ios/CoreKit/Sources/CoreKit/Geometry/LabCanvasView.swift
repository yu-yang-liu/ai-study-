import SwiftUI
import ApiContracts

/// 实验装置图渲染器（P2-1 化学实验：制气 / 蒸馏 / 过滤 / 萃取分液等）。
///
/// 器材按 `type` 绘制专用图元（圆底烧瓶 / 锥形瓶 / 烧杯 / 试管 / 漏斗 /
/// 分液漏斗 / 滴液漏斗 / 冷凝管 / 温度计 / 酒精灯 / 铁架台 / 铁夹 / 集气瓶 /
/// 水槽 / 玻璃棒 / 滤纸 / 导管 / 蒸发皿 / 坩埚 / 药匙等），坐标数学系 y 向上；
/// 连接按 `kind` 区分线型：tube 实线、gasFlow 虚线+箭头、liquidFlow 实线+箭头、
/// heat 红色波浪线。
public struct LabCanvasView: View {
    let block: LabBlock

    public init(block: LabBlock) {
        self.block = block
    }

    public var body: some View {
        VStack(spacing: 6) {
            if let title = block.title, !title.isEmpty {
                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                    .foregroundStyle(.primary)
            }
            Canvas { context, size in
                draw(context: &context, size: size)
            }
            .aspectRatio(4.0 / 3.0, contentMode: .fit)
            .padding(8)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 坐标变换（数学系 y 向上）

    private struct Transformer {
        let scale: CGFloat
        let offsetX: CGFloat
        let offsetY: CGFloat

        func point(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: offsetX + CGFloat(x) * scale, y: offsetY - CGFloat(y) * scale)
        }
    }

    private func transformer(for size: CGSize) -> Transformer {
        guard let first = block.apparatus.first else {
            return Transformer(scale: 1, offsetX: 0, offsetY: 0)
        }
        var xMin = first.x
        var xMax = first.x
        var yMin = first.y
        var yMax = first.y
        for apparatus in block.apparatus {
            xMin = min(xMin, apparatus.x)
            xMax = max(xMax, apparatus.x)
            yMin = min(yMin, apparatus.y)
            yMax = max(yMax, apparatus.y)
        }
        let padding: CGFloat = 40
        let spanX = max(xMax - xMin, 4)
        let spanY = max(yMax - yMin, 4)
        let scale = min((size.width - padding * 2) / CGFloat(spanX), (size.height - padding * 2) / CGFloat(spanY))
        return Transformer(
            scale: scale,
            offsetX: size.width / 2 - CGFloat((xMin + xMax) / 2) * scale,
            offsetY: size.height / 2 + CGFloat((yMin + yMax) / 2) * scale
        )
    }

    private func apparatusById(_ id: String) -> LabApparatus? {
        block.apparatus.first { $0.id == id }
    }

    // MARK: - 绘制

    private func draw(context: inout GraphicsContext, size: CGSize) {
        guard !block.apparatus.isEmpty else { return }
        let transformer = transformer(for: size)

        for connection in block.connections {
            guard let fromApparatus = apparatusById(connection.from),
                  let toApparatus = apparatusById(connection.to) else { continue }
            drawConnection(
                context: &context,
                connection: connection,
                from: transformer.point(fromApparatus.x, fromApparatus.y),
                to: transformer.point(toApparatus.x, toApparatus.y)
            )
        }

        for apparatus in block.apparatus {
            let point = transformer.point(apparatus.x, apparatus.y)
            let unit = max(CGFloat(apparatus.scale ?? 1) * 8, 4)
            drawApparatus(context: &context, apparatus: apparatus, at: point, unit: unit)
        }
    }

    // MARK: - 连接线

    private func drawConnection(context: inout GraphicsContext, connection: LabConnection, from start: CGPoint, to end: CGPoint) {
        let kind = connection.kind
        switch kind {
        case "gasFlow":
            var path = Path()
            path.move(to: start)
            path.addLine(to: end)
            context.stroke(path, with: .color(.blue.opacity(0.75)), style: StrokeStyle(lineWidth: 1.4, dash: [5, 4]))
            drawArrow(context: &context, from: start, to: end, color: .blue)
        case "liquidFlow":
            var path = Path()
            path.move(to: start)
            path.addLine(to: end)
            context.stroke(path, with: .color(.teal.opacity(0.8)), lineWidth: 1.4)
            drawArrow(context: &context, from: start, to: end, color: .teal)
        case "heat":
            drawWave(context: &context, from: start, to: end)
        default:
            var path = Path()
            path.move(to: start)
            path.addLine(to: end)
            context.stroke(path, with: .color(.secondary.opacity(0.7)), lineWidth: 1.5)
        }

        if let label = connection.label, !label.isEmpty {
            context.draw(
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.secondary),
                at: CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 8),
                anchor: .bottom
            )
        }
    }

    private func drawArrow(context: inout GraphicsContext, from start: CGPoint, to end: CGPoint, color: Color) {
        let dx = Double(end.x - start.x)
        let dy = Double(end.y - start.y)
        let length = hypot(dx, dy)
        guard length > 1 else { return }
        let ux = dx / length
        let uy = dy / length
        let size: CGFloat = 8
        let base = CGPoint(x: end.x - CGFloat(ux * Double(size)), y: end.y - CGFloat(uy * Double(size)))
        let perp = CGVector(dx: -CGFloat(uy * Double(size) * 0.45), dy: CGFloat(ux * Double(size) * 0.45))
        var head = Path()
        head.move(to: CGPoint(x: base.x + perp.dx, y: base.y + perp.dy))
        head.addLine(to: CGPoint(x: base.x - perp.dx, y: base.y - perp.dy))
        head.addLine(to: end)
        head.closeSubpath()
        context.fill(head, with: .color(color.opacity(0.85)))
    }

    private func drawWave(context: inout GraphicsContext, from start: CGPoint, to end: CGPoint) {
        let dx = Double(end.x - start.x)
        let dy = Double(end.y - start.y)
        let length = hypot(dx, dy)
        guard length > 2 else { return }
        let ux = dx / length
        let uy = dy / length
        let px = -uy
        let py = ux
        let segments = 12
        var path = Path()
        path.move(to: start)
        for i in 1...segments {
            let t = Double(i) / Double(segments)
            let along = length * t
            let wave = sin(t * Double.pi * 4) * 4
            let x = Double(start.x) + ux * along + px * wave
            let y = Double(start.y) + uy * along + py * wave
            path.addLine(to: CGPoint(x: x, y: y))
        }
        context.stroke(path, with: .color(.red.opacity(0.85)), lineWidth: 1.6)
    }

    // MARK: - 器材图元

    /// 把局部坐标（dx, dy，y 向上，单位 unit）映射到屏幕坐标，并应用朝向。
    private func localPoint(_ dx: Double, _ dy: Double, orientation: String?, unit: CGFloat, at p: CGPoint) -> CGPoint {
        switch orientation {
        case "horizontal":
            return CGPoint(x: p.x + CGFloat(dy) * unit, y: p.y + CGFloat(dx) * unit)
        case "left":
            return CGPoint(x: p.x - CGFloat(dx) * unit, y: p.y - CGFloat(dy) * unit)
        default:
            return CGPoint(x: p.x + CGFloat(dx) * unit, y: p.y - CGFloat(dy) * unit)
        }
    }

    private func strokePoints(_ points: [(Double, Double)], context: inout GraphicsContext, at p: CGPoint, unit: CGFloat, orientation: String?, lineWidth: CGFloat = 1.4, dash: [CGFloat] = [], color: Color = .primary) {
        let mapped = points.map { localPoint($0.0, $0.1, orientation: orientation, unit: unit, at: p) }
        guard let first = mapped.first else { return }
        var path = Path()
        path.move(to: first)
        for point in mapped.dropFirst() {
            path.addLine(to: point)
        }
        let style = dash.isEmpty ? StrokeStyle(lineWidth: lineWidth) : StrokeStyle(lineWidth: lineWidth, dash: dash)
        context.stroke(path, with: .color(color), style: style)
    }

    private func fillPolygon(_ points: [(Double, Double)], context: inout GraphicsContext, at p: CGPoint, unit: CGFloat, orientation: String?, color: Color) {
        let mapped = points.map { localPoint($0.0, $0.1, orientation: orientation, unit: unit, at: p) }
        guard let first = mapped.first else { return }
        var path = Path()
        path.move(to: first)
        for point in mapped.dropFirst() {
            path.addLine(to: point)
        }
        path.closeSubpath()
        context.fill(path, with: .color(color))
        context.stroke(path, with: .color(.primary), lineWidth: 1.3)
    }

    private func fillEllipse(context: inout GraphicsContext, cx: Double, cy: Double, rx: Double, ry: Double, unit: CGFloat, orientation: String?, at p: CGPoint, color: Color = .blue.opacity(0.16)) {
        let center = localPoint(cx, cy, orientation: orientation, unit: unit, at: p)
        let width = rx * 2 * unit
        let height = ry * 2 * unit
        let rect = CGRect(x: center.x - width / 2, y: center.y - height / 2, width: width, height: height)
        context.fill(Path(ellipseIn: rect), with: .color(color))
        context.stroke(Path(ellipseIn: rect), with: .color(.primary), lineWidth: 1.3)
    }

    private func fillCircle(context: inout GraphicsContext, cx: Double, cy: Double, radius: Double, unit: CGFloat, orientation: String?, at p: CGPoint, color: Color = .blue.opacity(0.16)) {
        fillEllipse(context: &context, cx: cx, cy: cy, rx: radius, ry: radius, unit: unit, orientation: orientation, at: p, color: color)
    }

    private func drawApparatus(context: inout GraphicsContext, apparatus: LabApparatus, at p: CGPoint, unit: CGFloat) {
        let o = apparatus.orientation
        switch apparatus.type {
        case "flask":
            fillEllipse(context: &context, cx: 0, cy: -0.9, rx: 1.7, ry: 1.9, unit: unit, orientation: o, at: p)
            strokePoints([(-0.55, 0.8), (-0.55, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0.55, 0.8), (0.55, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(-0.8, 3.0), (0.8, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "erlenmeyerFlask":
            fillPolygon([(-1.5, -2.0), (1.5, -2.0), (0.6, 2.1), (-0.6, 2.1)], context: &context, at: p, unit: unit, orientation: o, color: .blue.opacity(0.16))
            strokePoints([(-0.6, 2.1), (-0.6, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0.6, 2.1), (0.6, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(-0.85, 3.0), (0.85, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "beaker":
            fillPolygon([(-1.7, -2.0), (1.7, -2.0), (1.7, 1.6), (1.0, 2.2), (-1.7, 2.0)], context: &context, at: p, unit: unit, orientation: o, color: .blue.opacity(0.16))
        case "testTube":
            fillPolygon([(-0.75, 2.4), (0.75, 2.4), (0.75, -1.8), (-0.75, -1.8)], context: &context, at: p, unit: unit, orientation: o, color: .blue.opacity(0.16))
            fillEllipse(context: &context, cx: 0, cy: -1.8, rx: 0.75, ry: 0.6, unit: unit, orientation: o, at: p, color: .blue.opacity(0.16))
            strokePoints([(-0.75, 2.4), (-0.75, -1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.75, 2.4), (0.75, -1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-0.95, 2.4), (0.95, 2.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "funnel":
            strokePoints([(-2.2, 2.6), (2.2, 2.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            strokePoints([(-2.2, 2.6), (0, -2.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(2.2, 2.6), (0, -2.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(-0.28, -2.4), (-0.28, -3.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.28, -2.4), (0.28, -3.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
        case "separatoryFunnel":
            fillEllipse(context: &context, cx: 0, cy: 0.3, rx: 1.5, ry: 2.0, unit: unit, orientation: o, at: p)
            strokePoints([(-0.35, 2.2), (-0.35, 3.1)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.35, 2.2), (0.35, 3.1)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-0.28, -1.9), (-0.28, -3.3)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.28, -1.9), (0.28, -3.3)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            fillCircle(context: &context, cx: 0, cy: -2.6, radius: 0.35, unit: unit, orientation: o, at: p, color: .gray.opacity(0.3))
        case "droppingFunnel":
            fillEllipse(context: &context, cx: 0, cy: 0.5, rx: 1.3, ry: 1.5, unit: unit, orientation: o, at: p)
            strokePoints([(-0.3, 2.0), (-0.3, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.3, 2.0), (0.3, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-0.22, -1.0), (-0.22, -3.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
            strokePoints([(0.22, -1.0), (0.22, -3.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
            fillCircle(context: &context, cx: 0, cy: -2.7, radius: 0.32, unit: unit, orientation: o, at: p, color: .gray.opacity(0.3))
        case "condenser":
            strokePoints([(-0.95, -3.4), (-0.95, 3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0.95, -3.4), (0.95, 3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(-0.95, -3.4), (0.95, -3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(-0.95, 3.4), (0.95, 3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0, -3.0), (0, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.0)
            strokePoints([(-0.5, -2.8), (0.5, -1.8), (-0.5, -0.8), (0.5, 0.2), (-0.5, 1.2), (0.5, 2.2)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.0)
            strokePoints([(0.95, 1.8), (2.0, 1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
            strokePoints([(-0.95, -1.8), (-2.0, -1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
        case "thermometer":
            strokePoints([(-0.35, 3.0), (-0.35, -1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(0.35, 3.0), (0.35, -1.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-0.55, 3.0), (0.55, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            fillCircle(context: &context, cx: 0, cy: -2.2, radius: 0.6, unit: unit, orientation: o, at: p, color: .red.opacity(0.55))
            strokePoints([(-0.7, -2.2), (0.7, -2.2)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
        case "alcoholLamp":
            fillPolygon([(-1.5, -1.3), (1.5, -1.3), (1.0, 1.4), (-1.0, 1.4)], context: &context, at: p, unit: unit, orientation: o, color: .orange.opacity(0.22))
            strokePoints([(-1.9, -1.5), (1.9, -1.5)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            strokePoints([(0, 1.4), (0, 2.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
            fillEllipse(context: &context, cx: 0, cy: 2.5, rx: 0.45, ry: 0.95, unit: unit, orientation: o, at: p, color: .yellow.opacity(0.6))
        case "stand":
            strokePoints([(-2.5, -2.8), (2.5, -2.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 2.0)
            strokePoints([(-2.2, -2.8), (-2.5, -3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            strokePoints([(2.2, -2.8), (2.5, -3.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            strokePoints([(1.9, -2.8), (1.9, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.6)
            strokePoints([(1.7, 3.0), (2.1, 3.0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
        case "clamp":
            fillCircle(context: &context, cx: 0, cy: 0, radius: 0.35, unit: unit, orientation: o, at: p, color: .gray.opacity(0.3))
            strokePoints([(0.35, 0), (1.6, 1.1)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0.35, 0), (1.6, -1.1)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(1.6, 1.1), (1.6, -1.1)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
        case "gasBottle":
            fillPolygon([(-1.4, -2.4), (1.4, -2.4), (1.4, 2.4), (-1.4, 2.4)], context: &context, at: p, unit: unit, orientation: o, color: .blue.opacity(0.14))
            strokePoints([(-1.8, 2.4), (-1.8, 2.9)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(1.8, 2.4), (1.8, 2.9)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-1.8, 2.9), (1.8, 2.9)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "waterTrough":
            fillPolygon([(-3.0, -1.2), (3.0, -1.2), (3.0, 1.0), (-3.0, 1.0)], context: &context, at: p, unit: unit, orientation: o, color: .blue.opacity(0.16))
            strokePoints([(-3.0, 1.4), (3.0, 1.4)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "glassRod":
            strokePoints([(-2.6, 0), (2.6, 0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 2.4)
            fillCircle(context: &context, cx: -2.6, cy: 0, radius: 1.0, unit: unit, orientation: o, at: p, color: .gray.opacity(0.2))
            fillCircle(context: &context, cx: 2.6, cy: 0, radius: 1.0, unit: unit, orientation: o, at: p, color: .gray.opacity(0.2))
        case "filterPaper":
            strokePoints([(-1.7, -1.6), (0, 2.2), (1.7, -1.6), (-1.7, -1.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.4)
            strokePoints([(0, 2.2), (-1.2, -1.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.0, dash: [4, 3], color: .secondary)
            strokePoints([(0, 2.2), (1.2, -1.6)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.0, dash: [4, 3], color: .secondary)
        case "deliveryTube":
            strokePoints([(-2.2, 1.2), (0, 1.2), (0, -1.2), (2.2, -1.2)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.7)
            strokePoints([(-2.7, 1.2), (-2.2, 1.2)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
            strokePoints([(2.2, -1.2), (2.7, -1.2)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.5)
        case "evaporatingDish":
            fillPolygon([(-2.0, 1.2), (2.0, 1.2), (1.2, -0.8), (-1.2, -0.8)], context: &context, at: p, unit: unit, orientation: o, color: .gray.opacity(0.16))
            strokePoints([(-1.2, -0.8), (1.2, -0.8)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
        case "crucible":
            fillPolygon([(-1.3, -0.4), (1.3, -0.4), (0.9, 1.2), (-0.9, 1.2)], context: &context, at: p, unit: unit, orientation: o, color: .gray.opacity(0.2))
            strokePoints([(-1.1, 1.5), (1.1, 1.5)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            strokePoints([(-1.1, 1.5), (-0.6, 1.9), (0, 2.0), (0.6, 1.9), (1.1, 1.5)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2)
        case "spoon":
            strokePoints([(-2.4, 0.3), (0.5, 0.3)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.3)
            fillEllipse(context: &context, cx: 1.1, cy: 0.3, rx: 0.7, ry: 0.45, unit: unit, orientation: o, at: p, color: .gray.opacity(0.2))
        default:
            strokePoints([(-1.6, 0), (1.6, 0), (0, 1.6), (-1.6, 0)], context: &context, at: p, unit: unit, orientation: o, lineWidth: 1.2, dash: [3, 3], color: .secondary)
        }

        drawApparatusAnnotation(context: &context, apparatus: apparatus, at: p, unit: unit)
    }

    private func drawApparatusAnnotation(context: inout GraphicsContext, apparatus: LabApparatus, at p: CGPoint, unit: CGFloat) {
        if let content = apparatus.content, !content.isEmpty {
            context.draw(
                Text(content)
                    .font(.system(size: max(unit * 0.7, 8)))
                    .foregroundStyle(.blue),
                at: p,
                anchor: .center
            )
        }
        if let label = apparatus.label, !label.isEmpty {
            context.draw(
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.secondary),
                at: CGPoint(x: p.x, y: p.y - unit * 3.6),
                anchor: .bottom
            )
        }
    }
}

// MARK: - Previews

#Preview("排水集气法制氧气") {
    LabCanvasView(block: LabBlock(
        title: "排水集气法制 O₂",
        apparatus: [
            LabApparatus(id: "flask", type: "flask", x: 0, y: 2, label: "圆底烧瓶", content: "MnO₂ + H₂O₂"),
            LabApparatus(id: "funnel", type: "droppingFunnel", x: 0, y: 8, label: "分液漏斗"),
            LabApparatus(id: "lamp", type: "alcoholLamp", x: 0, y: -2, label: "酒精灯"),
            LabApparatus(id: "tube", type: "deliveryTube", x: 6, y: 2, label: "导管"),
            LabApparatus(id: "bottle", type: "gasBottle", x: 11, y: 0, label: "集气瓶", content: "O₂"),
            LabApparatus(id: "trough", type: "waterTrough", x: 11, y: -5, label: "水槽", content: "水"),
        ],
        connections: [
            LabConnection(from: "funnel", to: "flask"),
            LabConnection(from: "lamp", to: "flask", kind: "heat"),
            LabConnection(from: "flask", to: "tube"),
            LabConnection(from: "tube", to: "bottle"),
            LabConnection(from: "bottle", to: "trough", kind: "gasFlow", label: "排水"),
        ]
    ))
    .padding()
}

#Preview("蒸馏装置") {
    LabCanvasView(block: LabBlock(
        title: "蒸馏",
        apparatus: [
            LabApparatus(id: "flask", type: "flask", x: -8, y: 0, label: "蒸馏烧瓶", content: "液体"),
            LabApparatus(id: "lamp", type: "alcoholLamp", x: -8, y: -5, label: "酒精灯"),
            LabApparatus(id: "condenser", type: "condenser", x: 3, y: 0, orientation: "horizontal", label: "冷凝管"),
            LabApparatus(id: "thermo", type: "thermometer", x: -5, y: 6, label: "温度计"),
            LabApparatus(id: "receiver", type: "erlenmeyerFlask", x: 12, y: -3, label: "锥形瓶", content: "馏出液"),
        ],
        connections: [
            LabConnection(from: "lamp", to: "flask", kind: "heat"),
            LabConnection(from: "flask", to: "condenser"),
            LabConnection(from: "condenser", to: "receiver", kind: "liquidFlow", label: "馏出液"),
        ]
    ))
    .padding()
}
