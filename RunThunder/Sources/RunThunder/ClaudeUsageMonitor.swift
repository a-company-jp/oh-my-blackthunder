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

    private(set) var totalTokens: Int = 0
    private(set) var todayTokens: Int = 0
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
                case .success(let (total, today)):
                    self.totalTokens = total
                    self.todayTokens = today
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

    private func runCCUsage() -> Result<(total: Int, today: Int), CCUsageError> {
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

    private func parse(_ data: Data) -> Result<(total: Int, today: Int), CCUsageError> {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return .failure(CCUsageError(message: "ccusage JSON 解析失敗"))
        }

        let totals = json["totals"] as? [String: Any]
        let total = (totals?["totalTokens"] as? NSNumber)?.intValue ?? 0

        var today = 0
        if let daily = json["daily"] as? [[String: Any]] {
            let todayString = Self.todayString()
            if let entry = daily.first(where: { ($0["period"] as? String) == todayString }) {
                today = (entry["totalTokens"] as? NSNumber)?.intValue ?? 0
            }
        }

        return .success((total, today))
    }

    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
