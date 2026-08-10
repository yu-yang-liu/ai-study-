import SwiftUI
import ApiContracts

/// 统计图表渲染器（P1-1 · Visual AST 扩展）。
///
/// 按 `ChartBlock.kind` 分发：bar / line / scatter / histogram / pie。
/// 数据驱动、纯 Canvas 绘制，无图片资产。
public struct ChartCanvasView: View {
    let block: ChartBlock

    public init(block: ChartBlock) {
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
                switch block.kind {
                case "bar":
                    drawBar(context: &context, size: size)
                case "line":
                    drawLine(context: &context, size: size)
                case "scatter":
                    drawScatter(context: &context, size: size)
                case "histogram":
                    drawHistogram(context: &context, size: size)
                case "pie":
                    drawPie(context: &context, size: size)
                default:
                    break
                }
            }
            .aspectRatio(4.0 / 3.0, contentMode: .fit)
            .padding(.horizontal, 8)

            if block.kind == "pie", let slices = block.slices, !slices.isEmpty {
                pieLegend(slices: slices)
            } else if let xLabel = block.xLabel, !xLabel.isEmpty {
                Text(xLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 绘制

    private struct PlotArea {
        let origin: CGPoint
        let size: CGSize
    }

    private func plotArea(in size: CGSize) -> PlotArea {
        let left: CGFloat = 32
        let bottom: CGFloat = 20
        let top: CGFloat = 8
        let right: CGFloat = 8
        return PlotArea(
            origin: CGPoint(x: left, y: top),
            size: CGSize(
                width: max(size.width - left - right, 10),
                height: max(size.height - top - bottom, 10)
            )
        )
    }

    private func drawAxes(context: inout GraphicsContext, area: PlotArea, maxValue: Double) {
        var path = Path()
        path.move(to: area.origin)
        path.addLine(to: CGPoint(x: area.origin.x, y: area.origin.y + area.size.height))
        path.addLine(to: CGPoint(x: area.origin.x + area.size.width, y: area.origin.y + area.size.height))
        context.stroke(path, with: .color(.secondary.opacity(0.6)), lineWidth: 1)

        // 水平网格线 + y 轴刻度
        let ticks = 4
        for i in 1...ticks {
            let fraction = CGFloat(i) / CGFloat(ticks)
            let y = area.origin.y + area.size.height * (1 - fraction)
            var grid = Path()
            grid.move(to: CGPoint(x: area.origin.x, y: y))
            grid.addLine(to: CGPoint(x: area.origin.x + area.size.width, y: y))
            context.stroke(grid, with: .color(.secondary.opacity(0.15)), lineWidth: 0.5)
            let value = maxValue * Double(i) / Double(ticks)
            context.draw(
                Text(value.formatted(.number.precision(.fractionLength(0...1))))
                    .font(.caption2)
                    .foregroundStyle(.secondary),
                at: CGPoint(x: area.origin.x - 4, y: y),
                anchor: .trailing
            )
        }
    }

    private func seriesColor(index: Int, explicit: String?) -> Color {
        if let explicit, let color = Color(hex: explicit) {
            return color
        }
        let palette: [Color] = [.blue, .orange, .green, .red]
        return palette[index % palette.count]
    }

    // MARK: bar / line（共享数据布局）

    private func barLineData() -> (categories: [String], series: [ChartSeries], maxValue: Double) {
        let categories = block.categories ?? []
        let series = block.series ?? []
        let maxValue = series.flatMap(\.values).max() ?? 1
        return (categories, series, max(maxValue, 1))
    }

    private func categoryX(index: Int, count: Int, area: PlotArea) -> CGFloat {
        guard count > 1 else { return area.origin.x + area.size.width / 2 }
        return area.origin.x + area.size.width * CGFloat(index) / CGFloat(count - 1)
    }

    private func valueY(value: Double, maxValue: Double, area: PlotArea) -> CGFloat {
        let fraction = maxValue <= 0 ? 0 : CGFloat(value / maxValue)
        return area.origin.y + area.size.height * (1 - fraction)
    }

    private func drawBar(context: inout GraphicsContext, size: CGSize) {
        let area = plotArea(in: size)
        let (categories, series, maxValue) = barLineData()
        guard !categories.isEmpty, !series.isEmpty else { return }
        drawAxes(context: &context, area: area, maxValue: maxValue)

        let groupWidth = area.size.width / CGFloat(categories.count)
        let barWidth = groupWidth / CGFloat(series.count) * 0.72
        for (catIndex, _) in categories.enumerated() {
            let groupCenter = area.origin.x + groupWidth * (CGFloat(catIndex) + 0.5)
            for (seriesIndex, chartSeries) in series.enumerated() {
                guard seriesIndex < chartSeries.values.count, catIndex < chartSeries.values.count else { continue }
                let value = chartSeries.values[catIndex]
                let x = groupCenter - groupWidth / 2 + groupWidth * CGFloat(seriesIndex) / CGFloat(series.count) + (groupWidth / CGFloat(series.count) - barWidth) / 2
                let y = valueY(value: value, maxValue: maxValue, area: area)
                let rect = CGRect(
                    x: x,
                    y: y,
                    width: barWidth,
                    height: max(area.origin.y + area.size.height - y, 1)
                )
                let path = Path(roundedRect: rect, cornerRadius: 1)
                context.fill(path, with: .color(seriesColor(index: seriesIndex, explicit: chartSeries.color)))
            }
        }

        // 分类刻度
        for (index, category) in categories.enumerated() {
            let x = categoryX(index: index, count: categories.count, area: area)
            context.draw(
                Text(category).font(.caption2).foregroundStyle(.secondary),
                at: CGPoint(x: x, y: area.origin.y + area.size.height + 12),
                anchor: .top
            )
        }
    }

    private func drawLine(context: inout GraphicsContext, size: CGSize) {
        let area = plotArea(in: size)
        let (categories, series, maxValue) = barLineData()
        guard !categories.isEmpty, !series.isEmpty else { return }
        drawAxes(context: &context, area: area, maxValue: maxValue)

        for (seriesIndex, chartSeries) in series.enumerated() {
            let color = seriesColor(index: seriesIndex, explicit: chartSeries.color)
            var path = Path()
            for (index, _) in categories.enumerated() {
                guard index < chartSeries.values.count else { continue }
                let point = CGPoint(
                    x: categoryX(index: index, count: categories.count, area: area),
                    y: valueY(value: chartSeries.values[index], maxValue: maxValue, area: area)
                )
                if index == 0 {
                    path.move(to: point)
                } else {
                    path.addLine(to: point)
                }
            }
            context.stroke(path, with: .color(color), lineWidth: 2)
            for (index, _) in categories.enumerated() where index < chartSeries.values.count {
                let point = CGPoint(
                    x: categoryX(index: index, count: categories.count, area: area),
                    y: valueY(value: chartSeries.values[index], maxValue: maxValue, area: area)
                )
                let dot = Path(ellipseIn: CGRect(x: point.x - 3, y: point.y - 3, width: 6, height: 6))
                context.fill(dot, with: .color(color))
            }
        }

        for (index, category) in categories.enumerated() {
            let x = categoryX(index: index, count: categories.count, area: area)
            context.draw(
                Text(category).font(.caption2).foregroundStyle(.secondary),
                at: CGPoint(x: x, y: area.origin.y + area.size.height + 12),
                anchor: .top
            )
        }
    }

    // MARK: scatter

    private func drawScatter(context: inout GraphicsContext, size: CGSize) {
        let area = plotArea(in: size)
        let points = block.points ?? []
        guard !points.isEmpty else { return }
        let xs = points.compactMap { $0.first }
        let ys = points.compactMap { $0.count > 1 ? $0[1] : nil }
        guard let xMin = xs.min(), let xMax = xs.max(),
              let yMin = ys.min(), let yMax = ys.max() else { return }
        let xRange = max(xMax - xMin, 1)
        let yRange = max(yMax - yMin, 1)
        drawAxes(context: &context, area: area, maxValue: yMax)

        for point in points {
            guard point.count >= 2 else { continue }
            let x = area.origin.x + area.size.width * CGFloat((point[0] - xMin) / xRange)
            let y = area.origin.y + area.size.height * (1 - CGFloat((point[1] - yMin) / yRange))
            let dot = Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6))
            context.fill(dot, with: .color(.blue))
        }

        context.draw(
            Text(xMin.formatted()).font(.caption2).foregroundStyle(.secondary),
            at: CGPoint(x: area.origin.x, y: area.origin.y + area.size.height + 12),
            anchor: .topLeading
        )
        context.draw(
            Text(xMax.formatted()).font(.caption2).foregroundStyle(.secondary),
            at: CGPoint(x: area.origin.x + area.size.width, y: area.origin.y + area.size.height + 12),
            anchor: .topTrailing
        )
    }

