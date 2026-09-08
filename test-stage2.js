// 阶段 2 · 主题扩充 + 5 玩法 + SRS + 错题本
const { loadIndex, extractScripts, getMainIIFEBody, getAppData, setupGlobalEnv, makeEl } = require('./test-helpers');

let failed = 0;
function ok(n) { console.log('  OK ', n); }
function bad(n, msg) { console.log('  !! ', n, (msg||'')); failed++; }

const html = loadIndex();
const data = getAppData(html);

// 1. 主题与卡片数据
console.log('-- 1. 数据规模 --');
const liveTopics = ['kitchen','fruit','living','vegetable','transport','shopping','health','social','dining','home'];
const liveTopicOk = data.topics.filter(t => liveTopics.includes(t.topic_id));
if (liveTopicOk.length >= 9) ok('生活主题数 ≥ 9 (' + liveTopicOk.length + ' 个)');
else bad('生活主题数 ≥ 9', liveTopicOk.length);
if (data.cards.filter(c => c.topic === 'business').length >= 100) ok('商务卡 ≥ 100 (158)');
else bad('商务卡 ≥ 100', data.cards.filter(c => c.topic === 'business').length);
const totalLive = data.cards.filter(c => c.topic !== 'business').length;
if (totalLive >= 500) ok('生活卡总数 ≥ 500 (' + totalLive + ' 张)');
else bad('生活卡 ≥ 500', totalLive);

// 2. SRS 函数
console.log('-- 2. SRS 实现 --');
const srsChecks = [
  ['updateNavBadges 函数',       /function updateNavBadges\b/],
  ['shadow pool 加入逻辑',      /shadow_pool.*true|shadow_pool_meta/],
  ['SRS 间隔 1/2/4/7/15/30',    /INTERVALS\s*=\s*\[\s*1\s*,\s*2\s*,\s*4\s*,\s*7\s*,\s*15\s*,\s*30/],
];
for (const [n, re] of srsChecks) (re.test(html) ? ok : bad)(n);

// 3. 5 个游戏入口
console.log('-- 3. 5 个游戏 --');
const games = [
  ['Match 碰碰乐',   /id="view-match"/,   /function startRound\b/],
  ['Listen 听音',    /id="view-listen"/,  /function startListenRound\b/],
  ['Memory 连连看',  /id="view-memory"/,  /function startMemoryRound\b/],
  ['Gravity 消消乐', /id="view-gravity"/, /function startGravityRound\b/],
  ['Browse 浏览',    /id="view-browse"/,  /function renderBrowse\b/],
];
for (const [n, reView, reFn] of games) {
  (reView.test(html) ? ok : bad)(n + ' 视图');
  if (reFn) (reFn.test(html) ? ok : bad)(n + ' 函数');
}

// 4. 错题本
console.log('-- 4. 错题本 --');
const epChecks = [
  ['#view-errors 视图',          /id="view-errors"/],
  ['#errBadge 角标',             /id="errBadge"/],
  ['shadow_pool 字段持久化',     /shadow_pool: (true|!!)/],
];
for (const [n, re] of epChecks) (re.test(html) ? ok : bad)(n);

// 5. 主题卡入口
console.log('-- 5. 主题卡 .game-btn --');
const gbChecks = [
  ['.game-btn 样式',             /\.game-btn \{/],
  ['游戏入口按钮模板',            /data-action="(browse|listen|memory|gravity|record|match)"/],
];
for (const [n, re] of gbChecks) (re.test(html) ? ok : bad)(n);

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
if (errors.length === 0) ok('所有 <script> 块 eval 成功 (' + blocks.length + ' 个)');
else bad('部分 eval 失败', errors.join(' | '));

console.log();
console.log(failed === 0 ? '=== 阶段 2 全部通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
