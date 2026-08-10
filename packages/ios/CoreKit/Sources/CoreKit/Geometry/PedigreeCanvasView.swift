import SwiftUI
import ApiContracts

/// 遗传系谱图渲染器（P1-4）。
///
/// 世代按行排列（I/II/III…），□ 男 / ○ 女 / ◆ 未知；实心患病、半实心携带、
/// 斜线已故、上方箭头先证者；婚姻横向连线 + 子女竖线与同胞横线。
public struct PedigreeCanvasView: View {
    let block: PedigreeBlock

    public init(block: PedigreeBlock) {
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

    private static let romanNumerals = ["I", "II", "III", "IV", "V", "VI"]

    private func layout(in size: CGSize) -> ([String: CGPoint], [Int: (y: CGFloat, label: String?)]) {
        let symbolSize: CGFloat = 20
        let rowHeight = min(56, max(40, (size.height - 20) / CGFloat(max(block.generations.count, 1))))
        let leftPad: CGFloat = 38
        var positions: [String: CGPoint] = [:]
        var rowInfo: [Int: (y: CGFloat, label: String?)] = [:]
        for (rowIndex, generation) in block.generations.enumerated() {
            let y = 14 + CGFloat(rowIndex) * rowHeight + symbolSize / 2
            rowInfo[rowIndex] = (y, generation.label)
            let count = generation.individuals.count
            let usableWidth = max(size.width - leftPad - 12, 10)
            for (index, individual) in generation.individuals.enumerated() {
                let x = count <= 1
                    ? leftPad + usableWidth / 2
                    : leftPad + usableWidth * CGFloat(index) / CGFloat(count - 1)
                positions[individual.id] = CGPoint(x: x, y: y)
            }
        }
        return (positions, rowInfo)
    }

    private func draw(context: inout GraphicsContext, size: CGSize) {
        let (positions, rowInfo) = layout(in: size)
        let symbolSize: CGFloat = 20

        // 婚姻 / 子女连线
        for marriage in block.marriages {
            guard marriage.spouses.count >= 2,
                  let first = marriage.spouses.first.flatMap({ positions[$0] }),
                  let second = marriage.spouses.dropFirst().first.flatMap({ positions[$0] }) else { continue }
            let lineY = max(first.y, second.y) + symbolSize / 2 + 5
            var marriagePath = Path()
            marriagePath.move(to: CGPoint(x: first.x, y: lineY))
            marriagePath.addLine(to: CGPoint(x: second.x, y: lineY))
            context.stroke(marriagePath, with: .color(.secondary), lineWidth: 1)

            let children = marriage.children ?? []
            let childPoints = children.compactMap { positions[$0] }
            guard !childPoints.isEmpty else { continue }
            let childY = childPoints.map(\.y).min() ?? lineY + 20
            let midX = (first.x + second.x) / 2
            var down = Path()
            down.move(to: CGPoint(x: midX, y: lineY))
            down.addLine(to: CGPoint(x: midX, y: childY - symbolSize / 2))
            context.stroke(down, with: .color(.secondary), lineWidth: 1)

            if childPoints.count > 1, let minX = childPoints.map(\.x).min(), let maxX = childPoints.map(\.x).max() {
                var sibling = Path()
                sibling.move(to: CGPoint(x: minX, y: childY - symbolSize / 2))
                sibling.addLine(to: CGPoint(x: maxX, y: childY - symbolSize / 2))
                context.stroke(sibling, with: .color(.secondary), lineWidth: 1)
            }
            for point in childPoints {
                var drop = Path()
                drop.move(to: CGPoint(x: point.x, y: childY - symbolSize / 2))
                drop.addLine(to: CGPoint(x: point.x, y: point.y + symbolSize / 2))
                context.stroke(drop, with: .color(.secondary), lineWidth: 1)
            }
        }

        // 世代标签
        for (rowIndex, info) in rowInfo {
            let label = info.label ?? (Self.romanNumerals.indices.contains(rowIndex) ? Self.romanNumerals[rowIndex] : "")
            context.draw(
                Text(label).font(.caption).foregroundStyle(.secondary),
                at: CGPoint(x: 12, y: info.y),
                anchor: .leading
            )
        }

        // 个体符号
        for generation in block.generations {
            for individual in generation.individuals {
                guard let point = positions[individual.id] else { continue }
                drawSymbol(context: &context, individual: individual, at: point, size: symbolSize)
            }
        }
    }

    private func drawSymbol(
        context: inout GraphicsContext,
        individual: PedigreeIndividual,
        at point: CGPoint,
        size: CGFloat
    ) {
        let rect = CGRect(x: point.x - size / 2, y: point.y - size / 2, width: size, height: size)
        let fill: Color = individual.affected == true ? .primary : .white
        let strokeColor = Color.primary

        var shape: Path
        switch individual.gender ?? "unknown" {
        case "male":
            shape = Path(rect)
        case "female":
            shape = Path(ellipseIn: rect)
        default:
            shape = Path { path in
                path.move(to: CGPoint(x: rect.midX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
                path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
                path.closeSubpath()
            }
        }
        context.fill(shape, with: .color(fill))
        context.stroke(shape, with: .color(strokeColor), lineWidth: 1.2)

        if individual.carrier == true {
            var half = Path()
            half.addArc(
                center: point,
                radius: size / 2,
                startAngle: .degrees(-90),
                endAngle: .degrees(90),
                clockwise: false
            )
            half.closeSubpath()
            context.fill(half, with: .color(.primary.opacity(0.45)))
        }

        if individual.deceased == true {
            var slash = Path()
            slash.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            slash.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            context.stroke(slash, with: .color(.red), lineWidth: 1.4)
        }

        if individual.proband == true {
            var arrow = Path()
            arrow.move(to: CGPoint(x: point.x - 4, y: point.y - size / 2 - 9))
            arrow.addLine(to: CGPoint(x: point.x + 4, y: point.y - size / 2 - 9))
            arrow.addLine(to: CGPoint(x: point.x, y: point.y - size / 2 - 2))
            arrow.closeSubpath()
            context.fill(arrow, with: .color(.red))
        }

        let caption = individual.label ?? individual.id
        context.draw(
            Text(caption).font(.caption2).foregroundStyle(.secondary),
            at: CGPoint(x: point.x, y: point.y + size / 2 + 8),
            anchor: .top
        )
    }
}

#Preview("遗传系谱图") {
    PedigreeCanvasView(block: PedigreeBlock(
        title: "某遗传病系谱图",
        generations: [
            PedigreeGeneration(
                label: "I",
                individuals: [
                    PedigreeIndividual(id: "I1", gender: "male", affected: false),
                    PedigreeIndividual(id: "I2", gender: "female", affected: false),
                ]
            ),
            PedigreeGeneration(
                label: "II",
                individuals: [
                    PedigreeIndividual(id: "II1", gender: "male", affected: true),
                    PedigreeIndividual(id: "II2", gender: "female", affected: false, carrier: true),
                    PedigreeIndividual(id: "II3", gender: "male", affected: false),
                ]
            ),
            PedigreeGeneration(
                label: "III",
                individuals: [PedigreeIndividual(id: "III1", gender: "female", affected: true, proband: true)]
            ),
        ],
        marriages: [
            PedigreeMarriage(spouses: ["I1", "I2"], children: ["II1", "II2"]),
            PedigreeMarriage(spouses: ["II2", "II3"], children: ["III1"]),
        ]
    ))
    .padding()
}
