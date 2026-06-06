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
    var full = el.innerText || el.textContent || "";
    // 自前バッジ(.bt-ci-badge)をボタン内に挿入している場合、そのテキストが
    // 混ざって判定を誤らせるので差し引く。
    var badge = el.querySelector && el.querySelector(".bt-ci-badge");
    if (badge) {
      var btext = badge.innerText || badge.textContent || "";
      if (btext) full = full.split(btext).join(" ");
    }
    return full.replace(/\s+/g, " ").trim();
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

  /** 要素が候補セレクタ（button / input[submit] / summary / a[role=button]）に該当するか。 */
  function isCandidate(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "button" || tag === "summary") return true;
    if (tag === "input") {
      return (el.getAttribute("type") || "").toLowerCase() === "submit";
    }
    if (tag === "a") return el.getAttribute("role") === "button";
    return false;
  }

  /**
   * event.composedPath() の配列から Merge 系操作要素を探す。
   * Shadow DOM 内のボタンも composedPath には現れるため、document の
   * capture listener からでも掴める。
   * @param {EventTarget[]} path target -> root の順
   * @returns {Element|null}
   */
  function findMergeElementFromPath(path) {
    if (!path || !path.length) return null;
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!isCandidate(el)) continue;
      if (isDisabled(el)) continue;
      if (isMergeButtonText(getButtonText(el))) return el;
    }
    return null;
  }

  var api = {
    isMergeButtonText: isMergeButtonText,
    getButtonText: getButtonText,
    isDisabled: isDisabled,
    isCandidate: isCandidate,
    findMergeElement: findMergeElement,
    findMergeElementFromPath: findMergeElementFromPath,
    CANDIDATE_SELECTOR: CANDIDATE_SELECTOR,
    MERGE_TEXTS: MERGE_TEXTS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BTCI = Object.assign(root.BTCI || {}, api);
  }
})(typeof self !== "undefined" ? self : this);
