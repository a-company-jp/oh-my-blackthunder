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
        iconView.contentTintColor = .labelColor

        label.stringValue = title
        label.font = .systemFont(ofSize: 11)
        label.alignment = .center
        label.textColor = .labelColor

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

        NSColor.systemBlue.withAlphaComponent(0.22).setFill()
        fill.fill()
        NSColor.systemBlue.setStroke()
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
        NSColor.systemBlue.setFill()
        fill.fill()
    }
}
