import Foundation

/// 各モニタが返す計測値。ダッシュボード表示にまとめて使う。

struct CPUStats {
    var total: Double = 0   // 0.0〜1.0
    var user: Double = 0
    var system: Double = 0
    var idle: Double = 0
}

struct MemoryStats {
    var usage: Double = 0       // 0.0〜1.0
    var pressure: Double = 0    // 0.0〜1.0（近似）
    var appBytes: UInt64 = 0
    var wiredBytes: UInt64 = 0
    var compressedBytes: UInt64 = 0
}

struct StorageStats {
    var usedBytes: UInt64 = 0
    var totalBytes: UInt64 = 0
    var usedFraction: Double = 0
}

struct BatteryStats {
    var percent: Double = 0             // 0.0〜1.0
    var powerSource: String = "—"
    var isCharging: Bool = false        // 充電中か（メニューバーの稲妻表示に使う）
    var maxCapacityPercent: Double?     // バッテリー最大容量(健全性)
    var cycleCount: Int?
    var temperatureC: Double?
}

struct NetworkStats {
    var uploadBps: Double = 0
    var downloadBps: Double = 0
    var interfaceName: String = "—"
    var localIP: String = "—"
}

/// ダッシュボード 1 回分のスナップショット。
struct SystemSnapshot {
    var cpu = CPUStats()
    var memory = MemoryStats()
    var storage = StorageStats()
    var battery: BatteryStats?     // バッテリー非搭載なら nil
    var network = NetworkStats()
    var cpuHistory: [Double] = []  // スパークライン用（古い→新しい、0.0〜1.0）
    var claudeTodayTokens: Int = 0
    var claudeTotalTokens: Int = 0
}

/// バイト数を人間可読に整形（10進: 1000 単位、Finder 流）。
enum ByteFormat {
    static func gb(_ bytes: UInt64) -> String {
        String(format: "%.1f GB", Double(bytes) / 1_000_000_000)
    }

    static func speed(_ bytesPerSec: Double) -> String {
        let kb = bytesPerSec / 1024
        if kb < 1 { return String(format: "%.0f B/s", bytesPerSec) }
        let mb = kb / 1024
        if mb < 1 { return String(format: "%.1f KB/s", kb) }
        return String(format: "%.1f MB/s", mb)
    }
}
