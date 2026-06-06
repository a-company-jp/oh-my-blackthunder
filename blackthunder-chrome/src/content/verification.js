/*
 * ThunderCaptcha — 認証済み状態の管理
 *
 * 純粋関数（buildVerificationStorageKey / isVerificationFresh）と、
 * sessionStorage への薄いラッパを提供する。TTL は 30 秒。
 * dual-export: ブラウザ self.BTCI / Node module.exports。
 */
(function (root) {
  "use strict";

  var TTL_MS = 30 * 1000;
  var KEY_PREFIX = "bt-ci:verified:";

  /**
   * PR key から sessionStorage の保存キーを作る。
   *   "owner/repo#123" -> "bt-ci:verified:owner/repo#123"
   * @param {string} prKey
   * @returns {string}
   */
  function buildVerificationStorageKey(prKey) {
    return KEY_PREFIX + String(prKey == null ? "" : prKey);
  }

  /**
   * 認証タイムスタンプが TTL 内に収まっているか（= まだ有効か）。
   * @param {number} timestamp 認証時刻 (ms)
   * @param {number} ttlMs
   * @param {number} [now] 現在時刻 (ms)。省略時は Date.now()。
   * @returns {boolean}
   */
  function isVerificationFresh(timestamp, ttlMs, now) {
    if (typeof timestamp !== "number" || !isFinite(timestamp)) return false;
    var current = typeof now === "number" ? now : Date.now();
    return current - timestamp >= 0 && current - timestamp < ttlMs;
  }

  // ---- sessionStorage ラッパ（ブラウザのみ。Node テスト対象外） ----

  /** PR を認証済みとして記録する。 */
  function markVerified(prKey) {
    try {
      sessionStorage.setItem(
        buildVerificationStorageKey(prKey),
        String(Date.now())
      );
    } catch (e) {
      /* storage 不可でも致命的ではない */
    }
  }

  /** PR が TTL 内で認証済みかどうか。 */
  function isVerified(prKey) {
    try {
      var raw = sessionStorage.getItem(buildVerificationStorageKey(prKey));
      if (raw == null) return false;
      return isVerificationFresh(parseInt(raw, 10), TTL_MS);
    } catch (e) {
      return false;
    }
  }

  var api = {
    TTL_MS: TTL_MS,
    buildVerificationStorageKey: buildVerificationStorageKey,
    isVerificationFresh: isVerificationFresh,
    markVerified: markVerified,
    isVerified: isVerified
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BTCI = Object.assign(root.BTCI || {}, api);
  }
})(typeof self !== "undefined" ? self : this);
