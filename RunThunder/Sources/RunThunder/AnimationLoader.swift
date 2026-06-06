import AppKit

/// メニューバーに表示するコマ画像を提供する。
///
/// 優先順位:
///   1. アプリバンドル内 Resources/Frames/*.png （ファイル名昇順）
///   2. 上記が無ければ、コードで生成する「ブラックサンダー風」の仮フレーム
enum AnimationLoader {

    /// メニューバー上での表示高さ（ポイント）。
    static let barHeight: CGFloat = 18

    static func loadFrames() -> [NSImage] {
        if let bundled = loadBundledFrames(), !bundled.isEmpty {
            return bundled
        }
        return makePlaceholderFrames()
    }

    /// テンプレート表示（メニューバーの明暗に追従する単色描画）の ON/OFF を反映する。
    static func applyTemplate(_ isTemplate: Bool, to frames: [NSImage]) {
        frames.forEach { $0.isTemplate = isTemplate }
    }

    // MARK: - バンドル画像の読み込み

    private static func loadBundledFrames() -> [NSImage]? {
        guard let resourceURL = Bundle.main.resourceURL else { return nil }
        let framesDir = resourceURL.appendingPathComponent("Frames", isDirectory: true)

        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: framesDir,
            includingPropertiesForKeys: nil
        ) else { return nil }

        let pngs = urls
            .filter { $0.pathExtension.lowercased() == "png" }
            .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }

        let images = pngs.compactMap { url -> NSImage? in
            guard let image = NSImage(contentsOf: url) else { return nil }
            return scaledToBarHeight(image)
        }

        return images.isEmpty ? nil : images
    }

    /// 高解像度の元ビットマップは保持したまま、論理サイズ（ポイント）だけを
    /// メニューバー高さに合わせる。Retina でも縮小描画されて鮮明になる。
    private static func scaledToBarHeight(_ image: NSImage) -> NSImage {
        let aspect = image.size.width / max(image.size.height, 1)
        image.size = NSSize(width: barHeight * aspect, height: barHeight)
        return image
    }

    // MARK: - 仮フレーム生成（本番画像が無いとき用）

    /// 黒いチョコバー＋稲妻のキャラが脚を交互に動かして走る、簡易6コマ。
    private static func makePlaceholderFrames() -> [NSImage] {
        let frameCount = 6
        return (0..<frameCount).map { makePlaceholderFrame(index: $0, of: frameCount) }
    }

    private static func makePlaceholderFrame(index: Int, of count: Int) -> NSImage {
        let height = barHeight
        let width: CGFloat = height * 1.4
        let image = NSImage(size: NSSize(width: width, height: height))

        image.lockFocus()
        defer { image.unlockFocus() }

        let phase = CGFloat(index) / CGFloat(count) // 0.0〜1.0
        let bob = sin(phase * .pi * 2) * (height * 0.06) // 上下の揺れ

        // 本体（黒いチョコバー）
        let bodyMargin = height * 0.12
        let bodyRect = NSRect(
            x: bodyMargin,
            y: height * 0.32 + bob,
            width: width - bodyMargin * 2,
            height: height * 0.5
        )
        let body = NSBezierPath(roundedRect: bodyRect, xRadius: 2, yRadius: 2)
        NSColor.black.setFill()
        body.fill()

        // 表面のスジ（チョコのモールド風）
        NSColor(white: 0.35, alpha: 1).setStroke()
        let line = NSBezierPath()
        line.lineWidth = 0.6
        let stripes = 3
        for i in 1...stripes {
            let x = bodyRect.minX + bodyRect.width * CGFloat(i) / CGFloat(stripes + 1)
            line.move(to: NSPoint(x: x, y: bodyRect.minY + 1))
            line.line(to: NSPoint(x: x, y: bodyRect.maxY - 1))
        }
        line.stroke()

        // 稲妻（Thunder）マーク
        let bolt = NSBezierPath()
        let cx = bodyRect.midX
        let cy = bodyRect.midY
        let s = height * 0.18
        bolt.move(to: NSPoint(x: cx - s * 0.3, y: cy + s))
        bolt.line(to: NSPoint(x: cx + s * 0.3, y: cy + s * 0.1))
        bolt.line(to: NSPoint(x: cx - s * 0.05, y: cy + s * 0.1))
        bolt.line(to: NSPoint(x: cx + s * 0.3, y: cy - s))
        bolt.line(to: NSPoint(x: cx - s * 0.3, y: cy - s * 0.1))
        bolt.line(to: NSPoint(x: cx + s * 0.05, y: cy - s * 0.1))
        bolt.close()
        NSColor.systemYellow.setFill()
        bolt.fill()

        // 脚（交互に動かして「走り」を表現）
        NSColor.black.setStroke()
        let legs = NSBezierPath()
        legs.lineWidth = height * 0.08
        legs.lineCapStyle = .round
        let legTop = bodyRect.minY + bob
        let legSwing = sin(phase * .pi * 2) * (width * 0.12)
        // 左脚
        legs.move(to: NSPoint(x: bodyRect.midX - width * 0.12, y: legTop))
        legs.line(to: NSPoint(x: bodyRect.midX - width * 0.12 + legSwing, y: height * 0.1))
        // 右脚
        legs.move(to: NSPoint(x: bodyRect.midX + width * 0.12, y: legTop))
        legs.line(to: NSPoint(x: bodyRect.midX + width * 0.12 - legSwing, y: height * 0.1))
        legs.stroke()

        return image
    }
}
