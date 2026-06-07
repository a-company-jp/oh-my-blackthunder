import Foundation
import Network
import Security

#if canImport(AppKit)
import AppKit
#endif

/// AIザクザク度リーダーボードとの連携クライアント。
///
/// 役割:
///  - アプリトークン（website-brokered で発行された不透明な 32 バイト hex）の保存。
///    ※ 趣味アプリのため UserDefaults に保存している。本番では Keychain 推奨（TODO）。
///  - 連携フロー（/connect）の駆動: 127.0.0.1 のエフェメラルポートでループバック
///    HTTP リスナを立て、ブラウザを開いて GitHub サインイン + 認可させ、
///    redirect_uri へ返ってきた token/state を捕捉してトークンを保存する。
///  - sync(): ClaudeUsageMonitor の日別内訳から IngestBarEvent を組み立て、
///    <base>/api/ingest へ Bearer トークン付きで POST する。
///
/// 連携前（トークン無し）は完全に無効。ユーザーが明示的に連携するまで何も送らない。
final class LeaderboardClient {

    static let shared = LeaderboardClient()

    // MARK: - 設定

    /// 連携先ウェブサイトのベース URL（既定値。UserDefaults で上書き可能）。
    static let defaultBaseURL = "https://zakuzaku-web-wusvc57q7a-an.a.run.app"

    /// クライアント識別子（IngestRequest.client / connect の app パラメータ）。
    static let appName = "runthunder"

    /// 直近何日分を同期対象にするか（リクエストサイズ・スパム防止のための上限）。
    /// MAX_EVENTS_PER_REQUEST (500) を十分に下回るよう保守的に設定。
    private static let maxSyncDays = 60

    /// 1 イベントあたりの bars 上限（スキーマ MAX_BARS_PER_EVENT = 1000 と一致）。
    /// これを超える異常な 1 日があってもバッチ全体が 400 で弾かれないようクランプする。
    private static let maxBarsPerEvent = 1000.0

    // MARK: - 永続化キー

    private enum Key {
        static let appToken = "leaderboard.appToken"
        static let baseURL = "leaderboard.baseURL"
        static let lastSyncedAtMs = "leaderboard.lastSyncedAtMs"
        static let login = "leaderboard.login"
        static let githubId = "leaderboard.githubId"
    }

    private let defaults = UserDefaults.standard

    /// 連携状態が変わったとき（接続/解除/同期結果）に main で呼ばれる。
    var onStateChange: (() -> Void)?

    private init() {}

    // MARK: - トークン / 設定アクセサ

    /// 保存済みアプリトークン（未連携なら nil）。
    /// TODO: 本番では Keychain に移行する。
    private(set) var token: String? {
        get {
            let value = defaults.string(forKey: Key.appToken)
            return (value?.isEmpty ?? true) ? nil : value
        }
        set {
            if let newValue, !newValue.isEmpty {
                defaults.set(newValue, forKey: Key.appToken)
            } else {
                defaults.removeObject(forKey: Key.appToken)
            }
        }
    }

    /// 連携済みか。
    var isConnected: Bool { token != nil }

