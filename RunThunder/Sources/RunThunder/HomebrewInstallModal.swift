import AppKit

/// 「Homebrew でインストール」モーダル。
///
/// RunThunder を Homebrew Cask で入れるコマンドを大きく表示し、ボタンひとつで
/// クリップボードにコピーできる。メニューバーのポップオーバーは .transient で
/// すぐ閉じてしまうため、独立した modal ウィンドウとして runModal で表示する。
final class HomebrewInstallModal: NSObject, NSWindowDelegate {

    /// 表示・コピー対象のインストールコマンド。
    static let command = "brew tap a-company-jp/tap && brew install --cask runthunder"

    private var window: NSWindow?
    private var copyButton: NSButton?
    /// 「コピーしました」表示を元に戻すためのタイマー。
    private var revertTimer: Timer?

    /// モーダルを表示する（閉じるまでブロックする）。
    func present() {
        let content = makeContentView()

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 220),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "RunThunder を Homebrew でインストール"
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        window.appearance = NSAppearance(named: .darkAqua)
        window.contentView = content
        window.delegate = self   // 閉じるボタン → windowWillClose で stopModal
        window.center()
        self.window = window

        NSApp.activate(ignoringOtherApps: true)
        NSApp.runModal(for: window)   // 閉じるまでブロック
        window.orderOut(nil)
        revertTimer?.invalidate()
        window.delegate = nil
        self.window = nil
    }

    /// タイトルバーの閉じるボタン／Esc／「閉じる」ボタンで window が閉じるとき modal を抜ける。
    func windowWillClose(_ notification: Notification) {
        NSApp.stopModal()
    }

    // MARK: - View 構築

    private func makeContentView() -> NSView {
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = BlackThunder.background.cgColor

        // 見出し（🍺 Homebrew）
        let heading = NSTextField(labelWithString: "🍺 Homebrew でインストール")
        heading.font = .systemFont(ofSize: 15, weight: .bold)
        heading.textColor = BlackThunder.titleText

        let subtitle = NSTextField(labelWithString: "下のコマンドをターミナルに貼り付けて実行してください。")
        subtitle.font = .systemFont(ofSize: 12)
        subtitle.textColor = BlackThunder.detailText

        // コマンド表示（等幅・選択可・ダークボックス）
        let commandField = NSTextField(labelWithString: Self.command)
        commandField.font = .monospacedSystemFont(ofSize: 12, weight: .medium)
        commandField.textColor = BlackThunder.gold
        commandField.isSelectable = true
        commandField.lineBreakMode = .byTruncatingMiddle
        commandField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let box = NSView()
        box.wantsLayer = true
        box.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.45).cgColor
        box.layer?.cornerRadius = 8
        box.layer?.borderWidth = 1
        box.layer?.borderColor = BlackThunder.gold.withAlphaComponent(0.35).cgColor
        box.translatesAutoresizingMaskIntoConstraints = false
        commandField.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(commandField)
        NSLayoutConstraint.activate([
            commandField.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
            commandField.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12),
            commandField.centerYAnchor.constraint(equalTo: box.centerYAnchor),
            box.heightAnchor.constraint(equalToConstant: 40),
        ])

        // コピー / 閉じる
        let copyButton = NSButton(title: "コマンドをコピー", target: self, action: #selector(copyCommand))
        copyButton.bezelStyle = .rounded
        copyButton.keyEquivalent = "\r"   // Enter で実行
        self.copyButton = copyButton

        let closeButton = NSButton(title: "閉じる", target: self, action: #selector(closeModal))
        closeButton.bezelStyle = .rounded
        closeButton.keyEquivalent = "\u{1b}" // Esc で閉じる

        let buttons = NSStackView(views: [closeButton, copyButton])
        buttons.orientation = .horizontal
        buttons.spacing = 10

        let stack = NSStackView(views: [heading, subtitle, box, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: root.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -20),
            box.widthAnchor.constraint(equalTo: stack.widthAnchor),
            // ボタン列は右寄せにしたいので幅いっぱい＋trailing 揃え
            buttons.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
        ])

        return root
    }

    // MARK: - アクション

    @objc private func copyCommand() {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(Self.command, forType: .string)

        // ボタン表示を一時的に「コピーしました ✓」に。
        copyButton?.title = "コピーしました ✓"
        revertTimer?.invalidate()
        revertTimer = Timer.scheduledTimer(withTimeInterval: 1.6, repeats: false) { [weak self] _ in
            self?.copyButton?.title = "コマンドをコピー"
        }
    }

    @objc private func closeModal() {
        window?.close()
    }
}
