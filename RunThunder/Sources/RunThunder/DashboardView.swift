import AppKit

/// アイコンを上、ラベルを下に置き、その間隔を自由に指定できるボタン。
/// （NSButton 標準の imageHugsTitle では間隔を調整できないため）
final class VerticalIconButton: NSButton {

    private let iconView = NSImageView()
    private let label = NSTextField(labelWithString: "")
    private let iconPointSize: CGFloat
    /// 丸アバター表示時のサイズ固定制約（解除できるよう保持）。
    private var iconWidth: NSLayoutConstraint?
    private var iconHeight: NSLayoutConstraint?

    init(symbol: String, title: String, iconPointSize: CGFloat, spacing: CGFloat, target: AnyObject?, action: Selector) {
        self.iconPointSize = iconPointSize
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
        // 長い GitHub ユーザー名でもボタン幅を超えないように省略表示する。
        label.lineBreakMode = .byTruncatingTail
        label.cell?.usesSingleLineMode = true
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        label.widthAnchor.constraint(lessThanOrEqualToConstant: 80).isActive = true

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

    /// アイコンとラベルを後から差し替える（ログイン状態でボタン表記を変える用）。
    func configure(symbol: String, title: String) {
        let config = NSImage.SymbolConfiguration(pointSize: iconPointSize, weight: .regular)
        iconView.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(config)
        iconView.contentTintColor = BlackThunder.gold
        // SF Symbol 表示に戻すので丸マスクは解除。
        setIconCircular(false, size: 0)
        label.stringValue = title
    }

    /// ラベルだけ差し替える（アイコンはそのまま）。
    func setTitle(_ title: String) {
        label.stringValue = title
    }

    /// アイコン部に任意の画像（GitHub アバター等）を丸く表示する。
    func configure(avatar: NSImage, title: String, diameter: CGFloat) {
        iconView.image = avatar
        iconView.contentTintColor = nil
        setIconCircular(true, size: diameter)
        label.stringValue = title
    }

    /// iconView を丸くマスクする／解除する。size は丸表示時の直径。
    private func setIconCircular(_ circular: Bool, size: CGFloat) {
        iconView.wantsLayer = true
        iconView.imageScaling = circular ? .scaleProportionallyUpOrDown : .scaleProportionallyDown
        iconView.layer?.cornerRadius = circular ? size / 2 : 0
        iconView.layer?.masksToBounds = circular
        // 丸表示時はアイコンサイズを固定（SF Symbol 時は intrinsic 任せ）。
        iconWidth?.isActive = false
        iconHeight?.isActive = false
        if circular {
            let w = iconView.widthAnchor.constraint(equalToConstant: size)
            let h = iconView.heightAnchor.constraint(equalToConstant: size)
            w.isActive = true; h.isActive = true
            iconWidth = w; iconHeight = h
        } else {
            iconWidth = nil; iconHeight = nil
        }
    }

    // 内部のアイコン/ラベルではなくボタン自身がクリックを受けるようにする
    override func hitTest(_ point: NSPoint) -> NSView? {
        super.hitTest(point) == nil ? nil : self
    }
}

/// アカウント（GitHub ログイン）の状態を、右側ボタン列の 1 ボタンに反映させる係。
/// 未ログイン: 「ログイン」アイコン＋ラベル。ログイン済み: GitHub アバター＋ユーザー名。
/// アバター画像は非同期取得してボタンに丸く表示する。
final class AccountButtonController {

    private let button: VerticalIconButton
    private let avatarDiameter: CGFloat
    /// いまアバターに表示している URL（取得の重複・取り違えを防ぐ）。
    private var currentAvatarURL: URL?

    init(button: VerticalIconButton, avatarDiameter: CGFloat) {
        self.button = button
        self.avatarDiameter = avatarDiameter
    }

    /// ログイン状態に合わせてボタンの見た目を更新する。
    /// - connected: 連携済みか
    /// - login: GitHub ユーザー名（未取得なら nil）
    /// - avatarURL: アバター画像 URL（未取得なら nil）
    func update(connected: Bool, login: String?, avatarURL: URL?) {
        if connected {
            // login がまだ取れていない（連携直後・初回同期前）場合の保険。
            let name = login.map { "@\($0)" } ?? "連携済み"
            loadAvatar(avatarURL, fallbackTitle: name)
        } else {
            currentAvatarURL = nil
            button.configure(symbol: "person.crop.circle.badge.plus", title: "ログイン")
        }
    }

