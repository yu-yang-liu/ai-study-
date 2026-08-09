import Foundation

extension Date {
    /// ISO 8601 格式（含毫秒）
    nonisolated(unsafe) public static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// 从 ISO 8601 字符串解析
    public static func fromISO8601(_ string: String) -> Date? {
        return iso8601Formatter.date(from: string)
    }

    /// 转为 ISO 8601 字符串
    public func toISO8601() -> String {
        return Self.iso8601Formatter.string(from: self)
    }
}