    // MARK: histogram

    private func drawHistogram(context: inout GraphicsContext, size: CGSize) {
        let area = plotArea(in: size)
        let bins = block.bins ?? []
        guard !bins.isEmpty else { return }
        let maxCount = Double(bins.map(\.count).max() ?? 1)
        drawAxes(context: &context, area: area, maxValue: maxCount)

        let binWidth = area.size.width / CGFloat(bins.count)
        for (index, bin) in bins.enumerated() {
            let x = area.origin.x + binWidth * CGFloat(index)
            let y = valueY(value: Double(bin.count), maxValue: maxCount, area: area)
            let rect = CGRect(
                x: x + 1,
                y: y,
                width: max(binWidth - 2, 1),
                height: max(area.origin.y + area.size.height - y, 1)
            )
            context.fill(Path(rect), with: .color(.blue.opacity(0.75)))
            context.stroke(Path(rect), with: .color(.blue), lineWidth: 0.5)
        }

        // 首尾区间标签
        if let first = bins.first, let last = bins.last {
            context.draw(
                Text(first.range.first?.formatted() ?? "").font(.caption2).foregroundStyle(.secondary),
                at: CGPoint(x: area.origin.x, y: area.origin.y + area.size.height + 12),
                anchor: .topLeading
            )
            context.draw(
                Text(last.range.last?.formatted() ?? "").font(.caption2).foregroundStyle(.secondary),
                at: CGPoint(x: area.origin.x + area.size.width, y: area.origin.y + area.size.height + 12),
                anchor: .topTrailing
            )
        }
    }

