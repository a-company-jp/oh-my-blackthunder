import AppKit

/// メニューバーに **2 つ目の常駐アイコン** として、ブラックサンダーの板チョコで
/// バッテリー残量を表示する。走るキャラ（メインの `NSStatusItem`）とは独立した
/// `NSStatusItem` を持ち、独自のタイマーで更新する。
///
/// 走るキャラは「フレーム画像の差し替え」で動くのに対し、こちらは電池の変化が
/// 遅いので、残量に応じてチョコ画像を生成し直して差し替える（既定 60 秒ごと）。
/// 旧 `blackthunder-battery` 単体アプリの描画ロジックをここに統合している。
final class BatteryStatusItem {

    private var statusItem: NSStatusItem?
    private var updateTimer: Timer?

    private let monitor = BatteryMonitor()
    private let chocolate: NSImage

    // メニュー項目（残量・状態の表示）。
    private let pctItem = NSMenuItem(title: "残量: --%", action: nil, keyEquivalent: "")
    private let stateItem = NSMenuItem(title: "状態: --", action: nil, keyEquivalent: "")

    /// 「終了」など、メインアプリ側のアクションへ橋渡しするためのハンドラ。
    var onQuit: (() -> Void)?

    init() {
        // チョコ画像はアプリバンドルの Resources 直下から読み込む（build_app.sh が配置）。
        if let url = Bundle.main.resourceURL?.appendingPathComponent("chocolate.png"),
           let img = NSImage(contentsOf: url) {
            chocolate = img
        } else {
            chocolate = NSImage(size: NSSize(width: 36, height: 18))
        }
    }

    // MARK: - 表示 ON/OFF

    /// 設定に応じて 2 つ目のアイコンを出す/しまう。
    func setVisible(_ visible: Bool) {
        if visible {
            show()
        } else {
            hide()
        }
    }

    var isVisible: Bool { statusItem != nil }

    private func show() {
        guard statusItem == nil else { return }

        // バッテリー非搭載機（デスクトップ）では表示しない。
        guard monitor.sample() != nil else { return }

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.imagePosition = .imageLeading
        item.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        item.menu = buildMenu()
        statusItem = item

        update()

        // 電池は変化が遅いので 60 秒ごと。スリープ復帰時も更新する。
        let timer = Timer(timeInterval: 60, repeats: true) { [weak self] _ in
            self?.update()
        }
        RunLoop.main.add(timer, forMode: .common)
        updateTimer = timer

        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(update),
            name: NSWorkspace.didWakeNotification, object: nil)
    }

    private func hide() {
        guard let item = statusItem else { return }
        updateTimer?.invalidate()
        updateTimer = nil
        NSWorkspace.shared.notificationCenter.removeObserver(self)
        NSStatusBar.system.removeStatusItem(item)
        statusItem = nil
    }

    // MARK: - 更新

    @objc private func update() {
        guard let stats = monitor.sample() else {
            // 途中でバッテリーが取得できなくなったら畳む（外部GPU切替などの保険）。
            hide()
            return
        }

        let percent = Int((stats.percent * 100).rounded())
        let image = ChocoRenderer.image(chocolate: chocolate, percent: percent, charging: stats.isCharging)
        statusItem?.button?.image = image
        statusItem?.button?.title = " \(percent)%"

        pctItem.title = "残量: \(percent)%"
        stateItem.title = stats.isCharging
            ? "状態: 充電中 ⚡️"
            : (stats.powerSource == "電源アダプタ" ? "状態: 電源接続" : "状態: 放電中")
    }

    // MARK: - メニュー

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()

        let header = NSMenuItem(title: "🍫 ブラックサンダー バッテリー", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())

        pctItem.isEnabled = false
        stateItem.isEnabled = false
        menu.addItem(pctItem)
        menu.addItem(stateItem)

        menu.addItem(.separator())

        let refresh = NSMenuItem(title: "今すぐ更新", action: #selector(update), keyEquivalent: "")
        refresh.target = self
        menu.addItem(refresh)

        let quit = NSMenuItem(title: "終了", action: #selector(quitClicked), keyEquivalent: "")
        quit.target = self
        menu.addItem(quit)

        return menu
    }

    @objc private func quitClicked() {
        onQuit?()
    }
}

// MARK: - チョコ画像の描画（残量に応じて食べられていく）

/// 旧 `blackthunder-battery` の `ChocoRenderer` を移植。残量ぶんだけ左にチョコが
/// 残り、食べられた右側は薄く描く。充電中は中央に黄色い稲妻を重ねる。
enum ChocoRenderer {
    static func image(chocolate src: NSImage, percent: Int, charging: Bool) -> NSImage {
        let H: CGFloat = 18
        let aspect = src.size.width > 0 ? src.size.width / src.size.height : 2.0
        let W = (H * aspect).rounded()
        let pct = CGFloat(min(100, max(0, percent)))
        let fill = (W * pct / 100).rounded()

        let out = NSImage(size: NSSize(width: W, height: H))
        out.lockFocus()
        let ctx = NSGraphicsContext.current
        ctx?.imageInterpolation = .high

        let fullRect = NSRect(x: 0, y: 0, width: W, height: H)

        // 残っているチョコ（左）
        if fill > 0 {
            ctx?.saveGraphicsState()
            NSBezierPath(rect: NSRect(x: 0, y: 0, width: fill, height: H)).setClip()
            src.draw(in: fullRect, from: .zero, operation: .sourceOver, fraction: 1.0)
            ctx?.restoreGraphicsState()
        }

        // 食べられた部分（右）= 空きスロット。薄いチョコ
        if fill < W {
            ctx?.saveGraphicsState()
            NSBezierPath(rect: NSRect(x: fill, y: 0, width: W - fill, height: H)).setClip()
            src.draw(in: fullRect, from: .zero, operation: .sourceOver, fraction: 0.18)
            ctx?.restoreGraphicsState()
        }

        // 残量わずか（20%以下）は境界に赤ライン
        if percent <= 20 && fill > 0 && fill < W {
            NSColor(calibratedRed: 0.9, green: 0.16, blue: 0.16, alpha: 1).setStroke()
            let line = NSBezierPath()
            line.lineWidth = 1.5
            line.move(to: NSPoint(x: fill, y: 1))
            line.line(to: NSPoint(x: fill, y: H - 1))
            line.stroke()
        }

        // 充電中は黄色い稲妻（サンダー）
        if charging {
            let cx = W / 2
            let bolt = NSBezierPath()
            bolt.move(to: NSPoint(x: cx + 2, y: H - 2))
            bolt.line(to: NSPoint(x: cx - 4, y: H / 2 - 1))
            bolt.line(to: NSPoint(x: cx, y: H / 2 - 1))
            bolt.line(to: NSPoint(x: cx - 2, y: 2))
            bolt.line(to: NSPoint(x: cx + 5, y: H / 2 + 2))
            bolt.line(to: NSPoint(x: cx + 1, y: H / 2 + 2))
            bolt.close()
            NSColor(calibratedRed: 1.0, green: 0.84, blue: 0.04, alpha: 1).setFill()
            bolt.fill()
            NSColor(calibratedWhite: 0.15, alpha: 1).setStroke()
            bolt.lineWidth = 0.7
            bolt.stroke()
        }

        out.unlockFocus()
        out.isTemplate = false
        return out
    }
}
