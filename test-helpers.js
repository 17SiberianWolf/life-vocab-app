// 共享测试 helper:兼容阶段 5 之前的多 <script> 嵌入结构
const fs = require('fs');

function loadIndex() {
  return fs.readFileSync('index.html', 'utf8');
}

// 抽所有 <script>(.*?)</script>,但跳过有 src 或 type=application/json 的
function extractScripts(html) {
  const out = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const opening = m[0].slice(0, m[0].indexOf('>') + 1);
    if (/\bsrc=/i.test(opening)) continue;
    if (/\btype=["']application\/json/i.test(opening)) continue;
    const code = m[1].trim();
    if (code) out.push({ code, tag: opening });
  }
  if (out.length) out[out.length - 1].isMain = true;
  return out;
}

// 从「主 IIFE」形式取内部源码(IIFE 包装的函数体)
// 主块可能是: 1) 标准 (function(){...})(); 2) IIFE 后跟 SW 注册等全局代码
// 精准做法: 从首个 (function () { 开始,只 match 对应的 })(); (跳过过程中嵌套的 IIFE 自调用)
function getMainIIFEBody(html) {
  const blocks = extractScripts(html);
  const main = blocks.find(b => b.isMain);
  if (!main) return '';
  const code = main.code;
  // 标准匹配: 整段是 (function() { ... })();
  let m = code.match(/^\(function\s*\(\)\s*\{([\s\S]*?)\}\)\(\)\s*;?\s*$/);
  if (m) return m[1].replace(/'use strict';/g, '');

  // 容错: 找到 applyHash(); 之后的 })(); (主 IIFE 在主流程最后调用自身)
  // applyHash 是主启动的最后一行的特征,后续的 })(); 就是外层 IIFE 闭合
  const ah = code.lastIndexOf('applyHash();');
  if (ah > 0) {
    // 从 ah 之后找 })(); 跳过字符串/注释/嵌套 IIFE
    const end = findOuterIIFEClose(code, ah);
    if (end > 0) {
      // 取 (function () { 起点作为 body 起点,end 作为终点 (exclusive)
      const start = code.indexOf('(function ()') >= 0
        ? code.indexOf('(function ()')
        : code.indexOf('(function(');
      if (start >= 0) {
        const openPos = code.indexOf('{', start);
        return code.slice(openPos + 1, end).replace(/'use strict';/g, '').trim();
      }
    }
  }

  // 最后兜底
  return code.replace(/'use strict';/g, '');
}

// 从 atIdx 起,跳过字符串/注释/嵌套 (function(){...})(); 找下一个外层 })();
function findOuterIIFEClose(code, atIdx) {
  let i = atIdx;
  while (i < code.length) {
    const ch = code[i];
    // 跳过注释
    if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      if (nl < 0) return -1;
      i = nl + 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) return -1;
      i = end + 2;
      continue;
    }
    // 字符串 (单/双)
    if (ch === '\'' || ch === '"') {
      const q = ch;
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    // 模板字符串 (含 ${})
    if (ch === '`') {
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '`') { i++; break; }
        if (code[i] === '$' && code[i + 1] === '{') {
          i += 2;
          // 找匹配的 } (含嵌套) - 简单 +1/-1 计数
          let depth = 1;
          while (i < code.length && depth > 0) {
            const cc = code[i];
            // 在表达式内也跳过字符串/注释 (简化: 仅识别 })
            if (cc === '{') depth++;
            else if (cc === '}') depth--;
            else if (cc === '\'' || cc === '"' || cc === '`') {
              // 简化: 跳到下一个匹配的引号
              const q = cc;
              i++;
              while (i < code.length) {
                if (code[i] === '\\') { i += 2; continue; }
                if (code[i] === q) break;
                i++;
              }
            }
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    // 找 })();
    if (ch === '}' && code.substr(i, 5) === '})();') {
      return i;
    }
    i++;
  }
  return -1;
}

function getAppData(html) {
  const m = html.match(/<script id="appData"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

// 极简 mock DOM (阶段 1-4 测试用)
function makeEl() {
  const el = { children: [], dataset: {}, style: {}, _textContent: '', _innerHTML: '', _value: '', _checked: false,
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false} },
    addEventListener(){}, appendChild(c){ this.children.push(c); return c; }, removeChild(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; },
    getAttribute(){ return null; }, setAttribute(){}, insertAdjacentHTML(){}, focus(){}, blur(){}, click(){}, dispatchEvent(){}
  };
  Object.defineProperty(el, 'textContent', { configurable: true, get(){return el._textContent;}, set(v){el._textContent=String(v);} });
  Object.defineProperty(el, 'innerHTML', { configurable: true, get(){return el._innerHTML;}, set(v){el._innerHTML=String(v);} });
  Object.defineProperty(el, 'value', { configurable: true, get(){return el._value;}, set(v){el._value=String(v);} });
  Object.defineProperty(el, 'checked', { configurable: true, get(){return el._checked;}, set(v){el._checked=!!v;} });
  return el;
}

function makeBaseEnv() {
  const __els = new Map();
  const getEl = (id) => { if (!__els.has(id)) __els.set(id, makeEl()); return __els.get(id); };
  const document_ = { getElementById: getEl, querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {}, createElement: () => makeEl(), removeEventListener(){}, body: makeEl(), readyState: 'complete' };
  const window_ = { addEventListener(){}, removeEventListener(){}, scrollTo(){}, devicePixelRatio: 1,
    speechSynthesis: { cancel(){}, speak(){}, getVoices(){return []}, onvoiceschanged: null },
    localStorage: { _store: {}, getItem(k){ return this._store[k] != null ? this._store[k] : '{}'; }, setItem(k,v){ this._store[k]=String(v); }, removeItem(k){ delete this._store[k]; } },
    navigator: { onLine: true },
    dispatchEvent(){},
    CustomEvent: function(name, init){ return { type: name, detail: init && init.detail }; },
    setTimeout: (fn, ms) => 0, clearTimeout(){},
    prompt: () => null, confirm: () => true, alert: () => {}
  };
  return { document: document_, window: window_, __els, getEl };
}

// 简易 IndexedDB mock
function makeMockIDB() {
  const stores = {};
  let idCounter = 1;
  function makeStore(name) {
    return {
      get(id) {
        const v = (stores[name] && stores[name].data && stores[name].data[id]) || null;
        return { onsuccess: null, onerror: null, result: v };
      },
      put(value) {
        if (!stores[name]) stores[name] = { data: {} };
        if (!value.id) value.id = 'auto_' + (idCounter++);
        stores[name].data[value.id] = value;
        return { onsuccess: null, onerror: null, result: value.id };
      },
      getAll() {
        const data = (stores[name] && stores[name].data) || {};
        return { onsuccess: null, onerror: null, result: Object.values(data) };
      },
      delete(id) {
        if (stores[name] && stores[name].data) delete stores[name].data[id];
        return { onsuccess: null, onerror: null };
      },
      count() {
        const data = (stores[name] && stores[name].data) || {};
        return { onsuccess: null, onerror: null, result: Object.keys(data).length };
      },
      clear() {
        if (stores[name]) stores[name].data = {};
        return { onsuccess: null, onerror: null };
      },
      createIndex(){}
    };
  }
  const idb = {
    open(name, ver) {
      return {
        onupgradeneeded: null, onsuccess: null, onerror: null,
        result: {
          objectStoreNames: { contains: (n) => !!stores[n] },
          createObjectStore(n, opts) {
            stores[n] = { keyPath: opts && opts.keyPath, data: {} };
            return { createIndex(){} };
          },
          transaction(sn, mode) {
            return { objectStore(s) { return makeStore(s); } };
          }
        }
      };
    }
  };
  const oldOpen = idb.open;
  idb.open = function (name, ver) {
    const req = oldOpen(name, ver);
    setTimeout(() => {
      req.onupgradeneeded && req.onupgradeneeded({ target: req });
      req.onsuccess && req.onsuccess();
    }, 0);
    return req;
  };
  return idb;
}

function setupGlobalEnv() {
  const env = makeBaseEnv();
  const idb = makeMockIDB();
  global.document = env.document;
  global.window = env.window;
  global.self = env.window;
  global.navigator = env.window.navigator;
  global.location = { hash: '' };
  global.performance = { now: () => Date.now() };
  global.Audio = function () { return { playbackRate: 1, play(){ return Promise.resolve(); }, pause(){}, addEventListener(){} }; };
  global.alert = () => {};
  global.SpeechSynthesisUtterance = function () {};
  global.SpeechRecognition = undefined;
  global.webkitSpeechRecognition = undefined;
  global.Blob = class {};
  global.URL = { createObjectURL: () => 'blob:mock' };
  global.indexedDB = idb;
  global.setTimeout = env.window.setTimeout;
  global.clearTimeout = env.window.clearTimeout;
  return env;
}

module.exports = {
  loadIndex, extractScripts, getMainIIFEBody, getAppData,
  makeBaseEnv, makeMockIDB, setupGlobalEnv, makeEl
};
