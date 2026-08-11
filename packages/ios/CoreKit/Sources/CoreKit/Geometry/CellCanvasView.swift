import SwiftUI
import ApiContracts

/// 细胞模式图渲染器（P2-2 生物：动植物/原核细胞 + 跨膜运输）。
///
/// 细胞器按 `type` 绘制专用图元（细胞壁/细胞膜为双圈/单圈外轮廓，
/// 细胞核、线粒体、叶绿体、液泡、内质网、高尔基体、核糖体、中心体、
/// 鞭毛、荚膜、拟核等），坐标数学系 y 向上；`connections` 画协作/流向
/// 连线，`transport` 画跨膜进出箭头。
public struct CellCanvasView: View {
    let block: CellBlock

    public init(block: CellBlock) {
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
        guard let first = block.organelles.first else {
            return Transformer(scale: 1, offsetX: 0, offsetY: 0)
        }
        var xMin = first.x
        var xMax = first.x
        var yMin = first.y
        var yMax = first.y
        for organelle in block.organelles {
            xMin = min(xMin, organelle.x)
            xMax = max(xMax, organelle.x)
            yMin = min(yMin, organelle.y)
            yMax = max(yMax, organelle.y)
        }
        // 保证细胞膜外轮廓至少留一圈空间。
        xMin = min(xMin, -9)
        xMax = max(xMax, 9)
        yMin = min(yMin, -9)
        yMax = max(yMax, 9)
        let padding: CGFloat = 42
        let spanX = max(xMax - xMin, 6)
        let spanY = max(yMax - yMin, 6)
        let scale = min((size.width - padding * 2) / CGFloat(spanX), (size.height - padding * 2) / CGFloat(spanY))
        return Transformer(
            scale: scale,
            offsetX: size.width / 2 - CGFloat((xMin + xMax) / 2) * scale,
            offsetY: size.height / 2 + CGFloat((yMin + yMax) / 2) * scale
        )
    }

    private func organelleById(_ id: String) -> CellOrganelle? {
        block.organelles.first { $0.id == id }
    }

    private func hasOrganelle(_ type: String) -> Bool {
        block.organelles.contains { $0.type == type }
    }

    /// 细胞膜半径（世界单位）。
    private var membraneRadius: Double {
        hasOrganelle("cellWall") ? 10.5 : 9.0
    }

    // MARK: - 绘制

    private func draw(context: inout GraphicsContext, size: CGSize) {
        guard !block.organelles.isEmpty else { return }
        let transformer = transformer(for: size)
        let unit = max(transformer.scale * 1.0, 3)
        let center = transformer.point(0, 0)

        // 外轮廓：植物双圈（细胞壁 + 细胞膜），动物/原核单圈（细胞膜）。
        if hasOrganelle("cellWall") {
            fillEllipse(
                context: &context,
                center: center,
                rx: CGFloat(membraneRadius) * unit,
                ry: CGFloat(membraneRadius) * unit * 0.82,
                fill: .green.opacity(0.05),
                stroke: .green.opacity(0.75),
                lineWidth: 2.0
            )
        }
        fillEllipse(
            context: &context,
            center: center,
            rx: CGFloat(membraneRadius - (hasOrganelle("cellWall") ? 0.9 : 0)) * unit,
            ry: CGFloat(membraneRadius - (hasOrganelle("cellWall") ? 0.9 : 0)) * unit * 0.82,
            fill: .blue.opacity(0.05),
            stroke: .blue.opacity(0.8),
            lineWidth: 1.6
        )

        // 荚膜（原核）外虚线。
        if hasOrganelle("capsule") {
            strokeEllipse(
                context: &context,
                center: center,
                rx: (CGFloat(membraneRadius) + 1.6) * unit,
                ry: (CGFloat(membraneRadius) + 1.6) * unit * 0.84,
                color: .secondary.opacity(0.65),
                lineWidth: 1.3,
                dash: [5, 4]
            )
        }

        for connection in block.connections ?? [] {
            guard let from = organelleById(connection.from),
                  let to = organelleById(connection.to) else { continue }
            drawConnection(
                context: &context,
                connection: connection,
                from: transformer.point(from.x, from.y),
                to: transformer.point(to.x, to.y)
            )
        }

        for organelle in block.organelles {
            drawOrganelle(context: &context, organelle: organelle, at: transformer.point(organelle.x, organelle.y), unit: unit)
        }

        for transport in block.transport ?? [] {
            drawTransport(context: &context, transport: transport, center: center, unit: unit)
        }
    }

