// 阶段 3 · PWA + 录音跟读 + 进度可视化
const { loadIndex, extractScripts, getMainIIFEBody, getAppData, setupGlobalEnv, makeEl } = require('./test-helpers');

let failed = 0;
function ok(n) { console.log('  OK ', n); }
function bad(n, msg) { console.log('  !! ', n, (msg||'')); failed++; }

const html = loadIndex();
const data = getAppData(html);

// 1. PWA 资源
console.log('-- 1. PWA 资源 --');
const pwaChecks = [
  ['manifest.webmanifest 引用',     /<link rel="manifest"/],
  ['service worker 注册',           /navigator\.serviceWorker\.register|\.serviceWorker\.register/],
  ['主题色 meta',                  /<meta name="theme-color"/],
  ['viewport meta',                /<meta name="viewport"/],
  ['apple-touch-icon',              /<link rel="apple-touch-icon"/],
];
for (const [n, re] of pwaChecks) (re.test(html) ? ok : bad)(n);

// 2. 录音跟读视图
console.log('-- 2. 录音跟读 --');
const recChecks = [
  ['#view-record 视图',             /id="view-record"/],
  ['rec-card 样式',                 /\.rec-card \{/],
  ['rec-stage 样式',                /\.rec-stage \{/],
  ['rec-en 展示',                   /\.rec-en \{/],
  ['rec-btns 按钮组',               /\.rec-btns \{/],
  ['录音主按钮模板',                /id="recRecordBtn"/],
  ['回放按钮 (动态生成)',          /回放|replay|playback/],
  ['navbtn active 跟读模式',        /data-recmode/],
  ['rec-meter 电平显示',            /\.rec-meter/],
  ['pill.recording 录音中视觉',     /\.pill\.recording/],
  ['MediaRecorder 使用',            /MediaRecorder/],
  ['getUserMedia 调用',             /getUserMedia/],
  ['audioBlob URL.createObjectURL', /URL\.createObjectURL/],
  ['renderRecord 函数',             /function renderRecord\b|function renderRecordPage/],
  ['recPrev/recNext 翻页',          /recPrev.*addEventListener/],
];
for (const [n, re] of recChecks) (re.test(html) ? ok : bad)(n);

// 3. 进度可视化
console.log('-- 3. 进度可视化 --');
const progChecks = [
  ['#view-progress 视图',           /id="view-progress"/],
  ['KPI 卡片样式',                  /\.kpi-card \{/],
  ['KPI 网格',                      /\.kpi-grid \{/],
  ['canvas.chart-canvas 样式',      /\.chart-canvas \{/],
  ['activity chart 高 90px',       /activityChart.*height:\s*90px|#activityChart\.chart-canvas/],
  ['drawMasteryChart 函数',         /function drawMasteryChart\b/],
  ['renderSRSLadder 函数',          /function renderSRSLadder\b/],
  ['drawActivityChart 函数',        /function drawActivityChart\b/],
  ['renderAdvice 函数',             /function renderAdvice\b/],
  ['rec_history 字段',              /rec_history: \[\]/],
  ['rec_scores 字段',               /rec_scores: \{\}/],
  ['day_log 字段',                  /day_log: \{\}/],
  ['streak 字段更新',               /streak:.*0|\.streak\s*\+/],
];
for (const [n, re] of progChecks) (re.test(html) ? ok : bad)(n);

// 4. 自评三档
console.log('-- 4. 自评三档 --');
const selfRateChecks = [
  ['self-rate 三档按钮',           /data-self-rate|data-rate/],
  ['selfRate container CSS',       /\.selfrate \{/],
];
for (const [n, re] of selfRateChecks) (re.test(html) ? ok : bad)(n);

// 5. 跟读进度保存
console.log('-- 5. 跟读保存 --');
const saveChecks = [
  ['STATE.progress.rec_history',  /rec_history/],
  ['saveProgress 触发',            /saveProgress\(\)/],
];
for (const [n, re] of saveChecks) (re.test(html) ? ok : bad)(n);

// 6. 主 JS 启动
console.log('-- 6. 主 JS 启动 --');
const env = setupGlobalEnv();
env.__els.set('appData', makeEl());
env.__els.get('appData')._textContent = JSON.stringify(data);

const blocks = extractScripts(html);
const errors = [];
for (const b of blocks) {
  try {
    if (b.isMain) {
      const code = b.code.replace(/'use strict';/g, '');
      const iife = code.match(/^\(function\s*\(\)\s*\{([\s\S]*?)\}\)\(\)\s*;?\s*$/);
      eval(iife ? iife[1] : code);
    } else {
      eval(b.code);
    }
  } catch (e) {
    errors.push((b.isMain ? '[main]' : '[lib]') + ' ' + e.message);
  }
}
if (errors.length === 0) ok('所有 <script> 块 eval 成功');
else bad('eval 失败', errors.join(' | '));

console.log();
console.log(failed === 0 ? '=== 阶段 3 全部通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
