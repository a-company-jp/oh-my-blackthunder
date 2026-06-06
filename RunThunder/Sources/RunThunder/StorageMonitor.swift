import Foundation
import Darwin

/// 起動ボリュームのストレージ使用状況を計測する。
final class StorageMonitor {

    func sample() -> StorageStats {
        // データボリュームを優先（無ければホーム）
        let path = FileManager.default.fileExists(atPath: "/System/Volumes/Data")
            ? "/System/Volumes/Data"
            : NSHomeDirectory()

        var fs = statfs()
        guard statfs(path, &fs) == 0 else { return StorageStats() }

        let blockSize = UInt64(fs.f_bsize)
        let total = UInt64(fs.f_blocks) * blockSize
        let available = UInt64(fs.f_bavail) * blockSize
        let used = total > available ? total - available : 0

        guard total > 0 else { return StorageStats() }

        return StorageStats(
            usedBytes: used,
            totalBytes: total,
            usedFraction: min(max(Double(used) / Double(total), 0), 1)
        )
    }
}
