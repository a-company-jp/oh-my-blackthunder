/*
 * ThunderCaptcha — popup（リーダーボード連携の接続 / 解除 UI）
 *
 * service worker（leaderboard.js）へメッセージを送り、APP TOKEN の
 * 取得（/connect フロー）/ 破棄 / 状態取得を行う。
 */
(function () {
  "use strict";

  var dot = document.getElementById("dot");
  var statusText = document.getElementById("statusText");
  var baseUrlEl = document.getElementById("baseUrl");
  var connectBtn = document.getElementById("connectBtn");
  var disconnectBtn = document.getElementById("disconnectBtn");
  var msgEl = document.getElementById("msg");

  /** background へメッセージを送る Promise ラッパ。 */
  function send(type) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: type }, function (res) {
          var err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, reason: err.message });
            return;
          }
          resolve(res || { ok: false, reason: "no_response" });
        });
      } catch (e) {
        resolve({ ok: false, reason: (e && e.message) || "error" });
      }
    });
  }

  function setMsg(text, isError) {
    msgEl.textContent = text || "";
    msgEl.className = "bt-pop-msg" + (isError ? " bt-pop-msg-error" : "");
  }

  function renderStatus(connected, baseUrl) {
    if (connected) {
      dot.className = "bt-pop-dot bt-pop-dot-on";
      statusText.textContent = "連携済み";
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
    } else {
      dot.className = "bt-pop-dot bt-pop-dot-off";
      statusText.textContent = "未連携";
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
    connectBtn.disabled = false;
    disconnectBtn.disabled = false;
    baseUrlEl.textContent = baseUrl ? baseUrl : "";
  }

  function refresh() {
    connectBtn.disabled = true;
    disconnectBtn.disabled = true;
    return send("bt-ci:lb-status").then(function (res) {
      if (res && res.ok) {
        renderStatus(!!res.connected, res.baseUrl);
      } else {
        dot.className = "bt-pop-dot bt-pop-dot-off";
        statusText.textContent = "状態を取得できません";
        connectBtn.hidden = false;
        connectBtn.disabled = false;
      }
    });
  }

  connectBtn.addEventListener("click", function () {
    setMsg("接続中... ブラウザのウィンドウで認証してください");
    connectBtn.disabled = true;
    send("bt-ci:lb-connect").then(function (res) {
      if (res && res.ok) {
        setMsg("連携しました。");
        refresh();
      } else {
        setMsg("接続に失敗しました: " + ((res && res.reason) || "error"), true);
        connectBtn.disabled = false;
      }
    });
  });

  disconnectBtn.addEventListener("click", function () {
    disconnectBtn.disabled = true;
    send("bt-ci:lb-disconnect").then(function (res) {
      if (res && res.ok) {
        setMsg("連携を解除しました。");
      } else {
        setMsg("解除に失敗しました。", true);
      }
      refresh();
    });
  });

  refresh();
})();
