import Foundation
import IOKit
import IOKit.ps

/// バッテリーの状態を取得する（IOKit）。非搭載なら nil を返す。
final class BatteryMonitor {

    func sample() -> BatteryStats? {
        guard let blob = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(blob)?.takeRetainedValue() as? [CFTypeRef],
              let first = sources.first,
              let desc = IOPSGetPowerSourceDescription(blob, first)?.takeUnretainedValue() as? [String: Any]
        else {
            return nil
        }

        var stats = BatteryStats()

        if let current = desc[kIOPSCurrentCapacityKey] as? Int,
           let max = desc[kIOPSMaxCapacityKey] as? Int, max > 0 {
            stats.percent = min(max == 100 ? Double(current) / 100.0 : Double(current) / Double(max), 1.0)
        }

        if let state = desc[kIOPSPowerSourceStateKey] as? String {
            stats.powerSource = (state == kIOPSACPowerValue) ? "電源アダプタ" : "バッテリー"
        }

        stats.isCharging = (desc[kIOPSIsChargingKey] as? Bool) ?? false

        readSmartBattery(into: &stats)
        return stats
    }

    /// AppleSmartBattery レジストリから健全性・サイクル数・温度を取得。
    private func readSmartBattery(into stats: inout BatteryStats) {
        let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSmartBattery"))
        guard service != 0 else { return }
        defer { IOObjectRelease(service) }

        func intProp(_ key: String) -> Int? {
            guard let ref = IORegistryEntryCreateCFProperty(service, key as CFString, kCFAllocatorDefault, 0) else {
                return nil
            }
            return (ref.takeRetainedValue() as? NSNumber)?.intValue
        }

        if let cycles = intProp("CycleCount") {
            stats.cycleCount = cycles
        }
        if let temp = intProp("Temperature") {
            // 1/100 ℃ 単位
            stats.temperatureC = Double(temp) / 100.0
        }
        if let rawMax = intProp("AppleRawMaxCapacity") ?? intProp("MaxCapacity"),
           let design = intProp("DesignCapacity"), design > 0 {
            stats.maxCapacityPercent = Double(rawMax) / Double(design) * 100.0
        }
    }
}
