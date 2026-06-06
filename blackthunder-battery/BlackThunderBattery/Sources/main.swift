import Cocoa
import IOKit.ps

// MARK: - バッテリー情報

struct BatteryInfo {
    var percent: Int          // 0-100
    var isCharging: Bool
    var isPluggedIn: Bool
    var timeToEmpty: Int      // 分。-1 = 不明/計算中
    var timeToFull: Int       // 分。-1 = 不明/計算中

    static func current() -> BatteryInfo {
        guard let snap = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(snap)?.takeRetainedValue() as? [CFTypeRef],
              let first = sources.first,
              let desc = IOPSGetPowerSourceDescription(snap, first)?.takeUnretainedValue() as? [String: Any]
        else {
            return BatteryInfo(percent: 0, isCharging: false, isPluggedIn: false,
                               timeToEmpty: -1, timeToFull: -1)
        }

        let cur = desc[kIOPSCurrentCapacityKey] as? Int ?? 0
        let max = desc[kIOPSMaxCapacityKey] as? Int ?? 100
        let pct = max > 0 ? Int((Double(cur) / Double(max) * 100).rounded()) : 0

        let state = desc[kIOPSPowerSourceStateKey] as? String ?? ""
        let pluggedIn = (state == kIOPSACPowerValue)
        let charging = desc[kIOPSIsChargingKey] as? Bool ?? false

        let toEmpty = desc[kIOPSTimeToEmptyKey] as? Int ?? -1
        let toFull = desc[kIOPSTimeToFullChargeKey] as? Int ?? -1

        return BatteryInfo(percent: pct, isCharging: charging, isPluggedIn: pluggedIn,
                           timeToEmpty: toEmpty, timeToFull: toFull)
    }
}

// MARK: - チョコ画像の描画（残量に応じて食べられていく）

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

        // 食べられた部分（右）= 空きスロット。薄いチョコ＋グレー枠
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

// MARK: - アプリ本体

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var timer: Timer?
    var chocolate: NSImage!

    let pctItem = NSMenuItem(title: "残量: --%", action: nil, keyEquivalent: "")
    let stateItem = NSMenuItem(title: "状態: --", action: nil, keyEquivalent: "")
    let timeItem = NSMenuItem(title: "残り: --", action: nil, keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // チョコ画像をバンドルから読み込み
        if let path = Bundle.main.path(forResource: "chocolate", ofType: "png"),
           let img = NSImage(contentsOfFile: path) {
            chocolate = img
        } else {
            chocolate = NSImage(size: NSSize(width: 36, height: 18))
        }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.imagePosition = .imageLeft
        statusItem.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)

        buildMenu()
        update()

        // 60秒ごとに更新 + 電源状態変化を監視
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.update()
        }
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(update),
            name: NSWorkspace.didWakeNotification, object: nil)
    }

    func buildMenu() {
        let menu = NSMenu()
        let header = NSMenuItem(title: "🍫 ブラックサンダー バッテリー", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())
        pctItem.isEnabled = false
        stateItem.isEnabled = false
        timeItem.isEnabled = false
        menu.addItem(pctItem)
        menu.addItem(stateItem)
        menu.addItem(timeItem)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "今すぐ更新", action: #selector(update), keyEquivalent: "r"))
        menu.addItem(NSMenuItem(title: "終了", action: #selector(quit), keyEquivalent: "q"))
        statusItem.menu = menu
    }

    @objc func update() {
        let b = BatteryInfo.current()
        let img = ChocoRenderer.image(chocolate: chocolate, percent: b.percent, charging: b.isCharging)
        statusItem.button?.image = img
        statusItem.button?.title = " \(b.percent)%"

        pctItem.title = "残量: \(b.percent)%"
        if b.isCharging {
            stateItem.title = "状態: 充電中 ⚡"
            timeItem.title = b.timeToFull > 0 ? "満充電まで: \(fmt(b.timeToFull))" : "満充電まで: 計算中…"
        } else if b.isPluggedIn {
            stateItem.title = "状態: 電源接続（満充電）"
            timeItem.title = "残り: ―"
        } else {
            stateItem.title = "状態: 放電中"
            timeItem.title = b.timeToEmpty > 0 ? "残り: \(fmt(b.timeToEmpty))" : "残り: 計算中…"
        }
    }

    func fmt(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        return h > 0 ? "\(h)時間\(m)分" : "\(m)分"
    }

    @objc func quit() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)   // Dockに出さない常駐アプリ
let delegate = AppDelegate()
app.delegate = delegate
app.run()
