import SwiftUI
import ApiContracts

/// 关系图渲染器（P1-4 · 食物链/食物网）。
///
/// 节点按 kind 着色（生产者绿 / 消费者蓝 / 分解者橙 / 其他灰），
/// 有向边 from → to 带箭头（能量流向），虚线支持。
public struct GraphCanvasView: View {
    let block: GraphBlock

    public init(block: GraphBlock) {
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

    private struct Transformer {
        let scale: CGFloat
        let offsetX: CGFloat
        let offsetY: CGFloat

        func point(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: offsetX + CGFloat(x) * scale, y: offsetY - CGFloat(y) * scale)
        }
    }

    private func transformer(for size: CGSize) -> Transformer {
        guard let first = block.nodes.first else {
            return Transformer(scale: 1, offsetX: 0, offsetY: 0)
        }
        var xMin = first.x
        var xMax = first.x
        var yMin = first.y
        var yMax = first.y
        for node in block.nodes {
            xMin = min(xMin, node.x)
            xMax = max(xMax, node.x)
            yMin = min(yMin, node.y)
            yMax = max(yMax, node.y)
        }
        let padding: CGFloat = 34
        let spanX = max(xMax - xMin, 1)
        let spanY = max(yMax - yMin, 1)
        let scale = min((size.width - padding * 2) / CGFloat(spanX), (size.height - padding * 2) / CGFloat(spanY))
        return Transformer(
            scale: scale,
            offsetX: size.width / 2 - CGFloat((xMin + xMax) / 2) * scale,
            offsetY: size.height / 2 + CGFloat((yMin + yMax) / 2) * scale
        )
    }

    private func nodeColor(_ kind: String?) -> Color {
        switch kind {
        case "producer": return .green
        case "consumer": return .blue
        case "decomposer": return .orange
        case "organism": return .teal
        default: return .gray
        }
    }

    private func draw(context: inout GraphicsContext, size: CGSize) {
        let transformer = transformer(for: size)

        for edge in block.edges {
            guard let fromNode = block.nodes.first(where: { $0.id == edge.from }),
                  let toNode = block.nodes.first(where: { $0.id == edge.to }) else { continue }
            let start = transformer.point(fromNode.x, fromNode.y)
            let end = transformer.point(toNode.x, toNode.y)
            var path = Path()
            path.move(to: start)
            path.addLine(to: end)
            let dash: [CGFloat] = edge.style == "dashed" ? [5, 4] : []
            context.stroke(path, with: .color(.secondary.opacity(0.7)), style: StrokeStyle(lineWidth: 1.3, dash: dash))
            drawArrow(context: &context, from: start, to: end)
        }

        for node in block.nodes {
            let point = transformer.point(node.x, node.y)
            let radius: CGFloat = 18
            let color = nodeColor(node.kind)
            context.fill(
                Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)),
                with: .color(color.opacity(0.9))
            )
            context.stroke(
                Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)),
                with: .color(.white),
                lineWidth: 1.5
            )
            context.draw(
                Text(node.label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white),
                at: point,
                anchor: .center
            )
        }
    }

    private func drawArrow(context: inout GraphicsContext, from start: CGPoint, to end: CGPoint) {
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
        context.fill(head, with: .color(.secondary.opacity(0.8)))
    }
}

#Preview("食物网") {
    GraphCanvasView(block: GraphBlock(
        title: "草原食物网",
        nodes: [
            GraphNode(id: "n1", label: "草", kind: "producer", x: 0, y: 0),
            GraphNode(id: "n2", label: "兔", kind: "consumer", x: 8, y: 4),
            GraphNode(id: "n3", label: "鼠", kind: "consumer", x: 8, y: -4),
            GraphNode(id: "n4", label: "鹰", kind: "consumer", x: 16, y: 0),
        ],
        edges: [
            GraphEdge(from: "n1", to: "n2"),
            GraphEdge(from: "n1", to: "n3"),
            GraphEdge(from: "n2", to: "n4"),
            GraphEdge(from: "n3", to: "n4"),
        ]
    ))
    .padding()
}
