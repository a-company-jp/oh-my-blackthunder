/*
 * ThunderCaptcha — PR key 取得（純粋関数）
 *
 * location.pathname から PR 識別子を作る。
 *   "/owner/repo/pull/123"            -> "owner/repo#123"
 *   "/owner/repo/pull/123/files"      -> "owner/repo#123"
 * PR ページでなければ null。
 *
 * dual-export: ブラウザでは self.BTCI へ、Node では module.exports へ。
 */
(function (root) {
  "use strict";

  /**
   * @param {string} pathname
   * @returns {string|null}
   */
  function getPrKeyFromPathname(pathname) {
    if (typeof pathname !== "string") return null;
    var m = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return null;
    return m[1] + "/" + m[2] + "#" + m[3];
  }

  var api = { getPrKeyFromPathname: getPrKeyFromPathname };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BTCI = Object.assign(root.BTCI || {}, api);
  }
})(typeof self !== "undefined" ? self : this);
