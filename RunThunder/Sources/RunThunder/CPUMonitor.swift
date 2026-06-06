import Foundation
import Darwin

/// システム全体のCPU使用率を計測する。
/// host_statistics の累積tickを2回サンプリングして差分から使用率を求める。
final class CPUMonitor {

    private var prevUser: UInt32 = 0
    private var prevSystem: UInt32 = 0
    private var prevIdle: UInt32 = 0
    private var prevNice: UInt32 = 0

    /// 直近の計測からの平均使用率（total/user/system/idle、各 0.0〜1.0）。
    /// 初回呼び出しは基準値の取得のみで 0 を返す。
    func sample() -> CPUStats {
        var cpuLoad = host_cpu_load_info()
        var count = mach_msg_type_number_t(MemoryLayout<host_cpu_load_info>.size / MemoryLayout<integer_t>.size)

        let result = withUnsafeMutablePointer(to: &cpuLoad) { pointer -> kern_return_t in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPointer in
                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, intPointer, &count)
            }
        }

        guard result == KERN_SUCCESS else { return CPUStats() }

        let user = cpuLoad.cpu_ticks.0
        let system = cpuLoad.cpu_ticks.1
        let idle = cpuLoad.cpu_ticks.2
        let nice = cpuLoad.cpu_ticks.3

        let dUser = Double(user &- prevUser)
        let dSystem = Double(system &- prevSystem)
        let dIdle = Double(idle &- prevIdle)
        let dNice = Double(nice &- prevNice)

        prevUser = user
        prevSystem = system
        prevIdle = idle
        prevNice = nice

        let total = dUser + dSystem + dIdle + dNice
        guard total > 0 else { return CPUStats() }

        let used = (dUser + dSystem + dNice) / total
        return CPUStats(
            total: min(max(used, 0), 1),
            user: (dUser + dNice) / total,
            system: dSystem / total,
            idle: dIdle / total
        )
    }
}
