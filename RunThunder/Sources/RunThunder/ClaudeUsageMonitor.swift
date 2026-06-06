import Foundation

/// ccusage 実行・解析時のエラー。
struct CCUsageError: Error {
    let message: String
}

/// Claude のトークン使用量を ccusage コマンドから取得する。
/// `npx ccusage --json` を実行し、累計 / 今日のトークン数を取り出す。
///
/// 取得は時間がかかる（npx 起動・ネットワーク）ため、バックグラウンドで実行し
/// 完了したら `onUpdate` を main で呼ぶ。
final class ClaudeUsageMonitor {

    /// ブラックサンダー 1 個分のトークン数。
    static let tokensPerBar = 90_000.0

    /// ccusage の 1 日分のトークン使用量。`period` は "yyyy-MM-dd"（ローカル日付）。
    struct DailyUsage {
        let period: String   // "yyyy-MM-dd"
        let tokens: Int

        /// この日のブラックサンダー個数。
        var bars: Double { Double(tokens) / ClaudeUsageMonitor.tokensPerBar }
    }

    private(set) var totalTokens: Int = 0
    private(set) var todayTokens: Int = 0
    /// 日別の内訳（古い→新しい順。period は "yyyy-MM-dd"）。リーダーボード同期に使う。
    private(set) var dailyBreakdown: [DailyUsage] = []
    private(set) var lastUpdated: Date?
    private(set) var lastError: String?

    /// 取得完了時に main スレッドで呼ばれる。
    var onUpdate: (() -> Void)?

    private let queue = DispatchQueue(label: "io.local.runthunder.ccusage")
    private var isRunning = false

    /// トークン数をブラックサンダー個数へ換算。
    static func bars(forTokens tokens: Int) -> Double {
        Double(tokens) / tokensPerBar
    }

    /// バックグラウンドで ccusage を実行して使用量を更新する。
    func refresh() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.isRunning { return }
            self.isRunning = true
            defer { self.isRunning = false }

            let result = self.runCCUsage()
            DispatchQueue.main.async {
                switch result {
                case .success(let parsed):
                    self.totalTokens = parsed.total
                    self.todayTokens = parsed.today
                    self.dailyBreakdown = parsed.daily
                    self.lastError = nil
                    self.lastUpdated = Date()
                case .failure(let error):
                    self.lastError = error.message
                }
                self.onUpdate?()
            }
        }
    }

    // MARK: - 実行

    /// 解析結果。累計 / 今日 / 日別内訳をまとめて返す。
    private struct ParsedUsage {
        let total: Int
        let today: Int
        let daily: [DailyUsage]
    }

    private func runCCUsage() -> Result<ParsedUsage, CCUsageError> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // ログインシェルで PATH を解決し、npx 経由で ccusage を実行
        process.arguments = ["-lc", "npx -y ccusage@latest --json"]

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        do {
            try process.run()
        } catch {
            return .failure(CCUsageError(message: "ccusage 起動失敗: \(error.localizedDescription)"))
        }

        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let err = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            return .failure(CCUsageError(message: "ccusage 異常終了 (code \(process.terminationStatus)): \(err.prefix(200))"))
        }

        return parse(data)
    }

    private func parse(_ data: Data) -> Result<ParsedUsage, CCUsageError> {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return .failure(CCUsageError(message: "ccusage JSON 解析失敗"))
        }

        let totals = json["totals"] as? [String: Any]
        let total = (totals?["totalTokens"] as? NSNumber)?.intValue ?? 0

        var breakdown: [DailyUsage] = []
        if let daily = json["daily"] as? [[String: Any]] {
            for entry in daily {
                guard let period = entry["period"] as? String else { continue }
                let tokens = (entry["totalTokens"] as? NSNumber)?.intValue ?? 0
                breakdown.append(DailyUsage(period: period, tokens: tokens))
            }
        }
        // period 昇順（古い→新しい）に正規化。
        breakdown.sort { $0.period < $1.period }

        let todayString = Self.todayString()
        let today = breakdown.first(where: { $0.period == todayString })?.tokens ?? 0

        return .success(ParsedUsage(total: total, today: today, daily: breakdown))
    }

    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
