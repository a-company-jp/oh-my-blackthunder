import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusItem: NSStatusItem!
    private let batteryStatusItem = BatteryStatusItem()
    private let popover = NSPopover()
    private let dashboard = DashboardViewController()

    private let cpuMonitor = CPUMonitor()
    private let memoryMonitor = MemoryMonitor()
    private let networkMonitor = NetworkMonitor()
    private let storageMonitor = StorageMonitor()
    private let batteryMonitor = BatteryMonitor()
    private let claudeUsage = ClaudeUsageMonitor()
    private let notifier = HighUsageNotifier()
    private let prefs = Preferences.shared
    private let leaderboard = LeaderboardClient.shared

    private var frames: [NSImage] = []
    private var frameIndex = 0

    private var animationTimer: Timer?
    private var monitorTimer: Timer?
    private var claudeTimer: Timer?
    private var leaderboardTimer: Timer?

    private var settingsMenu: NSMenu!

    private var currentUsage: Double = 0          // アニメ速度に使う 0.0〜1.0
    private var snapshot = SystemSnapshot()
    private var cpuHistory: [Double] = []
    private var tickCount = 0
    private let historyLength = 60

    // アニメ間隔のレンジ（秒）。使用率が高いほど短く＝速くなる。
    private let slowestInterval: TimeInterval = 0.30
    private let fastestInterval: TimeInterval = 0.04
    private let networkFullScale: Double = 5_000_000 // 5 MB/s を 100% とみなす

    private enum Tag: Int {
        case usage = 1
        case claudeToday = 2
        case claudeTotal = 3
        case targetCPU = 10
        case targetMemory = 11
        case targetNetwork = 12
        case showText = 20
        case notify = 21
        case loginItem = 22
        case templateIcon = 23
        case showBlackThunder = 24
        case showBatteryBar = 25
        case scopeToday = 30
        case scopeTotal = 31
        case leaderboardStatus = 40
        case leaderboardConnect = 41
        case leaderboardSync = 42
        case leaderboardDisconnect = 43
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        frames = AnimationLoader.loadFrames()
        AnimationLoader.applyTemplate(prefs.templateIcon, to: frames)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.imageScaling = .scaleProportionallyUpOrDown
            button.imagePosition = .imageLeading
            button.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            button.image = frames.first
            button.target = self
            button.action = #selector(statusItemClicked)
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        // ポップオーバー（ダッシュボード）
        dashboard.onOpenActivityMonitor = { [weak self] in self?.openActivityMonitor() }
        dashboard.onQuit = { [weak self] in self?.quit() }
        dashboard.onToggleLeaderboard = { [weak self] in self?.toggleLeaderboardFromDashboard() }
        dashboard.onShowHomebrewInstall = { [weak self] in self?.showHomebrewInstall() }
        popover.behavior = .transient
        popover.contentViewController = dashboard
        // 黒地のブラックサンダー配色に合わせ、枠・矢印もダーク外観に固定する。
        popover.appearance = NSAppearance(named: .darkAqua)

        buildSettingsMenu()

        // 2 つ目のアイコン（チョコのバッテリー表示）。走るキャラとは独立した
        // NSStatusItem を持ち、独自タイマーで更新する。バッテリー非搭載機では出ない。
        batteryStatusItem.onQuit = { [weak self] in self?.quit() }
        batteryStatusItem.setVisible(prefs.showBatteryBar)

        // 基準値の取得（CPU/ネットワークは初回0）。
        _ = cpuMonitor.sample()
        _ = networkMonitor.sample()

        if prefs.notifyHighUsage {
            notifier.requestAuthorization()
        }

        claudeUsage.onUpdate = { [weak self] in
            self?.updateClaudeMenu()
            // 使用量が更新されるたび、連携済みなら自動同期する。
            self?.syncLeaderboardIfConnected()
        }
        leaderboard.onStateChange = { [weak self] in
            self?.refreshLeaderboardMenu()
            self?.refreshDashboardAccount()
        }
        claudeUsage.refresh()

        startMonitoring()
        restartAnimation(interval: slowestInterval)
    }

    // MARK: - クリック処理

    @objc private func statusItemClicked() {
        let event = NSApp.currentEvent
        let isRight = event?.type == .rightMouseUp
            || (event?.modifierFlags.contains(.control) ?? false)
        if isRight {
            showSettingsMenu()
        } else {
            togglePopover()
        }
    }

    private func togglePopover() {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(nil)
            return
        }
        _ = dashboard.view   // アクセスで loadView を走らせ、batteryRow 等を生成（macOS 13 互換）
        dashboard.shuffleTodayBar()   // 開くたびにバー画像をランダムに
        dashboard.update(snapshot)
        refreshDashboardAccount()     // ログイン状態・ユーザー名・アバターを反映
        dashboard.updatePreferredSize()
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func showSettingsMenu() {
        statusItem.menu = settingsMenu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    private func openActivityMonitor() {
        let url = URL(fileURLWithPath: "/System/Applications/Utilities/Activity Monitor.app")
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
        popover.performClose(nil)
    }

    /// Homebrew インストールコマンドのモーダルを表示する。
    /// ポップオーバー（.transient）はモーダル表示で閉じてしまうため、先に閉じる。
    private func showHomebrewInstall() {
        popover.performClose(nil)
        HomebrewInstallModal().present()
    }

    @objc private func quit() {
        NSApplication.shared.terminate(nil)
    }

    // MARK: - 設定メニュー（右クリック）

    private func buildSettingsMenu() {
        let menu = NSMenu()

        let usageItem = NSMenuItem(title: "—", action: nil, keyEquivalent: "")
        usageItem.tag = Tag.usage.rawValue
        usageItem.isEnabled = false
        menu.addItem(usageItem)

        menu.addItem(.separator())

        let todayItem = NSMenuItem(title: "🍫 今日: 取得中…", action: nil, keyEquivalent: "")
        todayItem.tag = Tag.claudeToday.rawValue
        todayItem.isEnabled = false
        menu.addItem(todayItem)

        let totalItem = NSMenuItem(title: "🍫 累計: 取得中…", action: nil, keyEquivalent: "")
        totalItem.tag = Tag.claudeTotal.rawValue
        totalItem.isEnabled = false
        menu.addItem(totalItem)

        let refreshItem = NSMenuItem(title: "🍫 使用量を更新", action: #selector(refreshClaude), keyEquivalent: "r")
        refreshItem.target = self
        menu.addItem(refreshItem)

        let scopeMenu = NSMenu()
        let scopeTodayItem = NSMenuItem(title: BlackThunderScope.today.label, action: #selector(selectScope(_:)), keyEquivalent: "")
        scopeTodayItem.tag = Tag.scopeToday.rawValue
        scopeTodayItem.target = self
        let scopeTotalItem = NSMenuItem(title: BlackThunderScope.total.label, action: #selector(selectScope(_:)), keyEquivalent: "")
        scopeTotalItem.tag = Tag.scopeTotal.rawValue
        scopeTotalItem.target = self
        scopeMenu.addItem(scopeTodayItem)
        scopeMenu.addItem(scopeTotalItem)
        let scopeParent = NSMenuItem(title: "🍫 メニューバー表示の集計", action: nil, keyEquivalent: "")
        scopeParent.submenu = scopeMenu
        menu.addItem(scopeParent)

        menu.addItem(.separator())

        // --- リーダーボード連携 -------------------------------------------------
        let lbStatusItem = NSMenuItem(title: "⚡️ 連携状態: —", action: nil, keyEquivalent: "")
        lbStatusItem.tag = Tag.leaderboardStatus.rawValue
        lbStatusItem.isEnabled = false
        menu.addItem(lbStatusItem)

        let lbConnectItem = NSMenuItem(title: "⚡️ GitHubでログイン", action: #selector(connectLeaderboard), keyEquivalent: "")
        lbConnectItem.tag = Tag.leaderboardConnect.rawValue
        lbConnectItem.target = self
        menu.addItem(lbConnectItem)

        let lbSyncItem = NSMenuItem(title: "⚡️ 今すぐ同期", action: #selector(syncLeaderboardNow), keyEquivalent: "")
        lbSyncItem.tag = Tag.leaderboardSync.rawValue
        lbSyncItem.target = self
        menu.addItem(lbSyncItem)

        let lbDisconnectItem = NSMenuItem(title: "⚡️ ログアウト", action: #selector(disconnectLeaderboard), keyEquivalent: "")
        lbDisconnectItem.tag = Tag.leaderboardDisconnect.rawValue
        lbDisconnectItem.target = self
        menu.addItem(lbDisconnectItem)

        menu.addItem(.separator())

        let targetMenu = NSMenu()
        for (tag, target) in [(Tag.targetCPU, MonitorTarget.cpu),
                              (Tag.targetMemory, .memory),
                              (Tag.targetNetwork, .network)] {
            let item = NSMenuItem(title: target.label, action: #selector(selectTarget(_:)), keyEquivalent: "")
            item.tag = tag.rawValue
            item.target = self
            targetMenu.addItem(item)
        }
        let targetParent = NSMenuItem(title: "アニメ速度の対象", action: nil, keyEquivalent: "")
        targetParent.submenu = targetMenu
        menu.addItem(targetParent)

        addToggle(to: menu, title: "使用率を数値で表示", tag: .showText, action: #selector(toggleShowText))
        addToggle(to: menu, title: "🍫 個数をメニューバーに表示", tag: .showBlackThunder, action: #selector(toggleShowBlackThunder))
        addToggle(to: menu, title: "🔋 チョコでバッテリーを表示", tag: .showBatteryBar, action: #selector(toggleShowBatteryBar))
        addToggle(to: menu, title: "メニューバーの色に追従", tag: .templateIcon, action: #selector(toggleTemplate))
        addToggle(to: menu, title: "高負荷を通知", tag: .notify, action: #selector(toggleNotify))
        addToggle(to: menu, title: "ログイン時に起動", tag: .loginItem, action: #selector(toggleLoginItem))

        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "RunThunder ⚡️ ブラックサンダー", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "終了", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        settingsMenu = menu
        refreshMenuStates()
        updateClaudeMenu()
        refreshLeaderboardMenu()
    }

    private func addToggle(to menu: NSMenu, title: String, tag: Tag, action: Selector) {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.tag = tag.rawValue
        item.target = self
        menu.addItem(item)
    }

    private func refreshMenuStates() {
        guard let menu = settingsMenu else { return }
        menu.item(withTag: Tag.targetCPU.rawValue)?.state = prefs.target == .cpu ? .on : .off
        menu.item(withTag: Tag.targetMemory.rawValue)?.state = prefs.target == .memory ? .on : .off
        menu.item(withTag: Tag.targetNetwork.rawValue)?.state = prefs.target == .network ? .on : .off
        menu.item(withTag: Tag.showText.rawValue)?.state = prefs.showUsageText ? .on : .off
        menu.item(withTag: Tag.showBlackThunder.rawValue)?.state = prefs.showBlackThunder ? .on : .off
        menu.item(withTag: Tag.showBatteryBar.rawValue)?.state = prefs.showBatteryBar ? .on : .off
        menu.item(withTag: Tag.templateIcon.rawValue)?.state = prefs.templateIcon ? .on : .off
        menu.item(withTag: Tag.notify.rawValue)?.state = prefs.notifyHighUsage ? .on : .off
        menu.item(withTag: Tag.loginItem.rawValue)?.state = LoginItem.isEnabled ? .on : .off
        menu.item(withTag: Tag.scopeToday.rawValue)?.state = prefs.blackThunderScope == .today ? .on : .off
        menu.item(withTag: Tag.scopeTotal.rawValue)?.state = prefs.blackThunderScope == .total ? .on : .off
    }

    // MARK: - メニューアクション

    @objc private func selectTarget(_ sender: NSMenuItem) {
        switch sender.tag {
        case Tag.targetMemory.rawValue: prefs.target = .memory
        case Tag.targetNetwork.rawValue: prefs.target = .network
        default: prefs.target = .cpu
        }
        refreshMenuStates()
    }

    @objc private func selectScope(_ sender: NSMenuItem) {
        prefs.blackThunderScope = (sender.tag == Tag.scopeTotal.rawValue) ? .total : .today
        refreshMenuStates()
        updateStatusText()
    }

    @objc private func toggleShowText() {
        prefs.showUsageText.toggle()
        refreshMenuStates()
        updateStatusText()
    }

    @objc private func toggleShowBlackThunder() {
        prefs.showBlackThunder.toggle()
        refreshMenuStates()
        updateStatusText()
    }

    @objc private func toggleShowBatteryBar() {
        prefs.showBatteryBar.toggle()
        batteryStatusItem.setVisible(prefs.showBatteryBar)
        refreshMenuStates()
    }

    @objc private func toggleTemplate() {
        prefs.templateIcon.toggle()
        AnimationLoader.applyTemplate(prefs.templateIcon, to: frames)
        statusItem.button?.image = frames.isEmpty ? nil : frames[frameIndex]
        refreshMenuStates()
    }

    @objc private func toggleNotify() {
        prefs.notifyHighUsage.toggle()
        if prefs.notifyHighUsage { notifier.requestAuthorization() }
        refreshMenuStates()
    }

    @objc private func toggleLoginItem() {
        LoginItem.setEnabled(!LoginItem.isEnabled)
        refreshMenuStates()
    }

    @objc private func refreshClaude() {
        settingsMenu?.item(withTag: Tag.claudeToday.rawValue)?.title = "🍫 今日: 取得中…"
        claudeUsage.refresh()
    }

    // MARK: - リーダーボード連携

    @objc private func connectLeaderboard() {
        settingsMenu?.item(withTag: Tag.leaderboardStatus.rawValue)?.title = "⚡️ 連携状態: ブラウザで認可中…"
        leaderboard.connect { [weak self] result in
            guard let self else { return }
            switch result {
            case .success:
                // 連携直後に最新の使用量を取得して同期する。
                self.claudeUsage.refresh()
            case .failure(let error):
                self.showLeaderboardAlert(title: "連携に失敗しました", message: error.localizedMessage)
            }
            self.refreshLeaderboardMenu()
        }
    }

    @objc private func syncLeaderboardNow() {
        guard leaderboard.isConnected else {
            showLeaderboardAlert(title: "未ログイン", message: "先に GitHub でログインしてください。")
            return
        }
        settingsMenu?.item(withTag: Tag.leaderboardStatus.rawValue)?.title = "⚡️ 連携状態: 同期中…"
        // 最新の使用量を取得してから同期（onUpdate 経由で自動同期される）。
        claudeUsage.refresh()
    }

    @objc private func disconnectLeaderboard() {
        leaderboard.disconnect()
        refreshLeaderboardMenu()
    }

    /// ダッシュボードのログイン/ログアウトボタンから呼ばれる。
    /// 別アクションを起こしたらポップオーバーは閉じる方針なので、まず閉じてから実行する。
    private func toggleLeaderboardFromDashboard() {
        popover.performClose(nil)
        if leaderboard.isConnected {
            disconnectLeaderboard()
        } else {
            connectLeaderboard()
        }
    }

    /// ダッシュボードのアカウント行（ログイン状態・ユーザー名・アバター）を更新する。
    private func refreshDashboardAccount() {
        dashboard.updateAccount(
            connected: leaderboard.isConnected,
            login: leaderboard.login,
            avatarURL: leaderboard.avatarURL
        )
    }

    /// 連携済みのときだけ同期する。使用量更新・タイマーから呼ばれる。
    private func syncLeaderboardIfConnected() {
        guard leaderboard.isConnected else { return }
        leaderboard.sync(from: claudeUsage) { [weak self] result in
            guard let self else { return }
            if case .failure(let error) = result, case .unauthorized = error {
                self.showLeaderboardAlert(title: "再連携が必要です", message: error.localizedMessage)
            }
            self.refreshLeaderboardMenu()
        }
    }

    private func refreshLeaderboardMenu() {
        guard let menu = settingsMenu else { return }
        let connected = leaderboard.isConnected

        // ログインボタン: 未ログイン=「GitHubでログイン」、ログイン済み=ユーザー名（あれば）。
        let connectItem = menu.item(withTag: Tag.leaderboardConnect.rawValue)
        if connected {
            connectItem?.title = leaderboard.login.map { "⚡️ @\($0)（ログイン中）" } ?? "⚡️ ログイン中"
            // ログイン済みのログインボタンは状態表示なので押せなくする。
            connectItem?.action = nil
        } else {
            connectItem?.title = "⚡️ GitHubでログイン"
            connectItem?.action = #selector(connectLeaderboard)
            connectItem?.target = self
        }

        // 状態・同期・ログアウトはログイン時のみ表示（未ログイン時は項目ごと隠す）。
        let statusItem = menu.item(withTag: Tag.leaderboardStatus.rawValue)
        statusItem?.isHidden = !connected
        statusItem?.title = "⚡️ 連携状態: \(leaderboard.statusDescription)"

        menu.item(withTag: Tag.leaderboardSync.rawValue)?.isHidden = !connected
        menu.item(withTag: Tag.leaderboardDisconnect.rawValue)?.isHidden = !connected
    }

    private func showLeaderboardAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    // MARK: - 監視

    private func startMonitoring() {
        let timer = Timer(timeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.updateMonitor()
        }
        RunLoop.main.add(timer, forMode: .common)
        monitorTimer = timer

        let claudeRefresh = Timer(timeInterval: 900, repeats: true) { [weak self] _ in
            self?.claudeUsage.refresh()
        }
        RunLoop.main.add(claudeRefresh, forMode: .common)
        claudeTimer = claudeRefresh

        // 連携済みなら定期的に同期（使用量に変化が無くても再送・失敗リトライ用）。
        let leaderboardSync = Timer(timeInterval: 600, repeats: true) { [weak self] _ in
            self?.syncLeaderboardIfConnected()
        }
        RunLoop.main.add(leaderboardSync, forMode: .common)
        leaderboardTimer = leaderboardSync
    }

    private func updateMonitor() {
        tickCount += 1

        snapshot.cpu = cpuMonitor.sample()
        snapshot.memory = memoryMonitor.sample()
        snapshot.network = networkMonitor.sample()

        // ストレージ・バッテリーは変化が遅いので 10 秒ごと（初回は即時）
        if tickCount == 1 || tickCount % 5 == 0 {
            snapshot.storage = storageMonitor.sample()
            snapshot.battery = batteryMonitor.sample()
        }

        cpuHistory.append(snapshot.cpu.total)
        if cpuHistory.count > historyLength {
            cpuHistory.removeFirst(cpuHistory.count - historyLength)
        }
        snapshot.cpuHistory = cpuHistory
        snapshot.claudeTodayTokens = claudeUsage.todayTokens
        snapshot.claudeTotalTokens = claudeUsage.totalTokens

        // アニメ速度の対象
        switch prefs.target {
        case .cpu:
            currentUsage = snapshot.cpu.total
        case .memory:
            currentUsage = snapshot.memory.usage
        case .network:
            let combined = networkMonitor.combinedBytesPerSecond(snapshot.network)
            currentUsage = min(combined / networkFullScale, 1.0)
        }

        updateStatusText()
        restartAnimation(interval: intervalForUsage(currentUsage))

        if prefs.notifyHighUsage {
            notifier.evaluate(usage: currentUsage, targetLabel: prefs.target.label)
        }

        if popover.isShown {
            dashboard.update(snapshot)
        }
    }

    private func updateStatusText() {
        if let item = settingsMenu?.item(withTag: Tag.usage.rawValue) {
            item.title = "\(prefs.target.shortLabel): \(currentValueString())"
        }

        var parts: [String] = []
        if prefs.showUsageText { parts.append(currentValueString()) }
        if prefs.showBlackThunder { parts.append("🍫\(barCountString())") }
        statusItem.button?.title = parts.isEmpty ? "" : " " + parts.joined(separator: " ")
    }

    private func currentValueString() -> String {
        switch prefs.target {
        case .cpu, .memory:
            return String(format: "%.0f%%", currentUsage * 100)
        case .network:
            return ByteFormat.speed(networkMonitor.combinedBytesPerSecond(snapshot.network))
        }
    }

    private func barCountString() -> String {
        let tokens = prefs.blackThunderScope == .total ? claudeUsage.totalTokens : claudeUsage.todayTokens
        return String(format: "%.1f", ClaudeUsageMonitor.bars(forTokens: tokens))
    }

    private func intervalForUsage(_ usage: Double) -> TimeInterval {
        let clamped = min(max(usage, 0), 1)
        return slowestInterval - (slowestInterval - fastestInterval) * clamped
    }

    // MARK: - Claude 使用量メニュー

    private func updateClaudeMenu() {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal

        func line(prefix: String, tokens: Int) -> String {
            let bars = ClaudeUsageMonitor.bars(forTokens: tokens)
            let tokenStr = formatter.string(from: NSNumber(value: tokens)) ?? "\(tokens)"
            return String(format: "%@ %.1f本分 (%@ tok)", prefix, bars, tokenStr)
        }

        if let error = claudeUsage.lastError, claudeUsage.lastUpdated == nil {
            settingsMenu?.item(withTag: Tag.claudeToday.rawValue)?.title = "🍫 取得失敗"
            settingsMenu?.item(withTag: Tag.claudeTotal.rawValue)?.title = "🍫 \(error.prefix(40))"
        } else {
            settingsMenu?.item(withTag: Tag.claudeToday.rawValue)?.title = line(prefix: "🍫 今日:", tokens: claudeUsage.todayTokens)
            settingsMenu?.item(withTag: Tag.claudeTotal.rawValue)?.title = line(prefix: "🍫 累計:", tokens: claudeUsage.totalTokens)
        }

        updateStatusText()

        // ダッシュボード表示中なら 🍫 表記も即時反映
        if popover.isShown {
            snapshot.claudeTodayTokens = claudeUsage.todayTokens
            snapshot.claudeTotalTokens = claudeUsage.totalTokens
            dashboard.update(snapshot)
        }
    }

    // MARK: - アニメーション

    private func restartAnimation(interval: TimeInterval) {
        animationTimer?.invalidate()
        guard !frames.isEmpty else { return }
        let timer = Timer(timeInterval: interval, repeats: true) { [weak self] _ in
            self?.advanceFrame()
        }
        RunLoop.main.add(timer, forMode: .common)
        animationTimer = timer
    }

    private func advanceFrame() {
        guard !frames.isEmpty else { return }
        frameIndex = (frameIndex + 1) % frames.count
        statusItem.button?.image = frames[frameIndex]
    }
}
