import Foundation

#if canImport(AppKit)
import AppKit
#endif

/// この Mac を一意に識別するための安定したデバイスアイデンティティ。
///
/// AIザクザク度（bars）はデバイスごとの日次累計メーターとしてサーバへ送られる
/// （eventId = "bars:<deviceId>:<yyyymmdd>"）。そのため deviceId は端末固有かつ
/// 永続でなければならない。初回に UUID を 1 つ生成して UserDefaults に保存し、
/// 以降は同じ値を使い回す。
///
/// `name` はリーダーボード上での表示用ラベル（ホスト名）で、deviceId とは独立。
enum DeviceIdentity {

    /// スキーマの DeviceDoc.platform に対応する固定値。
    static let platform = "macOS"

    private static let deviceIdKey = "leaderboard.deviceId"

    private static let defaults = UserDefaults.standard

    /// 安定したデバイス ID。初回アクセス時に生成・保存する。
    static var deviceId: String {
        if let existing = defaults.string(forKey: deviceIdKey),
           !existing.isEmpty {
            return existing
        }
        let generated = UUID().uuidString
        defaults.set(generated, forKey: deviceIdKey)
        return generated
    }

    /// 人間が読みやすいデバイス名（ホスト名）。表示・送信に使う。
    static var deviceName: String {
        #if canImport(AppKit)
        if let localized = Host.current().localizedName, !localized.isEmpty {
            return localized
        }
        #endif
        if let name = Host.current().names.first, !name.isEmpty {
            return name
        }
        let hostName = ProcessInfo.processInfo.hostName
        return hostName.isEmpty ? "Mac" : hostName
    }
}