    // MARK: - 连接线

    private func drawConnection(context: inout GraphicsContext, connection: CellConnection, from start: CGPoint, to end: CGPoint) {
        let color: Color
        switch connection.kind {
        case "energy":
            color = .orange
        case "synthesis":
            color = .green
        case "signal":
            color = .purple
        default:
            color = .secondary
        }
        var path = Path()
        path.move(to: start)
        path.addLine(to: end)
        let dash: [CGFloat] = connection.kind == "signal" ? [5, 4] : []
        let style = dash.isEmpty ? StrokeStyle(lineWidth: 1.4) : StrokeStyle(lineWidth: 1.4, dash: dash)
        context.stroke(path, with: .color(color.opacity(0.75)), style: style)
        drawArrow(context: &context, from: start, to: end, color: color)

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
        let size: CGFloat = 7
        let base = CGPoint(x: end.x - CGFloat(ux * Double(size)), y: end.y - CGFloat(uy * Double(size)))
        let perp = CGVector(dx: -CGFloat(uy * Double(size) * 0.45), dy: CGFloat(ux * Double(size) * 0.45))
        var head = Path()
        head.move(to: CGPoint(x: base.x + perp.dx, y: base.y + perp.dy))
        head.addLine(to: CGPoint(x: base.x - perp.dx, y: base.y - perp.dy))
        head.addLine(to: end)
        head.closeSubpath()
        context.fill(head, with: .color(color.opacity(0.85)))
    }

    // MARK: - 跨膜运输箭头

    private func drawTransport(context: inout GraphicsContext, transport: CellTransport, center: CGPoint, unit: CGFloat) {
        let radius = CGFloat(membraneRadius) * unit
        let y = center.y + CGFloat((block.transport ?? []).firstIndex(where: { $0.id == transport.id }) ?? 0) * unit * 2.2 - unit * 1.1
        let inward = transport.direction != "out"
        let startX = center.x + (inward ? -radius - unit * 1.2 : radius + unit * 1.2)
        let endX = center.x + (inward ? radius + unit * 0.4 : -radius - unit * 0.4)
        let start = CGPoint(x: startX, y: y)
        let end = CGPoint(x: endX, y: y)
        var path = Path()
        path.move(to: start)
        path.addLine(to: end)
        context.stroke(path, with: .color(.teal.opacity(0.85)), style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
        drawArrow(context: &context, from: start, to: end, color: .teal)

        let text = [transport.substance, transport.label].compactMap { $0 }.joined(separator: " ")
        if !text.isEmpty {
            context.draw(
                Text(text)
                    .font(.caption2)
                    .foregroundStyle(.teal),
                at: CGPoint(x: (start.x + end.x) / 2, y: y - 10),
                anchor: .bottom
            )
        }
    }

    // MARK: - 图形工具

    private func fillEllipse(
        context: inout GraphicsContext,
        center: CGPoint,
        rx: CGFloat,
        ry: CGFloat,
        fill: Color,
        stroke: Color,
        lineWidth: CGFloat
    ) {
        let rect = CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2)
        let path = Path(ellipseIn: rect)
        context.fill(path, with: .color(fill))
        context.stroke(path, with: .color(stroke), lineWidth: lineWidth)
    }

