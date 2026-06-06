/*
 * ThunderCaptcha — Merge ボタン判定
 *
 * GitHub の class 名には依存せず、ボタンの「テキスト / value」で判定する。
 * dual-export: ブラウザ self.BTCI / Node module.exports。
 */
(function (root) {
  "use strict";

  // 捕捉対象の文言（部分一致）。日本語 UI も拾う。
  var MERGE_TEXTS = [
    "Merge pull request",
    "Squash and merge",
    "Rebase and merge",
    "Confirm merge",
    "Confirm squash and merge",
    "Confirm rebase and merge",
    "Enable auto-merge",
    "マージ",
    "スカッシュ",
    "リベース"
  ];

  // バッジ等で混入する自前テキストを判定対象から除外するための印。
  var BADGE_MARK = "Thunder Protected";

  /**
   * 与えられたテキストが Merge 系ボタンの文言かどうか。
   * @param {string} text
   * @returns {boolean}
   */
  function isMergeButtonText(text) {
    if (typeof text !== "string") return false;
    var t = text.replace(/\s+/g, " ").trim();
    if (!t) return false;
    if (t.indexOf(BADGE_MARK) !== -1) return false;
    var lower = t.toLowerCase();
    for (var i = 0; i < MERGE_TEXTS.length; i++) {
      if (lower.indexOf(MERGE_TEXTS[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  // ---- 以下はブラウザ DOM 依存（Node テスト対象外）。guard 付きで定義 ----

  var CANDIDATE_SELECTOR =
    'button, input[type="submit"], summary, a[role="button"]';

  /**
   * 要素から判定に使うテキスト（value 含む）を取り出す。
   * input[type=submit] は innerText を持たないことがあるので value を見る。
   */
  function getButtonText(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input") return el.value || "";
    return (el.innerText || el.textContent || "").trim();
  }

  /** disabled / aria-disabled / disabled クラスを持つ要素か。 */
  function isDisabled(el) {
    if (!el) return true;
    if (el.disabled === true) return true;
    if (el.getAttribute && el.getAttribute("aria-disabled") === "true") return true;
    if (el.classList && el.classList.contains("disabled")) return true;
    return false;
  }

  /**
   * クリックされた要素から、Merge 系の操作要素を探して返す（無ければ null）。
   * @param {Element} target
   * @returns {Element|null}
   */
  function findMergeElement(target) {
    if (!target || typeof target.closest !== "function") return null;
    var el = target.closest(CANDIDATE_SELECTOR);
    if (!el) return null;
    if (isDisabled(el)) return null;
    return isMergeButtonText(getButtonText(el)) ? el : null;
  }

  var api = {
    isMergeButtonText: isMergeButtonText,
    getButtonText: getButtonText,
    isDisabled: isDisabled,
    findMergeElement: findMergeElement,
    CANDIDATE_SELECTOR: CANDIDATE_SELECTOR,
    MERGE_TEXTS: MERGE_TEXTS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BTCI = Object.assign(root.BTCI || {}, api);
  }
})(typeof self !== "undefined" ? self : this);
