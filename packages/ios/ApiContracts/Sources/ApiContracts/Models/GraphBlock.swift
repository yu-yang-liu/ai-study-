import Foundation

/// 关系图节点（食物链/网：生产者/消费者/分解者等）。
public struct GraphNode: Codable, Sendable, Equatable {
    public let id: String
    public let label: String
    public let kind: String?
    public let x: Double
    public let y: Double

    public init(id: String, label: String, kind: String? = nil, x: Double, y: Double) {
        self.id = id
        self.label = label
        self.kind = kind
        self.x = x
        self.y = y
    }
}

/// 有向边（from → to 表示能量流向）。
public struct GraphEdge: Codable, Sendable, Equatable {
    public let from: String
    public let to: String
    public let label: String?
    public let style: String?

    public init(from: String, to: String, label: String? = nil, style: String? = nil) {
        self.from = from
        self.to = to
        self.label = label
        self.style = style
    }
}

/// 关系图（P1-4 · Visual AST 扩展：食物链/食物网/通用有向图）。
public struct GraphBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let nodes: [GraphNode]
    public let edges: [GraphEdge]

    public init(title: String?, nodes: [GraphNode], edges: [GraphEdge]) {
        self.title = title
        self.nodes = nodes
        self.edges = edges
    }
}
