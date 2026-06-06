/*
 * ThunderCaptcha — 認証後の演出
 *
 * rainBlackThunder(): 画面上部からブラックサンダー画像を複数落とす。
 *                     画像読み込み失敗時は絵文字 🍫⚡ にフォールバック。
 * showMergedToast():  画面下部にトーストを表示する。
 *
 * DOM 依存のためブラウザでのみ動作。self.BTCI に載せる。
 */
(function (root) {
  "use strict";

  var ASSETS = ["src/assets/chocolate.png", "src/assets/black-thunder.svg"];
  var COUNT = 16;
  var FALL_MS = 2600;

  function assetUrl(path) {
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      return "";
    }
  }

  function makeFaller(index) {
    var wrap = document.createElement("div");
    wrap.className = "bt-ci-faller";
    // ランダムな水平位置・遅延・回転・サイズ
    var left = Math.random() * 100;
    var delay = Math.random() * 800;
    var rot = (Math.random() * 720 - 360).toFixed(0);
    var size = 28 + Math.random() * 34;
    wrap.style.left = left + "vw";
    wrap.style.animationDelay = delay + "ms";
    wrap.style.setProperty("--bt-ci-rot", rot + "deg");
    wrap.style.width = size + "px";
    wrap.style.height = size + "px";

    var url = assetUrl(ASSETS[index % ASSETS.length]);
    if (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      img.addEventListener("error", function () {
        // 画像が読めなければ絵文字フォールバック
        wrap.textContent = "🍫⚡";
        wrap.classList.add("bt-ci-faller-emoji");
      });
      wrap.appendChild(img);
    } else {
      wrap.textContent = "🍫⚡";
      wrap.classList.add("bt-ci-faller-emoji");
    }
    return wrap;
  }

  function rainBlackThunder() {
    var layer = document.createElement("div");
    layer.className = "bt-ci-rain";
    for (var i = 0; i < COUNT; i++) {
      layer.appendChild(makeFaller(i));
    }
    document.body.appendChild(layer);
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, FALL_MS + 1200);
  }

  function showMergedToast() {
    var toast = document.createElement("div");
    toast.className = "bt-ci-toast";
    toast.textContent = "⚡ MERGED! BLACK THUNDER DEPLOYED ⚡";
    document.body.appendChild(toast);
    // 入場 → 数秒後に退場
    requestAnimationFrame(function () {
      toast.classList.add("bt-ci-toast-in");
    });
    setTimeout(function () {
      toast.classList.remove("bt-ci-toast-in");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 3200);
  }

  function celebrate() {
    rainBlackThunder();
    showMergedToast();
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    rainBlackThunder: rainBlackThunder,
    showMergedToast: showMergedToast,
    celebrate: celebrate
  });
})(typeof self !== "undefined" ? self : this);