    private func strokeEllipse(
        context: inout GraphicsContext,
        center: CGPoint,
        rx: CGFloat,
        ry: CGFloat,
        color: Color,
        lineWidth: CGFloat,
        dash: [CGFloat] = []
    ) {
        let rect = CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2)
        let path = Path(ellipseIn: rect)
        let style = dash.isEmpty ? StrokeStyle(lineWidth: lineWidth) : StrokeStyle(lineWidth: lineWidth, dash: dash)
        context.stroke(path, with: .color(color), style: style)
    }

    private func strokePoints(
        _ points: [CGPoint],
        context: inout GraphicsContext,
        color: Color,
        lineWidth: CGFloat,
        dash: [CGFloat] = []
    ) {
        guard let first = points.first else { return }
        var path = Path()
        path.move(to: first)
        for point in points.dropFirst() {
            path.addLine(to: point)
        }
        let style = dash.isEmpty ? StrokeStyle(lineWidth: lineWidth) : StrokeStyle(lineWidth: lineWidth, dash: dash)
        context.stroke(path, with: .color(color), style: style)
    }

    private func fillCircle(
        context: inout GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        fill: Color,
        stroke: Color = .primary,
        lineWidth: CGFloat = 1.2
    ) {
        let rect = CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
        let path = Path(ellipseIn: rect)
        context.fill(path, with: .color(fill))
        context.stroke(path, with: .color(stroke), lineWidth: lineWidth)
    }

    private func fillRect(
        context: inout GraphicsContext,
        rect: CGRect,
        fill: Color,
        stroke: Color = .primary,
        lineWidth: CGFloat = 1.2
    ) {
        let path = Path(rect)
        context.fill(path, with: .color(fill))
        context.stroke(path, with: .color(stroke), lineWidth: lineWidth)
    }

    // MARK: - 细胞器图元

    private func drawOrganelle(context: inout GraphicsContext, organelle: CellOrganelle, at p: CGPoint, unit: CGFloat) {
        let scale = CGFloat(organelle.scale ?? 1)
        let u = unit * scale
        switch organelle.type {
        case "cellWall", "cellMembrane", "capsule", "cytoplasm":
            // 外轮廓/背景由 draw() 统一绘制。
            break
        case "nucleus":
            fillCircle(context: &context, center: p, radius: u * 2.1, fill: .purple.opacity(0.18))
            if hasOrganelle("nucleolus") {
                fillCircle(context: &context, center: p, radius: u * 0.7, fill: .purple.opacity(0.55), stroke: .purple.opacity(0.7))
            }
        case "nucleolus":
            fillCircle(context: &context, center: p, radius: u * 0.8, fill: .purple.opacity(0.55), stroke: .purple.opacity(0.7))
        case "mitochondria":
            fillEllipse(context: &context, center: p, rx: u * 1.7, ry: u * 1.0, fill: .orange.opacity(0.2), stroke: .orange.opacity(0.8), lineWidth: 1.3)
            strokePoints([
                CGPoint(x: p.x - u * 0.9, y: p.y - u * 0.3),
                CGPoint(x: p.x - u * 0.3, y: p.y + u * 0.55),
                CGPoint(x: p.x + u * 0.3, y: p.y - u * 0.45),
                CGPoint(x: p.x + u * 0.9, y: p.y + u * 0.3),
            ], context: &context, color: .orange.opacity(0.6), lineWidth: 0.9)
        case "chloroplast":
            fillEllipse(context: &context, center: p, rx: u * 1.8, ry: u * 1.1, fill: .green.opacity(0.2), stroke: .green.opacity(0.85), lineWidth: 1.3)
            for offset in [-0.8, 0.0, 0.8] {
                fillCircle(context: &context, center: CGPoint(x: p.x + CGFloat(offset) * u, y: p.y), radius: u * 0.32, fill: .green.opacity(0.65), stroke: .green.opacity(0.8), lineWidth: 0.8)
            }
        case "vacuole":
            fillEllipse(context: &context, center: p, rx: u * 2.6, ry: u * 1.8, fill: .cyan.opacity(0.10), stroke: .cyan.opacity(0.65), lineWidth: 1.2)
        case "er":
            strokePoints([
                CGPoint(x: p.x - u * 1.8, y: p.y),
                CGPoint(x: p.x - u * 0.6, y: p.y + u * 0.9),
                CGPoint(x: p.x + u * 0.6, y: p.y - u * 0.7),
                CGPoint(x: p.x + u * 1.8, y: p.y + u * 0.4),
            ], context: &context, color: .blue.opacity(0.7), lineWidth: 1.4)
            for dx in [-1.6, -0.8, 0.0, 0.8, 1.6] {
                fillCircle(context: &context, center: CGPoint(x: p.x + CGFloat(dx) * u, y: p.y + sin(dx) * u * 0.35), radius: u * 0.18, fill: .blue.opacity(0.7))
            }
        case "golgi":
            for dy in [-0.7, 0.0, 0.7] {
                strokePoints([
                    CGPoint(x: p.x - u * 1.4, y: p.y + CGFloat(dy) * u),
                    CGPoint(x: p.x, y: p.y + CGFloat(dy) * u + u * 0.35),
                    CGPoint(x: p.x + u * 1.4, y: p.y + CGFloat(dy) * u),
                ], context: &context, color: .pink.opacity(0.75), lineWidth: 1.4)
            }
            for dx in [-1.2, -0.4, 0.4, 1.2] {
                fillCircle(context: &context, center: CGPoint(x: p.x + CGFloat(dx) * u, y: p.y + u * 0.2), radius: u * 0.16, fill: .pink.opacity(0.65))
            }
        case "ribosome":
            fillCircle(context: &context, center: p, radius: u * 0.28, fill: .brown.opacity(0.75), stroke: .brown.opacity(0.9), lineWidth: 0.8)
        case "lysosome":
            fillCircle(context: &context, center: p, radius: u * 0.9, fill: .red.opacity(0.18), stroke: .red.opacity(0.7), lineWidth: 1.2)
            strokePoints([
                CGPoint(x: p.x - u * 0.35, y: p.y - u * 0.35),
                CGPoint(x: p.x + u * 0.35, y: p.y + u * 0.35),
            ], context: &context, color: .red.opacity(0.6), lineWidth: 1.0)
        case "centrosome":
            strokePoints([CGPoint(x: p.x - u * 0.8, y: p.y), CGPoint(x: p.x + u * 0.8, y: p.y)], context: &context, color: .indigo.opacity(0.8), lineWidth: 1.8)
            strokePoints([CGPoint(x: p.x, y: p.y - u * 0.8), CGPoint(x: p.x, y: p.y + u * 0.8)], context: &context, color: .indigo.opacity(0.8), lineWidth: 1.8)
        case "flagellum":
            var path = Path()
            path.move(to: CGPoint(x: p.x, y: p.y))
            path.addCurve(
                to: CGPoint(x: p.x + u * 4.5, y: p.y + u * 1.8),
                control1: CGPoint(x: p.x + u * 1.2, y: p.y + u * 0.4),
                control2: CGPoint(x: p.x + u * 2.2, y: p.y + u * 2.4)
            )
            context.stroke(path, with: .color(.brown.opacity(0.8)), lineWidth: 1.6)
        case "nucleoid":
            fillEllipse(context: &context, center: p, rx: u * 1.5, ry: u * 1.0, fill: .mint.opacity(0.16), stroke: .mint.opacity(0.8), lineWidth: 1.2)
            var dna = Path()
            dna.move(to: CGPoint(x: p.x - u * 1.1, y: p.y))
            dna.addCurve(
                to: CGPoint(x: p.x + u * 1.1, y: p.y),
                control1: CGPoint(x: p.x - u * 0.4, y: p.y - u * 0.9),
                control2: CGPoint(x: p.x + u * 0.4, y: p.y + u * 0.9)
            )
            context.stroke(dna, with: .color(.mint.opacity(0.9)), lineWidth: 1.2)
        case "plasmid":
            fillCircle(context: &context, center: p, radius: u * 0.55, fill: .teal.opacity(0.15), stroke: .teal.opacity(0.8), lineWidth: 1.0)
        default:
            strokeEllipse(context: &context, center: p, rx: u * 1.0, ry: u * 1.0, color: .secondary.opacity(0.6), lineWidth: 1.1, dash: [3, 3])
        }

        drawAnnotation(context: &context, organelle: organelle, at: p, unit: unit)
    }

    private func drawAnnotation(context: inout GraphicsContext, organelle: CellOrganelle, at p: CGPoint, unit: CGFloat) {
        if let content = organelle.content, !content.isEmpty {
            context.draw(
                Text(content)
                    .font(.system(size: max(unit * 0.65, 8)))
                    .foregroundStyle(.blue),
                at: p,
                anchor: .center
            )
        }
        if let label = organelle.label, !label.isEmpty {
            let isBoundary = organelle.type == "cellWall" || organelle.type == "cellMembrane" || organelle.type == "capsule"
            let labelPoint = isBoundary
                ? CGPoint(x: p.x, y: p.y - unit * (membraneRadius + 2.4))
                : CGPoint(x: p.x, y: p.y - unit * 3.2)
            context.draw(
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.secondary),
                at: labelPoint,
                anchor: .bottom
            )
        }
    }
}

