import AppKit

/// メニューバーアイコンをクリックすると開くダッシュボード（ポップオーバーの中身）。
final class DashboardViewController: NSViewController {

    /// 「アクティビティモニタを開く」「終了」ボタンの動作。
    var onOpenActivityMonitor: (() -> Void)?
    var onQuit: (() -> Void)?

    private let dataWidth: CGFloat = 250

    // 各セクションのラベル（update で書き換える）
    private let cpuTitle = DashboardViewController.titleLabel()
    private let cpuDetail = DashboardViewController.detailLabel()
    private let sparkline = SparklineView()

    private let memTitle = DashboardViewController.titleLabel()
    private let memDetail = DashboardViewController.detailLabel()

    private let storageTitle = DashboardViewController.titleLabel()
    private let storageDetail = DashboardViewController.detailLabel()
    private let storageBar = UsageBarView()

    private let batteryTitle = DashboardViewController.titleLabel()
    private let batteryDetail = DashboardViewController.detailLabel()
    private var batteryRow: NSView!
    private var batterySeparator: NSView!

    private let netTitle = DashboardViewController.titleLabel()
    private let netDetail = DashboardViewController.detailLabel()

    private let todayCard = BlackThunderTodayCard()

    private var contentStack: NSStackView!

    override func loadView() {
        let dataStack = NSStackView()
        dataStack.orientation = .vertical
        dataStack.alignment = .leading
        dataStack.spacing = 12
        dataStack.translatesAutoresizingMaskIntoConstraints = false

        // CPU
        dataStack.addArrangedSubview(makeRow(symbol: "cpu", title: cpuTitle, detail: cpuDetail, extra: sparkline))
        dataStack.addArrangedSubview(makeSeparator())
        // Memory
        dataStack.addArrangedSubview(makeRow(symbol: "memorychip", title: memTitle, detail: memDetail))
        dataStack.addArrangedSubview(makeSeparator())
        // Storage
        dataStack.addArrangedSubview(makeRow(symbol: "internaldrive", title: storageTitle, detail: storageDetail, extra: storageBar))
        dataStack.addArrangedSubview(makeSeparator())
        // Battery（非搭載なら隠す）
        batteryRow = makeRow(symbol: "battery.100", title: batteryTitle, detail: batteryDetail)
        batterySeparator = makeSeparator()
        dataStack.addArrangedSubview(batteryRow)
        dataStack.addArrangedSubview(batterySeparator)
        // Network（データ部の最後の行）
        dataStack.addArrangedSubview(makeRow(symbol: "globe", title: netTitle, detail: netDetail))
        // 末尾に実体のあるスペーサ（edgeInsets.bottom は fittingSize に反映されないため）
        let bottomSpacer = NSView()
        bottomSpacer.translatesAutoresizingMaskIntoConstraints = false
        bottomSpacer.heightAnchor.constraint(equalToConstant: 44).isActive = true
        dataStack.addArrangedSubview(bottomSpacer)

        // 右側ボタン列
        let buttonStack = NSStackView(views: [
            makeButton(symbol: "waveform.path.ecg", title: "アクティビティ", action: #selector(openActivityMonitor)),
            makeButton(symbol: "power", title: "終了", action: #selector(quit)),
        ])
        buttonStack.orientation = .vertical
        buttonStack.alignment = .centerX
        buttonStack.spacing = 10
        buttonStack.translatesAutoresizingMaskIntoConstraints = false

        let content = NSStackView(views: [dataStack, buttonStack])
        content.orientation = .horizontal
        content.alignment = .top
        content.spacing = 14
        content.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            dataStack.widthAnchor.constraint(equalToConstant: dataWidth + 44),
            buttonStack.widthAnchor.constraint(equalToConstant: 92),
        ])
        contentStack = content

        // 「今日のブラックサンダー」カードを一番上・横幅いっぱい（ボタン列含む全幅）に。
        todayCard.translatesAutoresizingMaskIntoConstraints = false

        let outer = NSStackView(views: [todayCard, content])
        outer.orientation = .vertical
        outer.alignment = .leading
        outer.spacing = 12
        outer.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 0, right: 16)
        outer.translatesAutoresizingMaskIntoConstraints = false
        // 同一階層（outer）に入ってから全幅制約を有効化する。
        todayCard.widthAnchor.constraint(equalTo: content.widthAnchor).isActive = true

