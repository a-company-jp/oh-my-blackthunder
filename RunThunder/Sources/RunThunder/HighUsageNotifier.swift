import Foundation
import UserNotifications

/// 監視対象が一定時間しきい値を超え続けたら通知する。
/// （通知の配信には署名済みアプリが必要な場合があります）
final class HighUsageNotifier {

    /// 高負荷とみなすしきい値（0.0〜1.0）。
    private let threshold: Double = 0.85
    /// しきい値を超え続けた状態が何秒続いたら通知するか。
    private let sustainedSeconds: TimeInterval = 30
    /// 連続通知を避けるためのクールダウン秒数。
    private let cooldownSeconds: TimeInterval = 300

    private var highSince: Date?
    private var lastNotified: Date?
    private var authorized = false

    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { [weak self] granted, _ in
            self?.authorized = granted
        }
    }

    /// 定期的に呼び出す。`now` はテスト容易化のため注入可能。
    func evaluate(usage: Double, targetLabel: String, now: Date = Date()) {
        guard usage >= threshold else {
            highSince = nil
            return
        }

        if highSince == nil {
            highSince = now
        }

        guard let since = highSince, now.timeIntervalSince(since) >= sustainedSeconds else {
            return
        }

        if let last = lastNotified, now.timeIntervalSince(last) < cooldownSeconds {
            return
        }

        lastNotified = now
        deliver(usage: usage, targetLabel: targetLabel)
    }

    private func deliver(usage: Double, targetLabel: String) {
        guard authorized else { return }

        let content = UNMutableNotificationContent()
        content.title = "⚡️ 高負荷です"
        content.body = String(format: "%@ が %.0f%% に達しています", targetLabel, usage * 100)
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
}