    // MARK: pie

    private func drawPie(context: inout GraphicsContext, size: CGSize) {
        let slices = block.slices ?? []
        let total = slices.reduce(0) { $0 + $1.value }
        guard total > 0 else { return }

        let side = min(size.width, size.height) * 0.72
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = side / 2
        var startAngle = -Double.pi / 2

        for (index, slice) in slices.enumerated() {
            let sweep = Double.pi * 2 * (slice.value / total)
            var path = Path()
            path.move(to: center)
            path.addArc(
                center: center,
                radius: radius,
                startAngle: .radians(startAngle),
                endAngle: .radians(startAngle + sweep),
                clockwise: false
            )
            path.closeSubpath()
            context.fill(path, with: .color(seriesColor(index: index, explicit: nil)))
            startAngle += sweep
        }
    }

    private func pieLegend(slices: [ChartSlice]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), alignment: .leading)], spacing: 4) {
            ForEach(Array(slices.enumerated()), id: \.offset) { index, slice in
                HStack(spacing: 4) {
                    Circle()
                        .fill(seriesColor(index: index, explicit: nil))
                        .frame(width: 8, height: 8)
                    Text("\(slice.label) \(slice.value.formatted(.number.precision(.fractionLength(0...1))))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - Color(hex:)

extension Color {
    /// 解析 `#RRGGBB`；失败返回 nil。
    init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt64(text, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Previews

#Preview("柱状图") {
    ChartCanvasView(block: ChartBlock(
        kind: "bar",
        title: "数学成绩等级分布",
        xLabel: "等级",
        categories: ["A", "B", "C", "D"],
        series: [ChartSeries(name: "人数", values: [12, 18, 7, 3])]
    ))
    .padding()
}

#Preview("折线图") {
    ChartCanvasView(block: ChartBlock(
        kind: "line",
        title: "一周最高气温变化",
        yLabel: "气温（℃）",
        categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        series: [ChartSeries(name: "最高气温", values: [18, 20, 22, 19, 24, 26, 25])]
    ))
    .padding()
}

#Preview("散点图") {
    ChartCanvasView(block: ChartBlock(
        kind: "scatter",
        title: "身高与体重散点图",
        xLabel: "身高（cm）",
        yLabel: "体重（kg）",
        points: [[165, 52], [170, 60], [172, 63], [175, 68], [180, 75], [162, 48]]
    ))
    .padding()
}

#Preview("直方图") {
    ChartCanvasView(block: ChartBlock(
        kind: "histogram",
        title: "数学成绩频率分布直方图",
        bins: [
            ChartBin(range: [60, 70], count: 8),
            ChartBin(range: [70, 80], count: 15),
            ChartBin(range: [80, 90], count: 18),
            ChartBin(range: [90, 100], count: 9),
        ]
    ))
    .padding()
}

#Preview("饼图") {
    ChartCanvasView(block: ChartBlock(
        kind: "pie",
        title: "家庭月支出占比",
        slices: [
            ChartSlice(label: "食品", value: 40),
            ChartSlice(label: "住房", value: 25),
            ChartSlice(label: "交通", value: 15),
            ChartSlice(label: "教育", value: 12),
            ChartSlice(label: "其他", value: 8),
        ]
    ))
    .padding()
}
