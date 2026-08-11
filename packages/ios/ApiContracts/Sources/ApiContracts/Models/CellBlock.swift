import Foundation

/// 细胞器（P2-2 生物细胞模式图；坐标数学系，y 向上）。
public struct CellOrganelle: Codable, Sendable, Equatable {
    public let id: String
    public let type: String
    public let x: Double
    public let y: Double
    /// 细胞器尺寸倍数，缺省 1（0.6–2.5）。
    public let scale: Double?
    public let label: String?
    /// 功能/物质说明，如「有氧呼吸主要场所」「DNA」。
    public let content: String?

    public init(id: String, type: String, x: Double, y: Double, scale: Double? = nil, label: String? = nil, content: String? = nil) {
        self.id = id
        self.type = type
        self.x = x
        self.y = y
        self.scale = scale
        self.label = label
        self.content = content
    }
}

/// 细胞器间协作/流向（flow 物质流向 / energy 能量 / synthesis 合成 / signal 信号）。
public struct CellConnection: Codable, Sendable, Equatable {
    public let from: String
    public let to: String
    public let kind: String?
    public let label: String?

    public init(from: String, to: String, kind: String? = nil, label: String? = nil) {
        self.from = from
        self.to = to
        self.kind = kind
        self.label = label
    }
}

/// 跨膜运输（diffusion 自由扩散 / facilitated 协助扩散 / activeTransport 主动运输 / osmosis 渗透）。
public struct CellTransport: Codable, Sendable, Equatable {
    public let id: String
    public let substance: String
    public let kind: String
    public let direction: String
    public let label: String?

    public init(id: String, substance: String, kind: String, direction: String, label: String? = nil) {
        self.id = id
        self.substance = substance
        self.kind = kind
        self.direction = direction
        self.label = label
    }
}

/// 细胞模式图（P2-2 生物：动植物/原核细胞 + 跨膜运输）。
public struct CellBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let cellType: String
    public let organelles: [CellOrganelle]
    public let connections: [CellConnection]?
    public let transport: [CellTransport]?

    public init(
        title: String? = nil,
        cellType: String,
        organelles: [CellOrganelle],
        connections: [CellConnection]? = nil,
        transport: [CellTransport]? = nil
    ) {
        self.title = title
        self.cellType = cellType
        self.organelles = organelles
        self.connections = connections
        self.transport = transport
    }
}
