import Foundation

/// 監視対象の指標。アニメ速度と数値表示に使う。
enum MonitorTarget: String {
    case cpu
    case memory
    case network

    var label: String {
        switch self {
        case .cpu: return "CPU使用率"
        case .memory: return "メモリ使用率"
        case .network: return "ネットワーク速度"
        }
    }

    var shortLabel: String {
        switch self {
        case .cpu: return "CPU"
        case .memory: return "MEM"
        case .network: return "NET"
        }
    }
}

/// ブラックサンダー個数の集計範囲。
enum BlackThunderScope: String {
    case today
    case total

    var label: String {
        switch self {
        case .today: return "今日"
        case .total: return "累計"
        }
    }
}

/// UserDefaults に永続化する設定。
final class Preferences {
    static let shared = Preferences()

    private let defaults = UserDefaults.standard

    private enum Key {
        static let target = "monitorTarget"
        static let showUsageText = "showUsageText"
        static let notifyHighUsage = "notifyHighUsage"
        static let templateIcon = "templateIcon"
        static let showBlackThunder = "showBlackThunder"
        static let blackThunderScope = "blackThunderScope"
        static let showBatteryBar = "showBatteryBar"
    }

    private init() {
        defaults.register(defaults: [
            Key.target: MonitorTarget.cpu.rawValue,
            Key.showUsageText: false,
            Key.notifyHighUsage: false,
            Key.templateIcon: false,
            Key.showBlackThunder: false,
            Key.blackThunderScope: BlackThunderScope.today.rawValue,
            Key.showBatteryBar: true,
        ])
    }

    var target: MonitorTarget {
        get { MonitorTarget(rawValue: defaults.string(forKey: Key.target) ?? "") ?? .cpu }
        set { defaults.set(newValue.rawValue, forKey: Key.target) }
    }

    var showUsageText: Bool {
        get { defaults.bool(forKey: Key.showUsageText) }
        set { defaults.set(newValue, forKey: Key.showUsageText) }
    }

    var notifyHighUsage: Bool {
        get { defaults.bool(forKey: Key.notifyHighUsage) }
        set { defaults.set(newValue, forKey: Key.notifyHighUsage) }
    }

    /// メニューバーの明暗に追従する単色（テンプレート）表示。
    var templateIcon: Bool {
        get { defaults.bool(forKey: Key.templateIcon) }
        set { defaults.set(newValue, forKey: Key.templateIcon) }
    }

    /// メニューバーにブラックサンダー個数を表示する。
    var showBlackThunder: Bool {
        get { defaults.bool(forKey: Key.showBlackThunder) }
        set { defaults.set(newValue, forKey: Key.showBlackThunder) }
    }

    var blackThunderScope: BlackThunderScope {
        get { BlackThunderScope(rawValue: defaults.string(forKey: Key.blackThunderScope) ?? "") ?? .today }
        set { defaults.set(newValue.rawValue, forKey: Key.blackThunderScope) }
    }

    /// 2 つ目のメニューバーアイコン（チョコのバッテリー表示）を出すか。
    var showBatteryBar: Bool {
        get { defaults.bool(forKey: Key.showBatteryBar) }
        set { defaults.set(newValue, forKey: Key.showBatteryBar) }
    }
}
