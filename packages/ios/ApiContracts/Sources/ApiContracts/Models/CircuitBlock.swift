import Foundation

// MARK: - CircuitNode / CircuitWire

/// 电路元件节点（符号 + 连接点坐标）。
public struct CircuitNode: Codable, Sendable, Equatable {
    public let id: String
    public let type: String
    public let x: Double
    public let y: Double
    public let orientation: String?
    public let label: String?
    public let value: String?
    public let open: Bool?

    public init(
        id: String,
        type: String,
        x: Double,
        y: Double,
        orientation: String? = nil,
        label: String? = nil,
        value: String? = nil,
        open: Bool? = nil
    ) {
        self.id = id
        self.type = type
        self.x = x
        self.y = y
        self.orientation = orientation
        self.label = label
        self.value = value
        self.open = open
    }
}

/// 电路导线（引用节点 id）。
public struct CircuitWire: Codable, Sendable, Equatable {
    public let from: String
    public let to: String
    public let style: String?

    public init(from: String, to: String, style: String? = nil) {
        self.from = from
        self.to = to
        self.style = style
    }
}

// MARK: - CircuitBlock

/// 电路图（P1-2 · Visual AST 扩展：元件符号 + 拓扑）。
///
/// 对应后端 `CircuitBlock`：nodes 为元件（id/type/坐标/朝向/参数），
/// wires 为连接关系（from/to 引用节点 id）。字段可选以兼容解码。
public struct CircuitBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let nodes: [CircuitNode]
    public let wires: [CircuitWire]

    public init(title: String?, nodes: [CircuitNode], wires: [CircuitWire]) {
        self.title = title
        self.nodes = nodes
        self.wires = wires
    }
}
