import Foundation
import Darwin
import SystemConfiguration

/// ネットワークのスループット（上り/下り）・主要インターフェース名・ローカルIPを取得する。
final class NetworkMonitor {

    private var prevIn: UInt64 = 0
    private var prevOut: UInt64 = 0
    private var prevTime: Date?

    func sample() -> NetworkStats {
        var stats = NetworkStats()

        let now = Date()
        let (inBytes, outBytes) = totalBytes()

        if let prevTime, now.timeIntervalSince(prevTime) > 0,
           inBytes >= prevIn, outBytes >= prevOut {
            let elapsed = now.timeIntervalSince(prevTime)
            stats.downloadBps = Double(inBytes - prevIn) / elapsed
            stats.uploadBps = Double(outBytes - prevOut) / elapsed
        }

        prevIn = inBytes
        prevOut = outBytes
        prevTime = now

        let primary = primaryInterface()
        stats.interfaceName = displayName(for: primary)
        stats.localIP = localIP(for: primary) ?? "—"
        return stats
    }

    /// アニメ速度用に上り下り合計(bytes/秒)。
    func combinedBytesPerSecond(_ stats: NetworkStats) -> Double {
        stats.uploadBps + stats.downloadBps
    }

    // MARK: - 累積バイト数

    private func totalBytes() -> (inBytes: UInt64, outBytes: UInt64) {
        var inSum: UInt64 = 0
        var outSum: UInt64 = 0
        var ifaddrPtr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddrPtr) == 0 else { return (0, 0) }
        defer { freeifaddrs(ifaddrPtr) }

        var ptr = ifaddrPtr
        while let current = ptr {
            defer { ptr = current.pointee.ifa_next }
            guard let addr = current.pointee.ifa_addr,
                  addr.pointee.sa_family == UInt8(AF_LINK) else { continue }

            let name = String(cString: current.pointee.ifa_name)
            if name.hasPrefix("lo") { continue }

            if let data = current.pointee.ifa_data {
                let nd = data.assumingMemoryBound(to: if_data.self)
                inSum += UInt64(nd.pointee.ifi_ibytes)
                outSum += UInt64(nd.pointee.ifi_obytes)
            }
        }

        return (inSum, outSum)
    }

    // MARK: - インターフェース情報

    /// 主要(デフォルトルート)インターフェースの BSD 名（例: en0）。
    private func primaryInterface() -> String? {
        guard let store = SCDynamicStoreCreate(nil, "RunThunder" as CFString, nil, nil),
              let dict = SCDynamicStoreCopyValue(store, "State:/Network/Global/IPv4" as CFString) as? [String: Any]
        else { return nil }
        return dict["PrimaryInterface"] as? String
    }

    /// BSD 名をローカライズ表示名（Wi-Fi / Ethernet など）へ。
    private func displayName(for bsdName: String?) -> String {
        guard let bsdName else { return "—" }
        if let interfaces = SCNetworkInterfaceCopyAll() as? [SCNetworkInterface] {
            for interface in interfaces where SCNetworkInterfaceGetBSDName(interface) as String? == bsdName {
                if let name = SCNetworkInterfaceGetLocalizedDisplayName(interface) as String? {
                    return name
                }
            }
        }
        return bsdName
    }

    /// 指定インターフェースの IPv4 アドレス。
    private func localIP(for bsdName: String?) -> String? {
        guard let bsdName else { return nil }
        var ifaddrPtr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddrPtr) == 0 else { return nil }
        defer { freeifaddrs(ifaddrPtr) }

        var ptr = ifaddrPtr
        while let current = ptr {
            defer { ptr = current.pointee.ifa_next }
            guard let addr = current.pointee.ifa_addr,
                  addr.pointee.sa_family == UInt8(AF_INET) else { continue }
            let name = String(cString: current.pointee.ifa_name)
            guard name == bsdName else { continue }

            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let len = socklen_t(addr.pointee.sa_len)
            if getnameinfo(addr, len, &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                return String(cString: host)
            }
        }
        return nil
    }
}
