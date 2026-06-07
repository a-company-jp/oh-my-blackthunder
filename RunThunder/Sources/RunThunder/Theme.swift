import AppKit

/// ブラックサンダー配色のパレット。アクセント色はここで一元管理する。
/// パッケージの「黒地 × ゴールドの稲妻 × 赤」をベースにしている。
enum BlackThunder {
    /// ブランドのゴールド（稲妻／ロゴ文字色）。チャートやバーのアクセントに使う。
    static let gold = NSColor(srgbRed: 0.96, green: 0.75, blue: 0.09, alpha: 1) // #F5BF17

    /// パッケージの赤。強調・警告寄りのアクセントに使う。
    static let red = NSColor(srgbRed: 0.84, green: 0.0, blue: 0.07, alpha: 1) // #D60012

    /// 黒地（チョコ本体）。
    static let black = NSColor(srgbRed: 0.07, green: 0.07, blue: 0.07, alpha: 1) // #121212

    /// 既定のアクセント色（旧 systemBlue の置き換え先）。
    static let accent = gold

    /// ダッシュボード背景（不透明な黒地）。
    static let background = NSColor(srgbRed: 0.07, green: 0.07, blue: 0.07, alpha: 1) // #121212

    /// 見出しテキスト（黒地に映える白）。
    static let titleText = NSColor(srgbRed: 0.96, green: 0.96, blue: 0.96, alpha: 1) // #F5F5F5

    /// 補足テキスト（淡いグレー）。
    static let detailText = NSColor(srgbRed: 0.78, green: 0.78, blue: 0.78, alpha: 1) // #C8C8C8

    /// 黄色カードの文字色（黒地ではなく黄色背景に乗せるダークインク）。
    static let ink = NSColor(srgbRed: 0.086, green: 0.067, blue: 0.024, alpha: 1) // #161106
}

extension NSImage {
    /// アプリバンドル Resources 直下の PNG を読み込む（無ければ nil）。
    static func bundled(_ name: String) -> NSImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "png") else { return nil }
        return NSImage(contentsOf: url)
    }
}
