import AppKit

/// アイコンを上、ラベルを下に置き、その間隔を自由に指定できるボタン。
/// （NSButton 標準の imageHugsTitle では間隔を調整できないため）
final class VerticalIconButton: NSButton {

    private let iconView = NSImageView()
    private let label = NSTextField(labelWithString: "")

    init(symbol: String, title: String, iconPointSize: CGFloat, spacing: CGFloat, target: AnyObject?, action: Selector) {
        super.init(frame: .zero)
        self.target = target
        self.action = action
        self.title = ""
        self.image = nil
        bezelStyle = .regularSquare

        let config = NSImage.SymbolConfiguration(pointSize: iconPointSize, weight: .regular)
        iconView.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(config)
        iconView.contentTintColor = BlackThunder.gold

        label.stringValue = title
        label.font = .systemFont(ofSize: 11)
        label.alignment = .center
        label.textColor = BlackThunder.titleText

        let stack = NSStackView(views: [iconView, label])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = spacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // 内部のアイコン/ラベルではなくボタン自身がクリックを受けるようにする
    override func hitTest(_ point: NSPoint) -> NSView? {
        super.hitTest(point) == nil ? nil : self
    }
}

/// CPU 履歴を折れ線＋塗りで描くスパークライン。値は 0.0〜1.0。
final class SparklineView: NSView {
    var values: [Double] = [] {
        didSet { needsDisplay = true }
    }

    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: 32)
    }

    override func draw(_ dirtyRect: NSRect) {
        guard values.count > 1 else { return }
        let w = bounds.width
        let h = bounds.height
        let stepX = w / CGFloat(values.count - 1)

        func point(_ i: Int) -> NSPoint {
            let v = CGFloat(min(max(values[i], 0), 1))
            return NSPoint(x: CGFloat(i) * stepX, y: v * (h - 2) + 1)
        }

        let fill = NSBezierPath()
        fill.move(to: NSPoint(x: 0, y: 0))
        let line = NSBezierPath()
        for i in values.indices {
            let p = point(i)
            if i == 0 { line.move(to: p) } else { line.line(to: p) }
            fill.line(to: p)
        }
        fill.line(to: NSPoint(x: w, y: 0))
        fill.close()

        BlackThunder.accent.withAlphaComponent(0.22).setFill()
        fill.fill()
        BlackThunder.accent.setStroke()
        line.lineWidth = 1.5
        line.stroke()
    }
}

/// 使用率の横バー（角丸）。fraction は 0.0〜1.0。
final class UsageBarView: NSView {
    var fraction: Double = 0 {
        didSet { needsDisplay = true }
    }

    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: 8)
    }

    override func draw(_ dirtyRect: NSRect) {
        let radius = bounds.height / 2
        let track = NSBezierPath(roundedRect: bounds, xRadius: radius, yRadius: radius)
        NSColor.tertiaryLabelColor.withAlphaComponent(0.35).setFill()
        track.fill()

        let clamped = CGFloat(min(max(fraction, 0), 1))
        let fillWidth = max(bounds.height, bounds.width * clamped)
        let fillRect = NSRect(x: 0, y: 0, width: fillWidth, height: bounds.height)
        let fill = NSBezierPath(roundedRect: fillRect, xRadius: radius, yRadius: radius)
        BlackThunder.accent.setFill()
        fill.fill()
    }
}

/// ダッシュボードの背景。ブラックサンダーの「断面（ザクザクの粒）」画像を
/// 暗く敷いてチョコ質感を出す。表示レイアウトには干渉しない（最背面）。
final class BlackThunderBackgroundView: NSView {
    /// 画像の上に重ねる暗幕の濃さ（0〜1）。文字の可読性とのバランスで調整。
    var dimming: CGFloat = 0.70

    private static let sectionImage: NSImage? = NSImage.bundled("blackthunder_bg")

    override func draw(_ dirtyRect: NSRect) {
        // ベースの黒地（画像が無いときのフォールバックも兼ねる）
        BlackThunder.background.setFill()
        bounds.fill()

        guard let img = Self.sectionImage else { return }
        // aspectFill で断面のザクザクを敷き詰める
        let target = aspectFillRect(imageSize: img.size, in: bounds)
        img.draw(in: target, from: .zero, operation: .sourceOver, fraction: 1.0)
        // 可読性のための暗幕
        NSColor.black.withAlphaComponent(dimming).setFill()
        bounds.fill()
    }

    private func aspectFillRect(imageSize: NSSize, in rect: NSRect) -> NSRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return rect }
        let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
        let w = imageSize.width * scale
        let h = imageSize.height * scale
        return NSRect(x: rect.midX - w / 2, y: rect.midY - h / 2, width: w, height: h)
    }
}

