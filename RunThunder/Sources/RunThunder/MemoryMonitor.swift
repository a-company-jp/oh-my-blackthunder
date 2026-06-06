import Foundation
import Darwin

/// システム全体のメモリ使用状況を計測する。
final class MemoryMonitor {

    func sample() -> MemoryStats {
        var stats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)

        let result = withUnsafeMutablePointer(to: &stats) { pointer -> kern_return_t in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPointer in
                host_statistics64(mach_host_self(), HOST_VM_INFO64, intPointer, &count)
            }
        }

        guard result == KERN_SUCCESS else { return MemoryStats() }

        let pageSize = UInt64(vm_kernel_page_size)
        let active = UInt64(stats.active_count) * pageSize
        let wired = UInt64(stats.wire_count) * pageSize
        let compressed = UInt64(stats.compressor_page_count) * pageSize
        let purgeable = UInt64(stats.purgeable_count) * pageSize
        let internalPages = UInt64(stats.internal_page_count) * pageSize
        // App Memory（アプリ使用分）≒ 内部ページ - パージ可能ページ
        let appMemory = internalPages > purgeable ? internalPages - purgeable : 0

        let total = ProcessInfo.processInfo.physicalMemory
        guard total > 0 else { return MemoryStats() }

        let used = active + wired + compressed
        // メモリプレッシャは公開APIが無いため (wired + compressed) / total で近似。
        let pressure = Double(wired + compressed) / Double(total)

        return MemoryStats(
            usage: min(max(Double(used) / Double(total), 0), 1),
            pressure: min(max(pressure, 0), 1),
            appBytes: appMemory,
            wiredBytes: wired,
            compressedBytes: compressed
        )
    }
}
