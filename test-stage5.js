// 阶段 5 · Supabase 同步 + 登录 + PWA 端到端验证
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

let failed = 0;
function ok(name) { console.log('  OK ', name); }
function bad(name, msg) { console.log('  !! ', name, msg || ''); failed++; }

// ============================================================
// 1. 静态结构: 占位符 / 元素 / CSS / 嵌入的 JS 块
// ============================================================
console.log('-- 1. 占位符替换 --');
const tmplChecks = [
  ['__APP_DATA_JSON__ 已替换',   !html.includes('__APP_DATA_JSON__')],
  ['__SYNC_SCRIPTS__ 已替换',     !html.includes('__SYNC_SCRIPTS__')],
];
for (const [n, r] of tmplChecks) (r ? ok : bad)(n);

console.log('-- 2. 顶栏 UI 元素 --');
const uiChecks = [
  ['顶栏 account-slot 已注入',           /id="account-slot"/],
  ['登录 modal CSS 存在',                /\.lv-auth-modal \{/],
  ['modal-panel CSS 存在',               /\.lv-modal-panel \{/],
  ['账号 pill 样式',                     /\.lv-account-pill \{/],
  ['本地模式高亮样式',                   /\.lv-mode-local/],
  ['云端模式高亮样式',                   /\.lv-mode-cloud/],
  ['lv-tabs (登录/注册切换)',             /\.lv-tabs \{/],
  ['lv-primary-btn (主按钮)',             /\.lv-primary-btn \{/],
  ['lv-auth-error (错误提示)',            /\.lv-auth-error \{/],
  ['lv-toast 全局提示',                  /\.lv-toast \{/],
  ['lv-toast.show 显示',                 /\.lv-toast\.show \{/],
  ['lv-toast-ok/warn/err 三态',           /\.lv-toast-(ok|warn|err)/],
  ['lv-install-banner 容器',              /\.lv-install-banner \{/],
  ['lv-install-banner.show 显隐',         /\.lv-install-banner\.show/],
];
for (const [n, re] of uiChecks) (re.test(html) ? ok : bad)(n);

console.log('-- 3. 嵌入的 JS 块 --');
const embedChecks = [
  ['lib/db.js 已内嵌',                  /DB_NAME = ['"]life_vocab_db['"]/],
  ['lib/sync.js 已内嵌',                /sync\.js · Supabase 同步层/],
  ['lib/auth-ui.js 已内嵌',             /auth-ui\.js · 登录 UI/],
  ['lib/install-prompt.js 已内嵌',      /install-prompt\.js/],
  ['DB 模块导出 root.LVDB',             /root\.LVDB = DB/],
  ['Sync 模块导出 root.Sync',           /root\.Sync = \{/],
  ['AuthUI 模块导出 root.AuthUI',       /root\.AuthUI = \{/],
  ['InstallPrompt 导出 root.InstallPrompt', /root\.InstallPrompt = \{/],
];
for (const [n, re] of embedChecks) (re.test(html) ? ok : bad)(n);

console.log('-- 4. stage5 init 钩子 --');
const initChecks = [
  ['window.__STAGE5_INIT__ 已注入',     /window\.__STAGE5_INIT__ = async function/],
  ['__STAGE5_INIT__ 调用 LVDB.getAll',   /await window\.LVDB\.getAll\("meta"\)/],
  ['__STAGE5_INIT__ 调用 Sync.init',     /window\.Sync\.init\(\{[^}]*"url"/],
  ['__STAGE5_INIT__ 调用 restoreSession',/await window\.Sync\.restoreSession/],
  ['__STAGE5_INIT__ 调用 AuthUI.init',   /window\.AuthUI\.init\(\)/],
  ['__STAGE5_INIT__ 调用 InstallPrompt', /window\.InstallPrompt\.init\(\)/],
  ['主 JS bootStage5 调用钩子',          /window\.__STAGE5_INIT__\(\)/],
];
for (const [n, re] of initChecks) (re.test(html) ? ok : bad)(n);

console.log('-- 5. saveProgress + Sync 集成 --');
const syncChecks = [
  ['saveProgress 触发 _syncPushSoon',    /saveProgress\(\)[\s\S]{0,300}_syncPushSoon/],
  ['_syncPushNow 调用 Sync.pushProgress',/window\.Sync\.pushProgress\(list\)/],
  ['_syncPushNow 调用 Sync.pushSettings',/window\.Sync\.pushSettings\(\{/],
  ['lv:sync-complete 监听器',            /lv:sync-complete/],
  ['card_state key 解析 "cardId:mode"',  /parts = String\(k\)\.split\(':'/],
];
for (const [n, re] of syncChecks) (re.test(html) ? ok : bad)(n);

// ============================================================
// 6. 数据验证
// ============================================================
console.log('-- 6. 数据完整性 --');
const dataMatch = html.match(/<script id="appData"[^>]*>([\s\S]*?)<\/script>/);
let APP_DATA;
try {
  APP_DATA = JSON.parse(dataMatch[1]);
  ok('appData JSON 解析成功 (' + APP_DATA.topics.length + ' 主题 / ' + APP_DATA.cards.length + ' 卡)');
} catch (e) {
  bad('appData JSON 解析', e.message);
  APP_DATA = { topics: [], cards: [] };
}

// ============================================================
// 7. Mock 环境跑主 JS (确保无错)
// ============================================================
console.log('-- 7. 主 JS 启动 (mock 环境) --');
function makeEl() {
  const el = { children: [], dataset: {}, style: {}, _textContent: '', _innerHTML: '', _value: '', _checked: false,
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false} },
    addEventListener(){}, appendChild(c){ this.children.push(c); return c; }, removeChild(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; },
    getAttribute(){ return null; }, setAttribute(){}, insertAdjacentHTML(){},
    focus(){}, blur(){}, click(){}, dispatchEvent(){}
  };
  Object.defineProperty(el, 'textContent', { configurable: true, get(){return el._textContent;}, set(v){el._textContent=String(v);} });
  Object.defineProperty(el, 'innerHTML', { configurable: true, get(){return el._innerHTML;}, set(v){el._innerHTML=String(v);} });
  Object.defineProperty(el, 'value', { configurable: true, get(){return el._value;}, set(v){el._value=String(v);} });
  Object.defineProperty(el, 'checked', { configurable: true, get(){return el._checked;}, set(v){el._checked=!!v;} });
  return el;
}
const __els = new Map();
function getEl(id) { if (!__els.has(id)) __els.set(id, makeEl()); return __els.get(id); }

const document = { getElementById: getEl, querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {}, createElement: () => makeEl(), removeEventListener(){}, body: makeEl() };
const window_ = { addEventListener(){}, removeEventListener(){}, scrollTo(){}, devicePixelRatio: 1,
  speechSynthesis: { cancel(){}, speak(){}, getVoices(){return []}, onvoiceschanged: null },
  localStorage: { getItem(){return '{}';}, setItem(){}, removeItem(){} },
  navigator: { onLine: true },
  dispatchEvent(){}, CustomEvent: function(name, init){ return { type: name, detail: init && init.detail }; },
  setTimeout: (fn, ms) => 0,
  clearTimeout(){}
};

// mock IndexedDB (简易版)
const _stores = {};
let _idCounter = 1;
const mockIDB = {
  open(name, ver) {
    _stores[name] = _stores[name] || {};
    return {
      onupgradeneeded: null,
      onsuccess: null, onerror: null,
      result: {
        objectStoreNames: { contains: (n) => !!_stores[n] },
        createObjectStore(n, opts) {
          _stores[n] = { keyPath: opts && opts.keyPath, data: {} };
          return {
            createIndex(){}
          };
        },
        transaction(name, mode) {
          return {
            objectStore(n) {
              if (!_stores[n]) _stores[n] = { data: {} };
              return makeStore(n);
            }
          };
        }
      }
    };
  }
};
function makeStore(name) {
  return {
    get(id) {
      const v = (_stores[name] && _stores[name].data && _stores[name].data[id]) || null;
      return { onsuccess: null, onerror: null, result: v };
    },
    put(value) {
      if (!_stores[name]) _stores[name] = { data: {} };
      if (!value.id) value.id = 'auto_' + (_idCounter++);
      _stores[name].data[value.id] = value;
      return { onsuccess: null, onerror: null, result: value.id };
    },
    getAll() {
      const data = (_stores[name] && _stores[name].data) || {};
      const list = Object.values(data);
      return { onsuccess: null, onerror: null, result: list };
    },
    delete(id) {
      if (_stores[name] && _stores[name].data) delete _stores[name].data[id];
      return { onsuccess: null, onerror: null };
    },
    count() {
      const data = (_stores[name] && _stores[name].data) || {};
      return { onsuccess: null, onerror: null, result: Object.keys(data).length };
    },
    clear() {
      if (_stores[name]) _stores[name].data = {};
      return { onsuccess: null, onerror: null };
    }
  };
}
// 让 IDB 异步工作
const _oldOpen = mockIDB.open;
mockIDB.open = function (name, ver) {
  const req = _oldOpen(name, ver);
  setTimeout(() => {
    req.onupgradeneeded && req.onupgradeneeded({ target: req });
    req.onsuccess && req.onsuccess();
  }, 0);
  return req;
};
mockIDB.open.toString = () => 'function open() { [native code] }';

global.document = document;
global.window = window_;
global.navigator = window_.navigator;
global.location = { hash: '' };
global.performance = { now: () => Date.now() };
global.Audio = function () { return { playbackRate: 1, play(){ return Promise.resolve(); } }; };
global.alert = () => {};
global.SpeechSynthesisUtterance = function () {};
global.SpeechRecognition = undefined;
global.webkitSpeechRecognition = undefined;
global.Blob = class {};
global.URL = { createObjectURL: () => 'blob:mock' };
global.indexedDB = mockIDB;
global.setTimeout = window_.setTimeout;
global.clearTimeout = window_.clearTimeout;
// 让 IIFE (function (root) { ... })() 内的 root 走 self → window_
global.self = window_;
global.window = window_;

__els.set('appData', makeEl());
__els.get('appData')._textContent = JSON.stringify(APP_DATA);

// 抽出所有 <script>...</script> 块 (无 src, 非 application/json)
const scriptBlocks = [];
const scriptRe = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRe.exec(html)) !== null) {
  const block = m[0];
  const opening = block.slice(0, block.indexOf('>') + 1);
  if (/\bsrc=/i.test(opening)) continue;
  if (/\btype=["']application\/json/i.test(opening)) continue;
  const codeMatch = block.match(/^<script(?:\s[^>]*)?>([\s\S]*?)<\/script>$/);
  if (!codeMatch) continue;
  const code = codeMatch[1].trim();
  if (!code) continue;
  scriptBlocks.push({ code, isMain: false });
}
if (scriptBlocks.length) scriptBlocks[scriptBlocks.length - 1].isMain = true;

const evalErrors = [];
for (const block of scriptBlocks) {
  try {
    if (block.isMain) {
      const iifeMatch = block.code.match(/^\(function\s*\(\)\s*\{([\s\S]*?)\}\)\(\)\s*;?\s*$/);
      const inner = iifeMatch ? iifeMatch[1].replace(/'use strict';/g, '') : block.code;
      eval(inner);
    } else {
      eval(block.code);
    }
  } catch (e) {
    evalErrors.push((block.isMain ? '[main]' : '[lib]') + ' ' + (e.message || e));
  }
}
if (evalErrors.length === 0) {
  ok('所有 <script> 块 eval 成功 (共 ' + scriptBlocks.length + ' 个, 含 lib db/sync/auth/install + stage5 init + 主 IIFE)');
} else {
  bad('部分 <script> 块 eval 失败', evalErrors.join(' | '));
}

// ============================================================
// 8. LVDB / Sync 模块独立验证
// ============================================================
console.log('-- 8. LVDB 模块 --');
try {
  const LVDB = window_.LVDB;
  if (typeof LVDB.get === 'function') ok('LVDB.get 已定义');
  else bad('LVDB.get', 'missing');
  if (typeof LVDB.put === 'function') ok('LVDB.put 已定义');
  else bad('LVDB.put', 'missing');
  if (typeof LVDB.getAll === 'function') ok('LVDB.getAll 已定义');
  else bad('LVDB.getAll', 'missing');
  if (typeof LVDB.count === 'function') ok('LVDB.count 已定义');
  else bad('LVDB.count', 'missing');
} catch (e) { bad('LVDB 模块', e.message); }

console.log('-- 9. Sync 模块 --');
try {
  const Sync = window_.Sync;
  if (typeof Sync.init === 'function') ok('Sync.init 已定义');
  else bad('Sync.init', 'missing');
  if (typeof Sync.pushProgress === 'function') ok('Sync.pushProgress 已定义');
  else bad('Sync.pushProgress', 'missing');
  if (typeof Sync.pullAll === 'function') ok('Sync.pullAll 已定义');
  else bad('Sync.pullAll', 'missing');
  if (typeof Sync.mergeRow === 'function') ok('Sync.mergeRow 已定义');
  else bad('Sync.mergeRow', 'missing');
  if (typeof Sync.signIn === 'function') ok('Sync.signIn 已定义');
  else bad('Sync.signIn', 'missing');
  if (typeof Sync.signUp === 'function') ok('Sync.signUp 已定义');
  else bad('Sync.signUp', 'missing');
  if (typeof Sync.signOut === 'function') ok('Sync.signOut 已定义');
  else bad('Sync.signOut', 'missing');
  if (typeof Sync.flushQueue === 'function') ok('Sync.flushQueue 已定义');
  else bad('Sync.flushQueue', 'missing');

  // init 未配置 → 本地模式
  const r = Sync.init({ url: '', anon_key: '' });
  if (r && r.mode === 'local') ok('Sync.init() 占位 → 本地模式');
  else bad('Sync.init 本地降级', JSON.stringify(r));

  const st = Sync.getStatus();
  if (st && st.mode === 'local') ok('Sync.getStatus() 本地模式 (' + JSON.stringify(st) + ')');
  else bad('Sync.getStatus', JSON.stringify(st));
} catch (e) { bad('Sync 模块', e.message); }

console.log('-- 10. Sync.mergeRow 冲突合并 --');
try {
  const Sync = window_.Sync;
  // mergeRow 选择 updated_at 更新更晚的
  const local  = { reps: 5, next_due: '2099-01-01', _cloud_updated: '2025-09-01T10:00:00Z' };
  const cloud  = { reps: 3, next_due: '2099-01-02', _cloud_updated: '2025-09-08T10:00:00Z' };
  const merged = Sync.mergeRow(local, cloud);
  if (merged.reps === 3) ok('mergeRow: cloud 更新更晚 → 取 cloud');
  else bad('mergeRow 取 cloud', JSON.stringify(merged));

  const local2 = { reps: 5, _cloud_updated: '2025-09-08T10:00:00Z' };
  const cloud2 = { reps: 3, _cloud_updated: '2025-09-07T10:00:00Z' };
  const m2 = Sync.mergeRow(local2, cloud2);
  if (m2.reps === 5) ok('mergeRow: 本地更新更晚 → 取 local');
  else bad('mergeRow 取 local', JSON.stringify(m2));
} catch (e) { bad('Sync.mergeRow', e.message); }

console.log('-- 11. AuthUI 模块 --');
try {
  const AuthUI = window_.AuthUI;
  if (AuthUI && typeof AuthUI.init === 'function') ok('AuthUI.init 已定义');
  else bad('AuthUI.init', 'missing');
  if (typeof AuthUI.showLogin === 'function') ok('AuthUI.showLogin 已定义');
  else bad('AuthUI.showLogin', 'missing');
  if (typeof AuthUI.renderAccountBtn === 'function') ok('AuthUI.renderAccountBtn 已定义');
  else bad('AuthUI.renderAccountBtn', 'missing');
  if (typeof AuthUI.toast === 'function') ok('AuthUI.toast 已定义');
  else bad('AuthUI.toast', 'missing');
  // toast 调用创建元素
  AuthUI.toast('hello');
  ok('AuthUI.toast() 调用不崩');
} catch (e) { bad('AuthUI 模块', e.message); }

console.log('-- 12. InstallPrompt 模块 --');
try {
  const IP = window_.InstallPrompt;
  if (IP && typeof IP.init === 'function') ok('InstallPrompt.init 已定义');
  else bad('InstallPrompt.init', 'missing');
  if (typeof IP.showBanner === 'function') ok('InstallPrompt.showBanner 已定义');
  else bad('InstallPrompt.showBanner', 'missing');
} catch (e) { bad('InstallPrompt 模块', e.message); }

// ============================================================
// 13. 已知字段校验
// ============================================================
console.log('-- 13. 业务字段 --');
const businessChecks = [
  ['商务主题存在 (business)',     APP_DATA.topics.some(t => t.topic_id === 'business')],
  ['商务卡 ≥ 100 张',              (APP_DATA.cards.filter(c => c.topic === 'business').length) >= 100],
  ['商务卡有 sc 字段',             APP_DATA.cards.filter(c => c.topic === 'business').every(c => c.sc)],
  ['商务卡有 tip 字段',            APP_DATA.cards.filter(c => c.topic === 'business').every(c => c.tip)],
];
for (const [n, r] of businessChecks) (r ? ok : bad)(n);

console.log();
console.log(failed === 0 ? '=== 阶段 5 全部检查通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