    /// 連携先ベース URL（末尾スラッシュは除去）。
    var baseURL: String {
        get {
            let stored = defaults.string(forKey: Key.baseURL)
            let value = (stored?.isEmpty ?? true) ? Self.defaultBaseURL : stored!
            return value.hasSuffix("/") ? String(value.dropLast()) : value
        }
        set {
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                defaults.removeObject(forKey: Key.baseURL)
            } else {
                defaults.set(trimmed, forKey: Key.baseURL)
            }
        }
    }

    /// 最後に同期に成功した時刻（epoch ms）。未同期なら nil。
    var lastSyncedAtMs: Int? {
        let value = defaults.integer(forKey: Key.lastSyncedAtMs)
        return value > 0 ? value : nil
    }

    /// ログイン中の GitHub ユーザー名。/api/ingest のレスポンスから取得・保存される。
    /// 連携直後・初回同期前は nil のことがある。
    private(set) var login: String? {
        get {
            let value = defaults.string(forKey: Key.login)
            return (value?.isEmpty ?? true) ? nil : value
        }
        set {
            if let newValue, !newValue.isEmpty {
                defaults.set(newValue, forKey: Key.login)
            } else {
                defaults.removeObject(forKey: Key.login)
            }
        }
    }

    /// ログイン中の GitHub 数値 ID（アバター URL の生成に使う）。未取得なら nil。
    private(set) var githubId: Int? {
        get {
            let value = defaults.integer(forKey: Key.githubId)
            return value > 0 ? value : nil
        }
        set {
            if let newValue, newValue > 0 {
                defaults.set(newValue, forKey: Key.githubId)
            } else {
                defaults.removeObject(forKey: Key.githubId)
            }
        }
    }

    /// GitHub アバター画像の URL（数値 ID から生成）。ID 未取得なら nil。
    var avatarURL: URL? {
        guard let githubId else { return nil }
        return URL(string: "https://avatars.githubusercontent.com/u/\(githubId)")
    }

    /// 連携状態の短い説明（メニュー表示用）。
    var statusDescription: String {
        guard isConnected else { return "未連携" }
        if let ms = lastSyncedAtMs {
            let date = Date(timeIntervalSince1970: Double(ms) / 1000)
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "ja_JP")
            fmt.dateFormat = "M/d HH:mm"
            return "連携済み（最終同期 \(fmt.string(from: date))）"
        }
        return "連携済み（未同期）"
    }

    /// 連携を解除（トークン・ユーザー情報を破棄）。
    func disconnect() {
        token = nil
        login = nil
        githubId = nil
        stopListener()
        DispatchQueue.main.async { [weak self] in self?.onStateChange?() }
    }

    // MARK: - 連携フロー（/connect）

    private var listener: NWListener?
    private var listenerQueue = DispatchQueue(label: "io.local.runthunder.leaderboard.listener")
    private var pendingState: String?
    private var connectCompletion: ((Result<Void, LeaderboardError>) -> Void)?

    /// 連携フローを開始する。ループバックリスナを立ててブラウザを開く。
    /// 結果は main スレッドで `completion` に返る。
    func connect(completion: ((Result<Void, LeaderboardError>) -> Void)? = nil) {
        // 既存フローがあれば破棄してやり直す。
        stopListener()

        let nonce = Self.randomHex(bytes: 16)
        pendingState = nonce
        connectCompletion = completion

        let params = NWParameters.tcp
        // ループバックのみに束縛（外部からの接続を受けない）。
        params.requiredInterfaceType = .loopback
        params.allowLocalEndpointReuse = true

        let listener: NWListener
        do {
            listener = try NWListener(using: params, on: .any)
        } catch {
            finishConnect(.failure(.listenerFailed(error.localizedDescription)))
            return
        }
        self.listener = listener

        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection: connection)
        }

        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                guard let port = listener.port?.rawValue else {
                    self.finishConnect(.failure(.listenerFailed("ポート取得失敗")))
                    return
                }
                self.openBrowser(port: Int(port), state: nonce)
            case .failed(let error):
                self.finishConnect(.failure(.listenerFailed(error.localizedDescription)))
            default:
                break
            }
        }

        listener.start(queue: listenerQueue)
    }

    private func openBrowser(port: Int, state: String) {
        let redirect = "http://127.0.0.1:\(port)/callback"
        var components = URLComponents(string: "\(baseURL)/connect")
        components?.queryItems = [
            URLQueryItem(name: "app", value: Self.appName),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "state", value: state),
        ]
        guard let url = components?.url else {
            finishConnect(.failure(.invalidConfig("ベース URL が不正です")))
            return
        }
        #if canImport(AppKit)
        DispatchQueue.main.async { NSWorkspace.shared.open(url) }
        #endif
    }

    private func handle(connection: NWConnection) {
        connection.start(queue: listenerQueue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) {
            [weak self] data, _, _, error in
            guard let self else { return }
            if let error {
                connection.cancel()
                self.finishConnect(.failure(.callbackFailed(error.localizedDescription)))
                return
            }
            guard let data, let request = String(data: data, encoding: .utf8) else {
                self.respond(connection: connection, ok: false)
                return
            }
            self.process(request: request, connection: connection)
        }
    }

    /// HTTP リクエストの 1 行目（"GET /callback?... HTTP/1.1"）からクエリを抽出。
    private func process(request: String, connection: NWConnection) {
        guard let requestLine = request.split(separator: "\r\n").first
            ?? request.split(separator: "\n").first else {
            self.respond(connection: connection, ok: false)
            return
        }
        let parts = requestLine.split(separator: " ")
        guard parts.count >= 2 else {
            self.respond(connection: connection, ok: false)
            return
        }
        let path = String(parts[1])

        // /favicon.ico などコールバック以外のリクエストは無視（リスナは閉じない）。
        guard path.hasPrefix("/callback") else {
            self.respondIgnore(connection: connection)
            return
        }

        // 相対パスを URLComponents で解析するためダミーのオリジンを付与。
        guard let comps = URLComponents(string: "http://127.0.0.1\(path)") else {
            self.respond(connection: connection, ok: false)
            return
        }
        let items = comps.queryItems ?? []
        let token = items.first(where: { $0.name == "token" })?.value
        let state = items.first(where: { $0.name == "state" })?.value

        guard let state, state == pendingState else {
            self.respond(connection: connection, ok: false)
            self.finishConnect(.failure(.stateMismatch))
            return
        }
        guard let token, !token.isEmpty else {
            self.respond(connection: connection, ok: false)
            self.finishConnect(.failure(.callbackFailed("token がありません")))
            return
        }

        // 成功: トークンを保存してブラウザに成功ページを返す。
        self.token = token
        self.respond(connection: connection, ok: true)
        self.finishConnect(.success(()))
    }

    private func respond(connection: NWConnection, ok: Bool) {
        let title = ok ? "連携が完了しました" : "連携に失敗しました"
        let message = ok
            ? "RunThunder とリーダーボードの連携が完了しました。このタブは閉じて構いません。"
            : "連携に失敗しました。RunThunder からもう一度お試しください。"
        let html = Self.htmlPage(title: title, message: message)
        sendHTTP(connection: connection, status: ok ? "200 OK" : "400 Bad Request", html: html, closeListener: true)
    }

    /// コールバック以外（favicon 等）への応答。リスナは閉じない。
    private func respondIgnore(connection: NWConnection) {
        let html = Self.htmlPage(title: "RunThunder", message: "")
        sendHTTP(connection: connection, status: "404 Not Found", html: html, closeListener: false)
    }

    private func sendHTTP(connection: NWConnection, status: String, html: String, closeListener: Bool) {
        let body = Data(html.utf8)
        let header = """
        HTTP/1.1 \(status)\r
        Content-Type: text/html; charset=utf-8\r
        Content-Length: \(body.count)\r
        Connection: close\r
        \r

        """
        var response = Data(header.utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { [weak self] _ in
            connection.cancel()
            if closeListener { self?.stopListener() }
        })
    }

    private func finishConnect(_ result: Result<Void, LeaderboardError>) {
        let completion = connectCompletion
        connectCompletion = nil
        pendingState = nil
        stopListener()
        DispatchQueue.main.async { [weak self] in
            completion?(result)
            self?.onStateChange?()
        }
    }

    private func stopListener() {
        listener?.cancel()
        listener = nil
    }

    // MARK: - 同期（/api/ingest）

    private var isSyncing = false

    /// ClaudeUsageMonitor の日別内訳から bars イベントを組み立てて送信する。
    /// トークンが無い（未連携）場合は何もしない。
    func sync(from monitor: ClaudeUsageMonitor,
              completion: ((Result<Void, LeaderboardError>) -> Void)? = nil) {
        guard let token = token else {
            completion?(.failure(.notConnected))
            return
        }
        if isSyncing {
            completion?(.failure(.busy))
            return
        }

        let events = Self.buildEvents(from: monitor.dailyBreakdown)
        guard !events.isEmpty else {
            // 送るものが無ければ成功扱い（ノーオペ）。
            completion?(.success(()))
            return
        }

        let payload: [String: Any] = [
            "client": Self.appName,
            "events": events,
        ]
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            completion?(.failure(.invalidConfig("JSON 生成失敗")))
            return
        }
        guard let url = URL(string: "\(baseURL)/api/ingest") else {
            completion?(.failure(.invalidConfig("ベース URL が不正です")))
            return
        }

        isSyncing = true
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = body
        request.timeoutInterval = 30

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            self.isSyncing = false

            let finish: (Result<Void, LeaderboardError>) -> Void = { result in
                DispatchQueue.main.async {
                    if case .success = result {
                        self.defaults.set(Int(Date().timeIntervalSince1970 * 1000),
                                          forKey: Key.lastSyncedAtMs)
                    }
                    self.onStateChange?()
                    completion?(result)
                }
            }

            if let error {
                finish(.failure(.network(error.localizedDescription)))
                return
            }
            guard let http = response as? HTTPURLResponse else {
                finish(.failure(.network("応答なし")))
                return
            }
            switch http.statusCode {
            case 200:
                // レスポンスから GitHub ユーザー名・ID を取り出して保存する
                // （ログイン中ユーザーのアイコン/名前表示に使う）。失敗しても同期成功扱い。
                if let data { self.storeIdentity(from: data) }
                finish(.success(()))
            case 401, 403:
                // トークンが無効・失効。連携を解除（ユーザー情報も破棄）して再連携を促す。
                self.token = nil
                self.login = nil
                self.githubId = nil
                finish(.failure(.unauthorized))
            default:
                let detail = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                finish(.failure(.server(http.statusCode, String(detail.prefix(200)))))
            }
        }
        task.resume()
    }

    /// 日別内訳 -> IngestBarEvent 互換の辞書配列。
    /// - eventId: "bars:<deviceId>:<yyyymmdd>"
    /// - provider: "Claude"
    /// - bars / cumulativeBars: その日の合計 bars（累計デルタ意味論）
    /// - tsMs: その日のタイムスタンプ（ms）。未来日は now にクランプ。
    /// 0 bars の日はサーバ検証（bars > 0）で弾かれるためスキップする。
    static func buildEvents(from breakdown: [ClaudeUsageMonitor.DailyUsage]) -> [[String: Any]] {
        let deviceId = DeviceIdentity.deviceId
        let deviceName = DeviceIdentity.deviceName
        let nowMs = Int(Date().timeIntervalSince1970 * 1000)

        // 直近 maxSyncDays 日分のみ（古い→新しい順の末尾）。
        let recent = breakdown.suffix(maxSyncDays)

        var events: [[String: Any]] = []
        for day in recent {
            // 0 bars の日と、上限超過分のクランプ。
            let bars = min(day.bars, maxBarsPerEvent)
            guard bars > 0 else { continue }
            guard let (yyyymmdd, tsMs) = dayKeys(forPeriod: day.period) else { continue }
            // サーバの将来スキュー検証（now + 5分）に掛からないようクランプ。
            let safeTsMs = min(tsMs, nowMs)
            events.append([
                "kind": "bars",
                "provider": "Claude",
                "eventId": "bars:\(deviceId):\(yyyymmdd)",
                "tsMs": safeTsMs,
                "bars": bars,
                "cumulativeBars": bars,
                "deviceId": deviceId,
                "deviceName": deviceName,
            ])
        }
        return events
    }

    /// "yyyy-MM-dd" を eventId 用の "yyyymmdd" と、その日のローカル 0 時の epoch ms に変換。
    private static func dayKeys(forPeriod period: String) -> (yyyymmdd: String, tsMs: Int)? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        guard let date = formatter.date(from: period) else { return nil }
        let yyyymmdd = period.replacingOccurrences(of: "-", with: "")
        let tsMs = Int(date.timeIntervalSince1970 * 1000)
        return (yyyymmdd, tsMs)
    }

    /// /api/ingest（IngestResponse）から login と githubId を取り出して保存する。
    /// 失敗（パース不可・フィールド欠如）しても無視する。main で onStateChange を呼ぶ。
    private func storeIdentity(from data: Data) {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        var changed = false
        if let login = json["login"] as? String, !login.isEmpty, login != self.login {
            self.login = login
            changed = true
        }
        if let githubId = json["githubId"] as? Int, githubId > 0, githubId != self.githubId {
            self.githubId = githubId
            changed = true
        }
        if changed {
            DispatchQueue.main.async { [weak self] in self?.onStateChange?() }
        }
    }

    // MARK: - ユーティリティ

    private static func randomHex(bytes count: Int) -> String {
        var data = Data(count: count)
        let result = data.withUnsafeMutableBytes { buffer -> Int32 in
            guard let base = buffer.baseAddress else { return errSecParam }
            return SecRandomCopyBytes(kSecRandomDefault, count, base)
        }
        if result == errSecSuccess {
            return data.map { String(format: "%02x", $0) }.joined()
        }
        // フォールバック（理論上ここには来ない）。
        return (0..<count).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
    }

    private static func htmlPage(title: String, message: String) -> String {
        """
        <!doctype html>
        <html lang="ja">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>\(title)</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
                   background: #1a1a1a; color: #f5f5f5; display: flex; min-height: 100vh;
                   align-items: center; justify-content: center; margin: 0; }
            .card { text-align: center; padding: 40px; }
            h1 { font-size: 22px; margin-bottom: 12px; }
            p { color: #c8c8c8; }
            .bolt { font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="bolt">⚡️🍫</div>
            <h1>\(title)</h1>
            <p>\(message)</p>
          </div>
        </body>
        </html>
        """
    }
}

/// 連携クライアントのエラー。
enum LeaderboardError: Error {
    case notConnected
    case busy
    case unauthorized
    case stateMismatch
    case listenerFailed(String)
    case callbackFailed(String)
    case network(String)
    case server(Int, String)
    case invalidConfig(String)

    /// メニュー / アラート表示用の日本語メッセージ。
    var localizedMessage: String {
        switch self {
        case .notConnected: return "未連携です。先にリーダーボード連携を行ってください。"
        case .busy: return "別の処理を実行中です。"
        case .unauthorized: return "トークンが無効です。再連携してください。"
        case .stateMismatch: return "連携の検証に失敗しました（state 不一致）。"
        case .listenerFailed(let m): return "ローカルサーバの起動に失敗しました: \(m)"
        case .callbackFailed(let m): return "コールバック処理に失敗しました: \(m)"
        case .network(let m): return "通信エラー: \(m)"
        case .server(let code, let m): return "サーバエラー (\(code)): \(m)"
        case .invalidConfig(let m): return "設定エラー: \(m)"
        }
    }
}
