import Foundation
import Network

/// 网络可达性监测器
/// 使用 NWPathMonitor 实时监听网络状态变化
@MainActor
public final class NetworkMonitor: ObservableObject, Sendable {
    @Published public private(set) var isConnected = true
    @Published public private(set) var connectionType: ConnectionType = .unknown

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.aistudy.network-monitor")

    public enum ConnectionType: String, Sendable {
        case wifi
        case cellular
        case wired
        case other
        case unknown
    }

    public init() {
        startMonitoring()
    }

    deinit {
        monitor.cancel()
    }

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.updateStatus(path)
            }
        }
        monitor.start(queue: queue)
    }

    private func updateStatus(_ path: NWPath) {
        isConnected = path.status == .satisfied

        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .wired
        } else if path.usesInterfaceType(.other) {
            connectionType = .other
        } else {
            connectionType = .unknown
        }
    }
}
