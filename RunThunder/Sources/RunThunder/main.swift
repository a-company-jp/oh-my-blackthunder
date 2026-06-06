import AppKit

// メニューバー常駐アプリ（Dockアイコンなし）として起動する。
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let delegate = AppDelegate()
app.delegate = delegate

app.run()
