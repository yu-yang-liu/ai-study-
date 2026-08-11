import ApiContracts
import CoreGraphics
import SwiftUI

public struct MolecularCanvasView: View {
    public let block: MolecularBlock

    public init(block: MolecularBlock) {
        self.block = block
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = block.title, !title.isEmpty {
                Text(title)
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            Canvas { context, size in
                let bounds = molecularBounds()
                let transformer = MolecularTransformer(bounds: bounds, size: size)
                for bond in block.bonds {
                    guard let from = block.atoms.first(where: { $0.id == bond.from }),
                          let to = block.atoms.first(where: { $0.id == bond.to }) else { continue }
                    drawBond(
                        context: &context,
                        from: transformer.point(x: from.x, y: from.y),
                        to: transformer.point(x: to.x, y: to.y),
                        order: bond.order
                    )
                }
                for atom in block.atoms {
                    let point = transformer.point(x: atom.x, y: atom.y)
                    drawAtom(context: &context, atom: atom, point: point)
                }
            }
            .frame(minHeight: 180)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func molecularBounds() -> (minX: Double, maxX: Double, minY: Double, maxY: Double) {
        guard let first = block.atoms.first else { return (-1, 1, -1, 1) }
        var minX = first.x
        var maxX = first.x
        var minY = first.y
        var maxY = first.y
        for atom in block.atoms.dropFirst() {
            minX = min(minX, atom.x)
            maxX = max(maxX, atom.x)
            minY = min(minY, atom.y)
            maxY = max(maxY, atom.y)
        }
        return (minX - 1, maxX + 1, minY - 1, maxY + 1)
    }

    private func drawBond(
        context: inout GraphicsContext,
        from: CGPoint,
        to: CGPoint,
        order: Int
    ) {
        let dx = to.x - from.x
        let dy = to.y - from.y
        let length = max(hypot(dx, dy), 1)
        let px = -dy / length * 3
        let py = dx / length * 3
        let offsets = order >= 3 ? [-4.0, 0.0, 4.0] : (order == 2 ? [-3.0, 3.0] : [0.0])
        for offset in offsets {
            let path = Path { path in
                path.move(to: CGPoint(x: from.x + px * offset / 3, y: from.y + py * offset / 3))
                path.addLine(to: CGPoint(x: to.x + px * offset / 3, y: to.y + py * offset / 3))
            }
            context.stroke(path, with: .color(.gray), lineWidth: 2)
        }
    }

    private func drawAtom(context: inout GraphicsContext, atom: MolecularAtom, point: CGPoint) {
        let radius: CGFloat = 18
        let color = atomColor(atom.symbol)
        context.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(color))
        context.stroke(
            Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)),
            with: .color(.white),
            lineWidth: 1
        )
        context.draw(
            Text(atom.label ?? atom.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white),
            at: point
        )
    }

    private func atomColor(_ symbol: String) -> Color {
        switch symbol.uppercased() {
        case "H": return .gray
        case "O": return .red
        case "N": return .blue
        case "C": return .black
        case "S": return .yellow
        case "CL": return .green
        default: return .purple
        }
    }
}

private struct MolecularTransformer {
    let bounds: (minX: Double, maxX: Double, minY: Double, maxY: Double)
    let size: CGSize

    func point(x: Double, y: Double) -> CGPoint {
        let scale = min(
            Double(size.width) / max(bounds.maxX - bounds.minX, 0.001),
            Double(size.height) / max(bounds.maxY - bounds.minY, 0.001)
        )
        let offsetX = (Double(size.width) - (bounds.maxX - bounds.minX) * scale) / 2
        let offsetY = (Double(size.height) - (bounds.maxY - bounds.minY) * scale) / 2
        return CGPoint(
            x: offsetX + (x - bounds.minX) * scale,
            y: offsetY + (bounds.maxY - y) * scale
        )
    }
}
