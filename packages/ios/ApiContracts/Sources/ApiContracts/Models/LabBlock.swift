import Foundation

/// 实验器材（P2-1 化学实验装置图；坐标数学系 y 向上）。
public struct LabApparatus: Codable, Sendable, Equatable {
    public let id: String
    public let type: String
    public let x: Double
    public let y: Double
    /// 器材朝向；缺省 vertical（数学坐标 y 向上）。
    public let orientation: String?
    /// 器材尺寸倍数，缺省 1（0.6–2.5）。
    public let scale: Double?
    public let label: String?
    /// 内容物/介质，如「水」「滤液」「MnO2」等。
    public let content: String?

    public init(id: String, type: String, x: Double, y: Double, orientation: String? = nil, scale: Double? = nil, label: String? = nil, content: String? = nil) {
        self.id = id
        self.type = type
        self.x = x
        self.y = y
        self.orientation = orientation
        self.scale = scale
        self.label = label
        self.content = content
    }
}

/// 器材间连接/流向（tube 导管、gasFlow 气体流向、liquidFlow 液体流向、heat 加热）。
public struct LabConnection: Codable, Sendable, Equatable {
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

/// 实验装置图（P2-1 化学实验：制气 / 蒸馏 / 过滤 / 萃取分液等）。
public struct LabBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let apparatus: [LabApparatus]
    public let connections: [LabConnection]

    public init(title: String?, apparatus: [LabApparatus], connections: [LabConnection]) {
        self.title = title
        self.apparatus = apparatus
        self.connections = connections
    }
}
