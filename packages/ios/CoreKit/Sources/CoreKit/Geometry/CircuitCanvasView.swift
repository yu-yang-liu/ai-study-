import SwiftUI
import ApiContracts

/// 电路图渲染器（P1-2 · Visual AST 扩展）。
///
/// 先画导线，再按节点类型绘制元件符号（电池/电阻/开关/灯泡/电表/滑动变阻器/
/// 电动机/电容器/二极管/接地/拐点），支持水平/垂直朝向与开关断开状态。
public struct CircuitCanvasView: View {
    let block: CircuitBlock

    public init(block: CircuitBlock) {
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

    // MARK: - 坐标变换

    private struct Bounds {
        var xMin: Double
        var yMin: Double
        var xMax: Double
        var yMax: Double
    }

    private func bounds() -> Bounds? {
        guard let first = block.nodes.first else { return nil }
        var bounds = Bounds(xMin: first.x, yMin: first.y, xMax: first.x, yMax: first.y)
        for node in block.nodes {
            bounds.xMin = min(bounds.xMin, node.x)
            bounds.xMax = max(bounds.xMax, node.x)
            bounds.yMin = min(bounds.yMin, node.y)
            bounds.yMax = max(bounds.yMax, node.y)
        }
        return bounds
    }

    private struct Transformer {
        let scale: CGFloat
        let offsetX: CGFloat
        let offsetY: CGFloat

        func point(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: offsetX + CGFloat(x) * scale, y: offsetY - CGFloat(y) * scale)
        }
    }

    private func transformer(for size: CGSize, bounds: Bounds) -> Transformer {
        let padding: CGFloat = 30
        let spanX = max(bounds.xMax - bounds.xMin, 1)
        let spanY = max(bounds.yMax - bounds.yMin, 1)
        let scale = min((size.width - padding * 2) / CGFloat(spanX), (size.height - padding * 2) / CGFloat(spanY))
        let midX = (bounds.xMin + bounds.xMax) / 2
        let midY = (bounds.yMin + bounds.yMax) / 2
        return Transformer(
            scale: scale,
            offsetX: size.width / 2 - CGFloat(midX) * scale,
            offsetY: size.height / 2 + CGFloat(midY) * scale
        )
    }

    private func nodeById(_ id: String) -> CircuitNode? {
        block.nodes.first { $0.id == id }
    }

    // MARK: - 绘制

    private func draw(context: inout GraphicsContext, size: CGSize) {
        guard let bounds = bounds() else { return }
        let transformer = transformer(for: size, bounds: bounds)

        // 导线
        for wire in block.wires {
            guard let fromNode = nodeById(wire.from), let toNode = nodeById(wire.to) else { continue }
            var path = Path()
            path.move(to: transformer.point(fromNode.x, fromNode.y))
            path.addLine(to: transformer.point(toNode.x, toNode.y))
            if wire.style == "dashed" {
                context.stroke(path, with: .color(.secondary.opacity(0.7)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            } else {
                context.stroke(path, with: .color(.primary.opacity(0.7)), lineWidth: 1.5)
            }
        }

        // 元件符号
        for node in block.nodes {
            drawNode(context: &context, node: node, at: transformer.point(node.x, node.y), scale: transformer.scale, vertical: node.orientation == "vertical")
        }
    }

    private func localPath(_ points: [(Double, Double)], at p: CGPoint, scale: CGFloat, vertical: Bool) -> [CGPoint] {
        points.map { dx, dy in
            vertical
                ? CGPoint(x: p.x + CGFloat(dy) * scale, y: p.y + CGFloat(dx) * scale)
                : CGPoint(x: p.x + CGFloat(dx) * scale, y: p.y - CGFloat(dy) * scale)
        }
    }

    private func strokePath(_ points: [(Double, Double)], context: inout GraphicsContext, at p: CGPoint, scale: CGFloat, vertical: Bool, lineWidth: CGFloat = 1.2, dash: [CGFloat] = []) {
        let mapped = localPath(points, at: p, scale: scale, vertical: vertical)
        guard let first = mapped.first else { return }
        var path = Path()
        path.move(to: first)
        for point in mapped.dropFirst() {
            path.addLine(to: point)
        }
        let style = dash.isEmpty ? StrokeStyle(lineWidth: lineWidth) : StrokeStyle(lineWidth: lineWidth, dash: dash)
        context.stroke(path, with: .color(.primary), style: style)
    }

    private func fillCircle(context: inout GraphicsContext, center: CGPoint, radius: CGFloat, color: Color = .primary) {
        context.fill(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)), with: .color(color))
    }

