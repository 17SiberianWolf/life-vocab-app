/* ============================================================
 * lib/install-prompt.js · PWA 安装提示 (阶段 5)
 * ============================================================ */
(function (root) {
  'use strict';

  // 局部 $ 工具: 不能依赖其他模块 IIFE 内部的 $ (那是局部变量, 这里拿不到)
  const $ = (s, ctx) => (ctx || document).querySelector(s);

  let _deferred = null;
  let _shown = false;

  function _onBeforeInstallPrompt(e) {
    e.preventDefault();
    _deferred = e;
    if (!_shown) showBanner();
  }

  function _onInstalled() {
    hideBanner();
    root.dispatchEvent(new CustomEvent('lv:pwa-installed'));
    if (root.AuthUI && root.AuthUI.toast) {
      root.AuthUI.toast('已安装到桌面!', 'ok');
    }
  }

  function showBanner() {
    if (document.querySelector('#lv-install-banner')) return;
    const b = document.createElement('div');
    b.id = 'lv-install-banner';
    b.className = 'lv-install-banner';
    b.innerHTML =
      '<div class="lv-install-text">' +
        '<strong>📲 添加到桌面</strong>' +
        '<span>离线也能用,启动更快</span>' +
      '</div>' +
      '<div class="lv-install-actions">' +
        '<button class="lv-btn lv-btn-primary" id="lv-install-yes">安装</button>' +
        '<button class="lv-btn lv-btn-ghost"  id="lv-install-no">稍后</button>' +
      '</div>';
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('show'), 30);

    $('#lv-install-yes').onclick = async () => {
      try {
        if (!_deferred) return;
        _deferred.prompt();
        await _deferred.userChoice;
      } catch (e) {
        // 用户取消或浏览器限制, 静默处理
      } finally {
        hideBanner();
        _deferred = null;
      }
    };
    $('#lv-install-no').onclick = () => {
      hideBanner();
      // 24 小时内不再提示
      localStorage.setItem('lv-install-dismissed-at', String(Date.now()));
    };
    _shown = true;
  }

  function hideBanner() {
    const b = $('#lv-install-banner');
    if (b) { b.classList.remove('show'); setTimeout(() => b.remove(), 250); }
  }

  function init() {
    // 已被用户关闭 24 小时内不再问
    const dismissed = parseInt(localStorage.getItem('lv-install-dismissed-at') || '0', 10);
    if (dismissed && (Date.now() - dismissed) < 24 * 3600 * 1000) return;

    window.addEventListener('beforeinstallprompt', _onBeforeInstallPrompt);
    window.addEventListener('appinstalled', _onInstalled);
  }

  root.InstallPrompt = { init, showBanner, hideBanner };
})(typeof self !== 'undefined' ? self : window);