        // 最背面にブラックサンダーの断面背景を敷く。
        let container = NSView()
        let background = BlackThunderBackgroundView()
        background.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(background)
        container.addSubview(outer)
        NSLayoutConstraint.activate([
            background.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            background.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            background.topAnchor.constraint(equalTo: container.topAnchor),
            background.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            outer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            outer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            outer.topAnchor.constraint(equalTo: container.topAnchor),
            outer.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        view = container
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        updatePreferredSize()
    }

    /// 内容の高さに合わせてポップオーバーサイズを決める。
    func updatePreferredSize() {
        view.layoutSubtreeIfNeeded()
        preferredContentSize = view.fittingSize
    }

    // MARK: - 更新

    func update(_ snap: SystemSnapshot) {
        let cpu = snap.cpu
        cpuTitle.stringValue = String(format: "CPU: %.1f%%", cpu.total * 100)
        cpuDetail.stringValue = String(
            format: "System: %.1f%%\nUser: %.1f%%\nIdle: %.1f%%",
            cpu.system * 100, cpu.user * 100, cpu.idle * 100
        )
        sparkline.values = snap.cpuHistory

        let mem = snap.memory
        memTitle.stringValue = String(format: "メモリ: %.1f%%", mem.usage * 100)
        memDetail.stringValue = String(
            format: "Pressure: %.1f%%\nApp Memory: %@\nWired Memory: %@\nCompressed: %@",
            mem.pressure * 100,
            ByteFormat.gb(mem.appBytes),
            ByteFormat.gb(mem.wiredBytes),
            ByteFormat.gb(mem.compressedBytes)
        )

        let st = snap.storage
        storageTitle.stringValue = String(format: "ストレージ: %.1f%% 使用", st.usedFraction * 100)
        storageDetail.stringValue = "\(ByteFormat.gb(st.usedBytes)) / \(ByteFormat.gb(st.totalBytes))"
        storageBar.fraction = st.usedFraction

        if let bat = snap.battery {
            batteryRow.isHidden = false
            batterySeparator.isHidden = false
            batteryTitle.stringValue = String(format: "バッテリー: %.1f%%", bat.percent * 100)
            var lines = ["電源: \(bat.powerSource)"]
            if let cap = bat.maxCapacityPercent { lines.append(String(format: "最大容量: %.1f%%", cap)) }
            if let cycles = bat.cycleCount { lines.append("充放電回数: \(cycles)") }
            if let temp = bat.temperatureC { lines.append(String(format: "温度: %.1f°C", temp)) }
            batteryDetail.stringValue = lines.joined(separator: "\n")
        } else {
            batteryRow.isHidden = true
            batterySeparator.isHidden = true
        }

        let net = snap.network
        netTitle.stringValue = "ネットワーク: \(net.interfaceName)"
        netDetail.stringValue = String(
            format: "ローカルIP: %@\n上り: %@\n下り: %@",
            net.localIP,
            ByteFormat.speed(net.uploadBps),
            ByteFormat.speed(net.downloadBps)
        )

        let todayBars = ClaudeUsageMonitor.bars(forTokens: snap.claudeTodayTokens)
        let totalBars = ClaudeUsageMonitor.bars(forTokens: snap.claudeTotalTokens)
        todayCard.update(todayBars: todayBars, todayTokens: snap.claudeTodayTokens, totalBars: totalBars)
    }

    // MARK: - ボタン

    @objc private func openActivityMonitor() { onOpenActivityMonitor?() }
    @objc private func quit() { onQuit?() }

    // MARK: - UI 部品

    private func makeRow(symbol: String, title: NSTextField, detail: NSTextField, extra: NSView? = nil, iconTint: NSColor = BlackThunder.gold) -> NSView {
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
        icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 26, weight: .regular)
        icon.contentTintColor = iconTint
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.setContentHuggingPriority(.required, for: .horizontal)
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 34),
            icon.heightAnchor.constraint(equalToConstant: 34),
        ])

        let textStack = NSStackView(views: [title, detail])
        textStack.orientation = .vertical
        textStack.alignment = .leading
        textStack.spacing = 4
        if let extra {
            extra.translatesAutoresizingMaskIntoConstraints = false
            extra.widthAnchor.constraint(equalToConstant: dataWidth).isActive = true
            textStack.addArrangedSubview(extra)
        }
        title.widthAnchor.constraint(equalToConstant: dataWidth).isActive = true
        detail.widthAnchor.constraint(equalToConstant: dataWidth).isActive = true
        detail.preferredMaxLayoutWidth = dataWidth   // 複数行の高さを正しく計算させる

        let row = NSStackView(views: [icon, textStack])
        row.orientation = .horizontal
        row.alignment = .top
        row.spacing = 10
        return row
    }

    private func makeSeparator() -> NSView {
        let line = JaggedSeparatorView()
        line.translatesAutoresizingMaskIntoConstraints = false
        line.widthAnchor.constraint(equalToConstant: dataWidth + 44).isActive = true
        line.heightAnchor.constraint(equalToConstant: 7).isActive = true
        return line
    }

    // アイコンとラベルの間隔（pt）。ここを変えると両ボタンの間隔が変わる。
    private let buttonIconLabelSpacing: CGFloat = 8

    private func makeButton(symbol: String, title: String, action: Selector) -> NSButton {
        let button = VerticalIconButton(
            symbol: symbol,
            title: title,
            iconPointSize: 20,
            spacing: buttonIconLabelSpacing,
            target: self,
            action: action
        )
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 84),
            button.heightAnchor.constraint(equalToConstant: 64),
        ])
        return button
    }

    private static func titleLabel() -> NSTextField {
        let label = NSTextField(labelWithString: "")
        label.font = .systemFont(ofSize: 15, weight: .semibold)
        label.textColor = BlackThunder.titleText
        label.lineBreakMode = .byTruncatingTail
        return label
    }

    private static func detailLabel() -> NSTextField {
        let label = NSTextField(labelWithString: "")
        label.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        label.textColor = BlackThunder.detailText
        label.lineBreakMode = .byWordWrapping
        label.maximumNumberOfLines = 0
        return label
    }
}
