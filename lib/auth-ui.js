/* ============================================================
 * lib/auth-ui.js · 登录 UI + 同步状态徽章 (阶段 5)
 * ============================================================
 * 提供:
 *   - AuthUI.init()                 启动时调用,渲染顶栏按钮
 *   - AuthUI.showLogin()           弹出登录 modal
 *   - AuthUI.signOut()             退出登录
 *   - AuthUI.toast(msg)            显示短暂提示
 *   - AuthUI.renderAccountBtn()    重新渲染顶栏按钮
 *
 * 依赖: Sync (lib/sync.js)
 * ========================================================== */
(function (root) {
  'use strict';
  if (typeof root.Sync === 'undefined') {
    console.warn('[auth-ui] Sync not found');
    return;
  }

  const $ = (s, ctx) => (ctx || document).querySelector(s);
  const _ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function toast(msg, kind) {
    let el = $('#lv-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lv-toast';
      el.className = 'lv-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'lv-toast show' + (kind ? ' lv-toast-' + kind : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function renderAccountBtn() {
    const slot = $('#account-slot');
    if (!slot) return;
    const status = root.Sync.getStatus();

    if (!status.hasSession) {
      if (status.mode === 'local') {
        slot.innerHTML =
          '<button class="navbtn lv-mode-local" title="未配置 Supabase,数据仅保存在本机"' +
          ' onclick="AuthUI.showLocalModeHint()">☁ 本地</button>';
      } else {
        slot.innerHTML =
          '<button class="navbtn lv-mode-cloud" onclick="AuthUI.showLogin()">🔐 登录</button>';
      }
    } else {
      const name = (status.user && status.user.email) ? status.user.email.split('@')[0] : 'user';
      const indicator = status.online ? '🟢' : '🟡';
      slot.innerHTML =
        '<span class="lv-account-pill" title="已同步到云">' +
          indicator + ' ' + escapeHtml(name) +
        '</span>' +
        '<button class="navbtn" onclick="AuthUI.signOut()">退出</button>';
    }
  }

  function showLocalModeHint() {
    toast('当前为本地模式:进度只在本机保存。要跨设备同步,请配置 Supabase。', 'warn');
    setTimeout(() => {
      if (confirm('要打开 Supabase 配置指引?')) {
        window.open('./supabase/SETUP.md', '_blank');
      }
    }, 200);
  }

  function showLogin() {
    if (document.querySelector('.lv-auth-modal')) return;
    const div = document.createElement('div');
    div.className = 'lv-auth-modal';
    div.innerHTML =
      '<div class="lv-modal-backdrop" onclick="AuthUI.closeLogin()"></div>' +
      '<div class="lv-modal-panel">' +
        '<h3>登录 life-vocab</h3>' +
        '<div class="lv-tabs">' +
          '<button class="lv-tab active" data-tab="signin">登录</button>' +
          '<button class="lv-tab" data-tab="signup">注册</button>' +
        '</div>' +
        '<form id="lv-auth-form" onsubmit="return AuthUI.submit(event)">' +
          '<input type="email" id="lv-auth-email" placeholder="邮箱" required autocomplete="email">' +
          '<input type="password" id="lv-auth-pwd" placeholder="密码 (≥6 位)" required minlength="6" autocomplete="current-password">' +
          '<button type="submit" class="lv-primary-btn" id="lv-auth-submit">登录</button>' +
          '<div class="lv-auth-error" id="lv-auth-error"></div>' +
        '</form>' +
        '<p class="lv-hint">登录后,所有进度自动同步到云端,可在任意电脑登录同一账号访问。</p>' +
      '</div>';
    document.body.appendChild(div);
    div.querySelectorAll('.lv-tab').forEach(t => {
      t.onclick = () => {
        div.querySelectorAll('.lv-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const isSignup = t.dataset.tab === 'signup';
        div.querySelector('#lv-auth-submit').textContent = isSignup ? '注册' : '登录';
      };
    });
    setTimeout(() => $('#lv-auth-email', div).focus(), 60);
  }

  function closeLogin() {
    const m = document.querySelector('.lv-auth-modal');
    if (m) m.remove();
  }

  async function submit(e) {
    e.preventDefault();
    const form = $('#lv-auth-form');
    const email = $('#lv-auth-email').value.trim();
    const pwd = $('#lv-auth-pwd').value;
    // 注意: .lv-tabs 在 <form> 之外,不能用 form.querySelector 找 tab
    const activeTab = document.querySelector('.lv-auth-modal .lv-tab.active');
    const tab = activeTab ? activeTab.dataset.tab : 'signin';
    const errEl = $('#lv-auth-error');
    const submitBtn = $('#lv-auth-submit');
    errEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = tab === 'signin' ? '登录中...' : '注册中...';
    try {
      if (tab === 'signin') {
        await root.Sync.signIn(email, pwd);
      } else {
        await root.Sync.signUp(email, pwd);
      }
      closeLogin();
      toast('登录成功,正在同步...', 'ok');
      // 通知主程序刷新数据
      root.dispatchEvent(new CustomEvent('lv:sync-complete'));
    } catch (err) {
      errEl.textContent = (err && err.message) || '登录失败';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = tab === 'signin' ? '登录' : '注册';
    }
    return false;
  }

  async function signOut() {
    if (!confirm('确定退出?退出后,本机进度仍保留,但关闭浏览器后无法恢复(可在登录后再次同步)。')) return;
    try {
      await root.Sync.signOut();
      toast('已退出登录', 'ok');
      root.dispatchEvent(new CustomEvent('lv:sync-complete'));
    } catch (e) {
      toast('退出失败:' + e.message, 'err');
    }
  }

  function init() {
    if (!root.Sync) return;
    root.Sync.onAuthChange(() => renderAccountBtn());
    root.Sync.onStatusChange(() => renderAccountBtn());
    renderAccountBtn();

    // 把 Sync 事件桥接到 lv: 命名空间,便于主程序订阅
    root.Sync.on('sync:pushed',     d => root.dispatchEvent(new CustomEvent('lv:sync-pushed',     { detail: d })));
    root.Sync.on('sync:pulled',     d => root.dispatchEvent(new CustomEvent('lv:sync-pulled',     { detail: d })));
    root.Sync.on('sync:queued',     d => root.dispatchEvent(new CustomEvent('lv:sync-queued',     { detail: d })));
    root.Sync.on('sync:flushed',    d => root.dispatchEvent(new CustomEvent('lv:sync-flushed',    { detail: d })));
    root.Sync.on('sync:partial',    d => root.dispatchEvent(new CustomEvent('lv:sync-partial',    { detail: d })));
    root.Sync.on('sync:pull-failed',d => root.dispatchEvent(new CustomEvent('lv:sync-error',      { detail: d })));
  }

  root.AuthUI = { init, showLogin, closeLogin, submit, signOut, toast, renderAccountBtn };
})(typeof self !== 'undefined' ? self : window);