/// 割れたチョコの断面風のギザギザ区切り線。
final class JaggedSeparatorView: NSView {
    /// ギザの 1 山あたりの横幅（pt）。小さいほど細かくザクザクする。
    var toothWidth: CGFloat = 9

    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: 7)
    }

    override func draw(_ dirtyRect: NSRect) {
        let w = bounds.width
        let top = bounds.height - 1
        let bottom: CGFloat = 1

        let path = NSBezierPath()
        path.lineWidth = 1.3
        path.lineJoinStyle = .miter
        path.move(to: NSPoint(x: 0, y: bottom))
        var x: CGFloat = 0
        var up = true
        while x < w {
            x += toothWidth
            path.line(to: NSPoint(x: min(x, w), y: up ? top : bottom))
            up.toggle()
        }
        BlackThunder.gold.withAlphaComponent(0.55).setStroke()
        path.stroke()
    }
}

/// 「今日のブラックサンダー」を黄色カードで主役化するビュー。
/// 構成: [バー画像] × [数字／その下に「本ぶん」を右寄せ]
final class BlackThunderTodayCard: NSView {

    private let titleLabel = NSTextField(labelWithString: "今日のブラックサンダー")
    private let barImage = NSImageView()
    private let timesLabel = NSTextField(labelWithString: "×")
    private let numberLabel = NSTextField(labelWithString: "0.0")
    private let unitLabel = NSTextField(labelWithString: "本ぶん")
    private let noteLabel = NSTextField(labelWithString: "")
    private let gradient = CAGradientLayer()

    private static let numberFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .decimal; return f
    }()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.masksToBounds = true

        // 黄色グラデ（パッケージのゴールド）
        gradient.colors = [
            NSColor(srgbRed: 1.0, green: 0.835, blue: 0.290, alpha: 1).cgColor, // #FFD54A
            BlackThunder.gold.cgColor,
            NSColor(srgbRed: 0.878, green: 0.659, blue: 0.0, alpha: 1).cgColor,  // #E0A800
        ]
        gradient.locations = [0, 0.55, 1]
        gradient.startPoint = CGPoint(x: 0.2, y: 0)
        gradient.endPoint = CGPoint(x: 0.85, y: 1)
        layer?.insertSublayer(gradient, at: 0)

        titleLabel.font = .systemFont(ofSize: 12, weight: .bold)
        titleLabel.textColor = BlackThunder.ink

        barImage.image = NSImage.bundled("blackthunder_bar_whole")
        barImage.imageScaling = .scaleProportionallyUpOrDown
        barImage.translatesAutoresizingMaskIntoConstraints = false
        barImage.widthAnchor.constraint(equalToConstant: 96).isActive = true
        barImage.heightAnchor.constraint(equalToConstant: 64).isActive = true

        timesLabel.font = .systemFont(ofSize: 22, weight: .bold)
        timesLabel.textColor = BlackThunder.ink.withAlphaComponent(0.85)

        numberLabel.font = .systemFont(ofSize: 44, weight: .black)
        numberLabel.textColor = BlackThunder.ink
        numberLabel.alignment = .right

        unitLabel.font = .systemFont(ofSize: 14, weight: .bold)
        unitLabel.textColor = BlackThunder.ink
        unitLabel.alignment = .right

        // 数字の下に「本ぶん」を右寄せで重ねる
        let numUnit = NSStackView(views: [numberLabel, unitLabel])
        numUnit.orientation = .vertical
        numUnit.alignment = .trailing
        numUnit.spacing = 0

        let expr = NSStackView(views: [barImage, timesLabel, numUnit])
        expr.orientation = .horizontal
        expr.alignment = .centerY
        expr.spacing = 10

        noteLabel.font = .monospacedDigitSystemFont(ofSize: 10, weight: .semibold)
        noteLabel.textColor = BlackThunder.ink.withAlphaComponent(0.7)
        noteLabel.alignment = .center

        let v = NSStackView(views: [titleLabel, expr, noteLabel])
        v.orientation = .vertical
        v.alignment = .centerX
        v.spacing = 6
        v.translatesAutoresizingMaskIntoConstraints = false
        addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            v.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            v.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            v.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
        ])
    }

    override func layout() {
        super.layout()
        gradient.frame = bounds
    }

    func update(todayBars: Double, todayTokens: Int, totalBars: Double) {
        numberLabel.stringValue = String(format: "%.1f", todayBars)
        let tok = Self.numberFormatter.string(from: NSNumber(value: todayTokens)) ?? "\(todayTokens)"
        noteLabel.stringValue = String(format: "%@ tok ・ 累計 %.1f本ぶん", tok, totalBars)
    }
}