// MARK: - Previews

#Preview("植物细胞模式图") {
    CellCanvasView(block: CellBlock(
        title: "植物细胞模式图",
        cellType: "plant",
        organelles: [
            CellOrganelle(id: "c1", type: "cellWall", x: 0, y: 0, label: "细胞壁"),
            CellOrganelle(id: "c2", type: "cellMembrane", x: 0, y: 0, label: "细胞膜"),
            CellOrganelle(id: "c3", type: "cytoplasm", x: 0, y: 0, label: "细胞质"),
            CellOrganelle(id: "c4", type: "nucleus", x: 0, y: 3, label: "细胞核"),
            CellOrganelle(id: "c5", type: "nucleolus", x: 0, y: 3),
            CellOrganelle(id: "c6", type: "chloroplast", x: -6, y: -3, label: "叶绿体"),
            CellOrganelle(id: "c7", type: "mitochondria", x: 6, y: -3, label: "线粒体"),
            CellOrganelle(id: "c8", type: "vacuole", x: 3, y: 5, label: "液泡"),
            CellOrganelle(id: "c9", type: "ribosome", x: -4, y: 2, label: "核糖体"),
            CellOrganelle(id: "c10", type: "er", x: -3, y: 6, label: "内质网"),
            CellOrganelle(id: "c11", type: "golgi", x: 6, y: 6, label: "高尔基体"),
        ],
        connections: [
            CellConnection(from: "c6", to: "c7", kind: "energy", label: "有机物→能量"),
            CellConnection(from: "c5", to: "c4", kind: "synthesis", label: "核糖体合成"),
        ]
    ))
    .padding()
}

