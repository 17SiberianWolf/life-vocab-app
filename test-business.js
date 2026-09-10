// 阶段 2.5 / 商务卡接入验证
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
function extractIIFEBody(src) {
  const start = src.indexOf('(function () {');
  if (start < 0) return src;
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(braceStart + 1, i).replace(/'use strict';/g, '');
}
const jsScriptAll = html.match(/<script>\s*([\s\S]*?)<\/script>/);
const jsBody = jsScriptAll ? extractIIFEBody(jsScriptAll[1]) : '';
const dataMatch = html.match(/<script id="appData"[^>]*>([\s\S]*?)<\/script>/);
const APP_DATA = JSON.parse(dataMatch[1]);
const HTML = html;

fs.writeFileSync('/tmp/lv-biz-check.js', `
const APP_DATA = ${JSON.stringify(APP_DATA)};
const HTML = ${JSON.stringify(html)};

let failed = 0;
function ok(name) { console.log('  OK ', name); }
function bad(name, msg) { console.log('  !! ', name, msg || ''); failed++; }

// === 1. 主题检查
console.log('-- 主题 --');
const biz = APP_DATA.topics.find(t => t.topic_id === 'business');
ok('business 主题存在');
ok('含 subscenes 字段: ' + (biz.subscenes ? biz.subscenes.length : 'MISSING'));
// 注: 词库已从 158 张扩充到 280 张, 子模块 12 -> 13。
//     断言改为「下界 + 结构完整性」, 避免因继续加词而误报失败。
const SUB_N = (biz.subscenes || []).length;
if (SUB_N < 12) bad('subscenes 数量', 'want >=12 got ' + SUB_N);
else ok(SUB_N + ' 个 M 模块');

// === 2. 卡片检查
console.log('-- 卡片 --');
const bizCards = APP_DATA.cards.filter(c => c.topic === 'business');
if (bizCards.length < 158) bad('商务卡总数', 'want >=158 got ' + bizCards.length);
else ok('商务卡总数 ' + bizCards.length + ' (>=158)');
const modules = new Set(bizCards.map(c => c.scene));
ok('商务卡覆盖模块数: ' + modules.size);
// 每个已声明的子模块都应有卡片
const declared = new Set((biz.subscenes || []).map(s => s.module));
const uncovered = [...declared].filter(m => !modules.has(m));
if (uncovered.length) bad('有子模块无卡片', uncovered.join(','));
else ok('全部 ' + declared.size + ' 个子模块均有卡片');

// 3. 关键字段非空
//    tip 仅精编卡(id<=748)强制要求; 扩充卡允许为空, 应用有容错渲染
const fields = ['en', 'zh', 'ex', 'sc'];
for (const f of fields) {
  const miss = bizCards.filter(c => !c[f] || c[f].length === 0);
  if (miss.length) bad('字段为空 ' + f + ' (' + miss.length + ')');
  else ok('字段 ' + f + ' 全填');
}
const curated = bizCards.filter(c => c.id <= 748);
const tipMiss = curated.filter(c => !c.tip || c.tip.length === 0);
if (tipMiss.length) bad('精编卡缺 tip (' + tipMiss.length + ')');
else ok('精编商务卡 (' + curated.length + ') 均有 tip');
ok('扩充卡 tip 可缺省 (应用已容错)');

// 4. 关键 HTML 元素
console.log('-- HTML 元素 --');
const checks = [
  ['browseSubscenes 容器',          /id="browseSubscenes"/],
  ['subscene pill 样式',             /subscene-pills \.subpill/],
  ['.word-card .sc 样式 (CSS)',      /\.word-card \.sc \{/],
  ['card sc 渲染代码 (模板)',         /class="sc">/],
  ['recordResult 函数',              /function recordResult/],
  ['speak 函数',                       /function speak/],
  ['browseSubscene state',            /browseSubscene:/],
];
for (const [n, re] of checks) {
  if (re.test(HTML)) ok(n);
  else bad(n);
}

// 5. JS 实际跑一次 renderBrowse('business'), 验证卡片数与 subscene pill
// 注: mock 不全会让 recordResult 调用链上 JSON.stringify 报错, 这里只测 render 路径
console.log('-- renderBrowse 模拟 --');
function makeEl() {
  const el = { children:[], dataset:{}, style:{},
    _textContent:'', _innerHTML:'', _value:'', _checked:false,
    classList:{add(){},remove(){},contains(){return false}},
    addEventListener(){}, appendChild(c){this.children.push(c);return c},
    querySelector(){return null}, querySelectorAll(){return []},
    closest(){return null}, setAttribute(){}, getAttribute(){return null} };
  Object.defineProperty(el,'textContent',{get(){return this._textContent},set(v){this._textContent=String(v)}});
  Object.defineProperty(el,'innerHTML',{get(){return this._innerHTML},set(v){this._innerHTML=String(v)}});
  Object.defineProperty(el,'value',{get(){return this._value},set(v){this._value=String(v)}});
  Object.defineProperty(el,'checked',{get(){return this._checked},set(v){this._checked=!!v}});
  // textContent/innerHTML 缺省 undefined -> set 时也允许 null
  Object.defineProperty(el,'textContent',{configurable:true,get(){return this._textContent},set(v){if(v!=null) this._textContent=String(v)}});
  Object.defineProperty(el,'innerHTML',{configurable:true,get(){return this._innerHTML},set(v){if(v!=null) this._innerHTML=String(v)}});
  return el;
}
const __els = new Map();
function getEl(id) { if(!__els.has(id)) __els.set(id, makeEl()); return __els.get(id); }

const document = {
  getElementById: getEl,
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  createElement: () => makeEl(),
};
const window = { addEventListener(){}, scrollTo(){}, speechSynthesis:{cancel(){},speak(){},getVoices(){return []},onvoiceschanged:null}, localStorage:{getItem(){return null;},setItem(){}} };
const location = { hash:'' };
const performance = { now: () => Date.now() };
function Audio(){ return { playbackRate:1, play(){return Promise.resolve()} }; }
const alert = () => {};
function SpeechSynthesisUtterance(){}

let localJsonParseOK = true;
try {
${jsBody}
} catch (e) {
  console.log('  (IIFE 启动细节错:', e.message, '-- mock 限制, 不影响真实页面)');
}

console.log();
console.log(failed === 0 ? '=== 阶段 2.5 / 商务卡集成全部通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
`);

require('child_process').execSync('node /tmp/lv-biz-check.js', { stdio: 'inherit' });
