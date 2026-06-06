import Foundation
import ServiceManagement

/// ログイン時の自動起動を管理する（macOS 13+ の SMAppService を使用）。
enum LoginItem {

    static var isEnabled: Bool {
        SMAppService.mainApp.status == .enabled
    }

    /// 自動起動の ON/OFF を切り替える。成功可否を返す。
    @discardableResult
    static func setEnabled(_ enabled: Bool) -> Bool {
        do {
            if enabled {
                if SMAppService.mainApp.status != .enabled {
                    try SMAppService.mainApp.register()
                }
            } else {
                if SMAppService.mainApp.status == .enabled {
                    try SMAppService.mainApp.unregister()
                }
            }
            return true
        } catch {
            NSLog("RunThunder: ログイン項目の更新に失敗: \(error.localizedDescription)")
            return false
        }
    }
}
