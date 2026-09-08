// 阶段 1 · MVP Web + Match 验证 (兼容阶段 5 嵌入结构)
const { loadIndex, extractScripts, getMainIIFEBody, getAppData, setupGlobalEnv, makeMockIDB } = require('./test-helpers');

let failed = 0;
function ok(n) { console.log('  OK ', n); }
function bad(n, msg) { console.log('  !! ', n, (msg||'')); failed++; }

const html = loadIndex();

// 1. 关键函数存在
console.log('-- 1. 关键函数定义 --');
const checks = [
  ['renderTopics 函数',           /function renderTopics\b/],
  ['renderBrowse 函数',           /function renderBrowse\b/],
  ['startMatchRound 函数',        /function startRound\b/],
  ['startListenRound 函数',       /function startListenRound\b/],
  ['recordResult 函数',           /function recordResult\b/],
  ['saveProgress 函数',           /function saveProgress\b/],
  ['loadProgress 函数',           /function loadProgress\b/],
  ['speak 函数',                  /function speak\b/],
  ['updateNavBadges 函数',        /function updateNavBadges\b/],
];
for (const [n, re] of checks) (re.test(html) ? ok : bad)(n);

// 2. UI 元素
console.log('-- 2. UI 元素 --');
const uiChecks = [
  ['顶部 nav 主题按钮',           /data-go="topics"/],
  ['顶部 nav 今日复习按钮',       /data-go="srs"/],
  ['顶部 nav 错题本按钮',         /data-go="errors"/],
  ['顶部 nav 跟读按钮',           /data-go="record"/],
  ['顶部 nav 进度按钮',           /data-go="progress"/],
  ['顶部 nav 设置按钮',           /data-go="settings"/],
  ['#view-topics 视图',            /id="view-topics"[^>]*class="view active"/],
  ['#view-match 视图',             /id="view-match"/],
  ['#view-listen 视图',            /id="view-listen"/],
  ['#view-memory 视图',            /id="view-memory"/],
  ['#view-gravity 视图',           /id="view-gravity"/],
  ['#view-record 视图',            /id="view-record"/],
  ['#view-progress 视图',          /id="view-progress"/],
  ['#view-settings 视图',          /id="view-settings"/],
];
for (const [n, re] of uiChecks) (re.test(html) ? ok : bad)(n);

// 3. CSS 样式
console.log('-- 3. CSS 基础 --');
const cssChecks = [
  ['match-board 样式',            /\.match-board\s*[,{]/],
  ['memory-board 样式',           /\.memory-board/],
  ['gravity-stage 样式',          /\.gravity-stage/],
  ['game-stats 样式',             /\.game-stats/],
  ['word-card 样式',              /\.word-card/],
  ['rec-stage 样式',              /\.rec-stage/],
];
for (const [n, re] of cssChecks) (re.test(html) ? ok : bad)(n);

// 4. 数据
console.log('-- 4. 数据 --');
const data = getAppData(html);
if (data) {
  ok('appData 解析 (' + data.topics.length + ' 主题 / ' + data.cards.length + ' 卡)');
  if (data.topics.length >= 10) ok('主题数 ≥ 10 (阶段 2 已扩展)'); else bad('主题数 ≥ 10', data.topics.length);
  if (data.cards.length >= 700) ok('卡片数 ≥ 700'); else bad('卡片数 ≥ 700', data.cards.length);
} else bad('appData 解析', 'null');

// 5. Mock 环境跑主 JS
console.log('-- 5. 主 JS 启动 --');
const env = setupGlobalEnv();
const { makeEl } = require('./test-helpers');
env.__els.set('appData', makeEl());
env.__els.get('appData')._textContent = JSON.stringify(data);

const blocks = extractScripts(html);
let mainStarted = false;
for (const b of blocks) {
  try {
    if (b.isMain) {
      const code = b.code.replace(/'use strict';/g, '');
      const iife = code.match(/^\(function\s*\(\)\s*\{([\s\S]*?)\}\)\(\)\s*;?\s*$/);
      const inner = iife ? iife[1] : code;
      eval(inner);
      mainStarted = true;
    } else {
      eval(b.code);
    }
  } catch (e) {
    bad((b.isMain ? '[main] ' : '[lib] ') + (b.code.slice(0, 60).replace(/\s+/g, ' ')), e.message);
  }
}
if (mainStarted) ok('主 IIFE 启动成功');
else bad('主 IIFE 启动', 'unknown');

console.log();
console.log(failed === 0 ? '=== 阶段 1 (MVP + 5 玩法) 全部通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