#Preview("动物细胞模式图") {
    CellCanvasView(block: CellBlock(
        title: "动物细胞模式图",
        cellType: "animal",
        organelles: [
            CellOrganelle(id: "c1", type: "cellMembrane", x: 0, y: 0, label: "细胞膜"),
            CellOrganelle(id: "c2", type: "cytoplasm", x: 0, y: 0, label: "细胞质"),
            CellOrganelle(id: "c3", type: "nucleus", x: 0, y: 3, label: "细胞核"),
            CellOrganelle(id: "c4", type: "mitochondria", x: 6, y: -3, label: "线粒体"),
            CellOrganelle(id: "c5", type: "ribosome", x: -4, y: 2, label: "核糖体"),
            CellOrganelle(id: "c6", type: "er", x: -3, y: 6, label: "内质网"),
            CellOrganelle(id: "c7", type: "golgi", x: 6, y: 6, label: "高尔基体"),
            CellOrganelle(id: "c8", type: "lysosome", x: 3, y: 1, label: "溶酶体"),
            CellOrganelle(id: "c9", type: "centrosome", x: -6, y: -3, label: "中心体"),
            CellOrganelle(id: "c10", type: "vacuole", x: 5, y: 4, label: "液泡"),
        ],
        connections: [
            CellConnection(from: "c5", to: "c6", kind: "synthesis", label: "蛋白质合成"),
            CellConnection(from: "c6", to: "c7", kind: "flow", label: "分泌"),
        ],
        transport: [
            CellTransport(id: "t1", substance: "葡萄糖", kind: "facilitated", direction: "in", label: "协助扩散"),
        ]
    ))
    .padding()
}
