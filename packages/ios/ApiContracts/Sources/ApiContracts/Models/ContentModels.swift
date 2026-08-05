import Foundation

/// 内容记录，对应后端 ContentRecord 接口
public struct ContentRecord: Codable, Sendable, Identifiable {
    public let id: String
    public let phase: String          // 'high'
    public let subject: String
    public let contentType: String
    public let title: String
    public let data: [String: AnyCodable]

    enum CodingKeys: String, CodingKey {
        case id, phase, subject
        case contentType = "content_type"
        case title, data
    }
}

/// 简单 Any 类型编码器，用于 data: Record<string, unknown>
public enum AnyCodable: Codable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case dictionary([String: AnyCodable])
    case array([AnyCodable])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self = .dictionary(dict)
        } else if let array = try? container.decode([AnyCodable].self) {
            self = .array(array)
        } else if container.decodeNil() {
            self = .null
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported type")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .dictionary(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