    /// アバター画像を非同期取得してボタンに表示する。URL が変わらなければ再取得しない。
    private func loadAvatar(_ url: URL?, fallbackTitle: String) {
        guard let url else {
            currentAvatarURL = nil
            button.configure(symbol: "person.crop.circle.fill", title: fallbackTitle)
            return
        }
        // 取得済みの URL ならユーザー名だけ更新して終了（画像は据え置き）。
        guard url != currentAvatarURL else {
            button.setTitle(fallbackTitle)
            return
        }
        currentAvatarURL = url
        // 取得が終わるまでは丸プレースホルダ（人型）を出しておく。
        button.configure(symbol: "person.crop.circle.fill", title: fallbackTitle)

        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data, let image = NSImage(data: data) else { return }
            DispatchQueue.main.async {
                guard let self, self.currentAvatarURL == url else { return }
                self.button.configure(avatar: image, title: fallbackTitle, diameter: self.avatarDiameter)
            }
        }.resume()
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

/// ブラさんくん（バー画像）を中心基準で上下させる専用ビュー。
///
/// NSImageView をそのまま Auto Layout 下でレイヤー変形すると、anchorPoint を
/// 中央にした瞬間に position がずれて表示が飛ぶ。これを避けるため、
/// 画像レイヤーの frame / anchorPoint をこのビューが自前で管理する。
final class JumpingBarView: NSView {

    private let imageLayer = CALayer()
    private static let animationKey = "blasankun.runrun.jump"
    private var currentUsage: Double = -1

    var image: NSImage? {
        didSet {
            imageLayer.contents = image
            needsLayout = true
        }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        imageLayer.anchorPoint = CGPoint(x: 0.5, y: 0.5)   // 中心基準
        imageLayer.contentsGravity = .resizeAspect
        layer?.addSublayer(imageLayer)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        // 画像レイヤーは常にビュー中央に置く（anchorPoint が中央なので position=中央）。
        CATransaction.begin()
        CATransaction.setDisableActions(true)   // レイアウト時の暗黙アニメを止める
        imageLayer.bounds = CGRect(origin: .zero, size: bounds.size)
        imageLayer.position = CGPoint(x: bounds.midX, y: bounds.midY)
        CATransaction.commit()
    }

    /// CPU 使用率（0〜1）に応じて「るんるんジャンプ」させる。
    /// ジャンプ幅は一定。使用率はテンポにのみ反映する。
    /// 上に行くほど大きく・下で小さくスケールして高低差（ジャンプ感）を強調。
    func setUsage(_ usage: Double) {
        let clamped = min(max(usage, 0), 1)
        if abs(clamped - currentUsage) < 0.01, imageLayer.animation(forKey: Self.animationKey) != nil {
            return
        }
        currentUsage = clamped

        // テンポ: アイドルはのんびり（約 1.1s/回）→ フル稼働で軽快（約 0.32s/回）。
        let period = 1.1 - (1.1 - 0.32) * clamped
        let amplitude: CGFloat = 9   // 中心からの上下幅（固定）
        let scaleUp: CGFloat = 1.10  // 頂点での拡大
        let scaleDown: CGFloat = 0.92 // 着地での縮小

        // 中心(等倍) → 頂点(大) → 中心(等倍) → 底(小) → 中心 で 1 周期。
        let posY = CAKeyframeAnimation(keyPath: "transform.translation.y")
        posY.values  = [0, amplitude, 0, -amplitude * 0.5, 0]
        posY.keyTimes = [0, 0.25, 0.5, 0.75, 1.0]

        let scale = CAKeyframeAnimation(keyPath: "transform.scale")
        scale.values  = [1.0, scaleUp, 1.0, scaleDown, 1.0]
        scale.keyTimes = [0, 0.25, 0.5, 0.75, 1.0]

        for anim in [posY, scale] {
            anim.duration = period
            anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        }

        let group = CAAnimationGroup()
        group.animations = [posY, scale]
        group.duration = period
        group.repeatCount = .infinity
        imageLayer.add(group, forKey: Self.animationKey)
    }
}

/// 「今日のブラックサンダー」を黄色カードで主役化するビュー。
/// 構成: [バー画像] × [数字／その下に「本ぶん」を右寄せ]
final class BlackThunderTodayCard: NSView {

    private let titleLabel = NSTextField(labelWithString: "今日のブラックサンダー")
    private let barImage = JumpingBarView()
    private let timesLabel = NSTextField(labelWithString: "×")
    private let numberLabel = NSTextField(labelWithString: "0.0")
    private let unitLabel = NSTextField(labelWithString: "本ぶん")
    private let noteLabel = NSTextField(labelWithString: "")
    private let gradient = CAGradientLayer()

    private static let numberFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .decimal; return f
    }()

    /// ランダム表示するバー画像（4種）。
    private static let barImages: [NSImage] = ["blackthunder_bar_wi",
                                               "blackthunder_bar_gusu",
                                               "blackthunder_bar_niko",
                                               "blackthunder_bar_ike"]
        .compactMap { NSImage.bundled($0) }

    /// バー画像をランダムに選び直す。
    func shuffleBar() {
        guard let img = Self.barImages.randomElement() else { return }
        barImage.image = img
    }

    /// CPU 使用率（0〜1）に応じて、ブラさんくんを「るんるんジャンプ」させる。
    func setCPUUsage(_ usage: Double) {
        barImage.setUsage(usage)
    }

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

        shuffleBar()
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
