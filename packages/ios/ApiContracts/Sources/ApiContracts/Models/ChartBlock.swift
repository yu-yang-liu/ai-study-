import Foundation

// MARK: - ChartSeries / ChartBin / ChartSlice

/// 柱状/折线图的数值系列。
public struct ChartSeries: Codable, Sendable, Equatable {
    public let name: String?
    public let values: [Double]
    public let color: String?

    public init(name: String?, values: [Double], color: String? = nil) {
        self.name = name
        self.values = values
        self.color = color
    }
}

/// 频率分布直方图的区间。
public struct ChartBin: Codable, Sendable, Equatable {
    public let range: [Double]
    public let count: Int

    public init(range: [Double], count: Int) {
        self.range = range
        self.count = count
    }
}

/// 饼图的扇区。
public struct ChartSlice: Codable, Sendable, Equatable {
    public let label: String
    public let value: Double

    public init(label: String, value: Double) {
        self.label = label
        self.value = value
    }
}

// MARK: - ChartBlock

/// 统计图表（P1-1 · Visual AST 扩展：数据驱动图元）。
///
/// 对应后端 `ChartBlock`：`kind` 五选一（bar/line/scatter/histogram/pie）。
/// 字段可选以兼容解码；渲染器按 `kind` 分发，缺失数据时降级为空图。
public struct ChartBlock: Codable, Sendable, Equatable {
    public let kind: String
    public let title: String?
    public let xLabel: String?
    public let yLabel: String?
    public let categories: [String]?
    public let series: [ChartSeries]?
    public let points: [[Double]]?
    public let bins: [ChartBin]?
    public let slices: [ChartSlice]?

    public init(
        kind: String,
        title: String? = nil,
        xLabel: String? = nil,
        yLabel: String? = nil,
        categories: [String]? = nil,
        series: [ChartSeries]? = nil,
        points: [[Double]]? = nil,
        bins: [ChartBin]? = nil,
        slices: [ChartSlice]? = nil
    ) {
        self.kind = kind
        self.title = title
        self.xLabel = xLabel
        self.yLabel = yLabel
        self.categories = categories
        self.series = series
        self.points = points
        self.bins = bins
        self.slices = slices
    }
}