    private func drawNode(context: inout GraphicsContext, node: CircuitNode, at p: CGPoint, scale: CGFloat, vertical: Bool) {
        let unit = max(scale * 1.2, 6) // 符号半宽（屏幕点）
        switch node.type {
        case "battery":
            // 长线为正（右），短线为负（左）
            strokePath([(-1, -1.4), (-1, 1.4)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 2)
            strokePath([(1, -2), (1, 2)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 2)
        case "resistor":
            strokePath([(-2, 0), (-1.1, 0), (-0.55, 1), (0, 0), (0.55, -1), (1.1, 0), (2, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
        case "switch":
            if node.open == true {
                strokePath([(-2, 0), (-0.35, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
                strokePath([(0.35, 0), (2, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
                fillCircle(context: &context, center: p, radius: 1.6)
            } else {
                strokePath([(-2, 0), (2, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
            }
        case "bulb":
            let center = p
            context.stroke(Path(ellipseIn: CGRect(x: center.x - unit * 2, y: center.y - unit * 2, width: unit * 4, height: unit * 4)), with: .color(.primary), lineWidth: 1.4)
            strokePath([(-1.3, -1.3), (1.3, 1.3)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1)
            strokePath([(-1.3, 1.3), (1.3, -1.3)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1)
        case "ammeter", "voltmeter", "motor":
            let symbol = node.type == "ammeter" ? "A" : node.type == "voltmeter" ? "V" : "M"
            let center = p
            context.stroke(Path(ellipseIn: CGRect(x: center.x - unit * 2, y: center.y - unit * 2, width: unit * 4, height: unit * 4)), with: .color(.primary), lineWidth: 1.4)
            context.draw(Text(symbol).font(.system(size: unit * 1.8, weight: .semibold)).foregroundStyle(.primary), at: center)
        case "rheostat":
            strokePath([(-2, 0), (-1.1, 0), (-0.55, 1), (0, 0), (0.55, -1), (1.1, 0), (2, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
            strokePath([(0, 1.6), (0, -1.6)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.2)
            let mapped = localPath([(0, 1.6)], at: p, scale: unit, vertical: vertical)
            fillCircle(context: &context, center: mapped[0], radius: 1.6)
        case "capacitor":
            strokePath([(-0.8, -2), (-0.8, 2)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.8)
            strokePath([(0.8, -2), (0.8, 2)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.8)
        case "diode":
            strokePath([(-1.5, -1.3), (0.8, 0), (-1.5, 1.3), (-1.5, -1.3)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.4)
            strokePath([(0.8, -1.3), (0.8, 1.3)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.8)
        case "ground":
            strokePath([(0, 1.5), (0, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.4)
            strokePath([(-1.5, 0), (1.5, 0)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.6)
            strokePath([(-1, -0.45), (1, -0.45)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.3)
            strokePath([(-0.5, -0.9), (0.5, -0.9)], context: &context, at: p, scale: unit, vertical: vertical, lineWidth: 1.1)
        case "wire":
            fillCircle(context: &context, center: p, radius: 1.6)
        default:
            fillCircle(context: &context, center: p, radius: 1.6)
        }

        // 标签 / 参数
        var annotation = ""
        if let label = node.label, !label.isEmpty { annotation = label }
        if let value = node.value, !value.isEmpty {
            annotation = annotation.isEmpty ? value : "\(annotation) \(value)"
        }
        if !annotation.isEmpty {
            context.draw(
                Text(annotation)
                    .font(.caption2)
                    .foregroundStyle(.secondary),
                at: CGPoint(x: p.x, y: p.y + unit * 3),
                anchor: .top
            )
        }
    }
}

// MARK: - Previews

#Preview("串联电路") {
    CircuitCanvasView(block: CircuitBlock(
        title: "串联电路",
        nodes: [
            CircuitNode(id: "b1", type: "battery", x: 0, y: 0, value: "6V"),
            CircuitNode(id: "s1", type: "switch", x: 8, y: 0, open: false),
            CircuitNode(id: "l1", type: "bulb", x: 16, y: 0, label: "灯泡"),
        ],
        wires: [
            CircuitWire(from: "b1", to: "s1"),
            CircuitWire(from: "s1", to: "l1"),
            CircuitWire(from: "l1", to: "b1"),
        ]
    ))
    .padding()
}

#Preview("伏安法测电阻") {
    CircuitCanvasView(block: CircuitBlock(
        title: "伏安法测电阻",
        nodes: [
            CircuitNode(id: "b1", type: "battery", x: 0, y: 0),
            CircuitNode(id: "s1", type: "switch", x: 6, y: 0, open: false),
            CircuitNode(id: "a1", type: "ammeter", x: 12, y: 0),
            CircuitNode(id: "r1", type: "resistor", x: 18, y: 0, label: "Rx"),
            CircuitNode(id: "v1", type: "voltmeter", x: 18, y: 6),
        ],
        wires: [
            CircuitWire(from: "b1", to: "s1"),
            CircuitWire(from: "s1", to: "a1"),
            CircuitWire(from: "a1", to: "r1"),
            CircuitWire(from: "r1", to: "b1"),
            CircuitWire(from: "r1", to: "v1"),
            CircuitWire(from: "v1", to: "b1"),
        ]
    ))
    .padding()
}
