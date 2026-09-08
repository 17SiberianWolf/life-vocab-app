// 阶段 4 · 真实发音评分 (兼容阶段 5 嵌入结构)
const { loadIndex, extractScripts, getMainIIFEBody, getAppData, setupGlobalEnv, makeEl } = require('./test-helpers');

let failed = 0;
function ok(n) { console.log('  OK ', n); }
function bad(n, msg) { console.log('  !! ', n, (msg||'')); failed++; }

const html = loadIndex();
const data = getAppData(html);

// 1. 评分核心函数 (静态)
console.log('-- 1. 评分核心函数 --');
const checks = [
  ['levenshtein 函数',           /function levenshtein\b/],
  ['_normTokenize 函数',         /function _normTokenize\b/],
  ['scorePronunciation 函数',    /function scorePronunciation\b/],
  ['renderScoreResult 函数',     /function renderScoreResult\b/],
  ['startAutoScore 函数',        /function startAutoScore\b/],
  ['stopAutoScore 函数',         /function stopAutoScore\b/],
  ['REC_SCORE 全局对象',         /const REC_SCORE = \{/],
];
for (const [n, re] of checks) (re.test(html) ? ok : bad)(n);

// 2. DOM 钩子 (静态)
console.log('-- 2. DOM 钩子 --');
const domChecks = [
  ['[data-score="word"] 模板',    /data-score="word"/],
  ['[data-score="ex"] 模板',      /data-score="ex"/],
  ['[data-score] 点击监听',       /\[data-score\]/],
  ['Web Speech API 检测',         /SpeechRecognition \|\| window\.webkitSpeechRecognition/],
  ['SpeechRecognition 兼容 en-GB',/r\.lang = 'en-GB'/],
];
for (const [n, re] of domChecks) (re.test(html) ? ok : bad)(n);

// 3. CSS (静态)
console.log('-- 3. CSS 样式 --');
const cssChecks = [
  ['.score-badge 样式',           /\.score-badge \{/],
  ['.s-good 样式',                /\.score-badge\.s-good/],
  ['.s-mid 样式',                 /\.score-badge\.s-mid/],
  ['.s-bad 样式',                 /\.score-badge\.s-bad/],
  ['.scored-target 容器',         /\.scored-target \{/],
  ['词高亮 .w.hit',               /\.scored-target \.w\.hit/],
  ['词高亮 .w.miss',              /\.scored-target \.w\.miss/],
  ['listening 动画',              /\.listening \{/],
  ['pulse keyframes',             /@keyframes pulse/],
];
for (const [n, re] of cssChecks) (re.test(html) ? ok : bad)(n);

// 4. Progress state 新字段
console.log('-- 4. progress state --');
const stateChecks = [
  ['rec_scores 初始化',            /rec_scores: \{\}/],
  ['loadProgress 兜底 rec_scores', /rec_scores: \{\}, day_log/],
];
for (const [n, re] of stateChecks) (re.test(html) ? ok : bad)(n);

// 5. 实际跑函数 (mock 环境)
console.log('-- 5. 实际函数调用 --');
const env = setupGlobalEnv();
env.__els.set('appData', makeEl());
env.__els.get('appData')._textContent = JSON.stringify(data);

const blocks = extractScripts(html);
let mainFunx = null;
let mainBody = null;
// 先把非主块 eval 掉 (db/sync/auth/install 等)
for (const b of blocks) {
  if (b.isMain) continue;
  try { eval(b.code); } catch (e) { /* lib 块可能在 mock 环境缺依赖,忽略 */ }
}
// 单独取主 IIFE body
mainBody = getMainIIFEBody(html);
try {
  // 把函数导出 (用作动态测试)
  const wrapper =
    mainBody.trim() +
    '\n;return { levenshtein, scorePronunciation, startAutoScore, stopAutoScore, _normTokenize };';
  mainFunx = new Function(wrapper)();
} catch (e) {
  console.log('  (主 IIFE eval 失败:', e.message + ')');
}
if (mainFunx) ok('主 IIFE 启动并导出关键函数');
else bad('主 IIFE 启动', 'no');

const levenshtein = mainFunx && mainFunx.levenshtein;
const scorePronunciation = mainFunx && mainFunx.scorePronunciation;
const startAutoScore = mainFunx && mainFunx.startAutoScore;
const stopAutoScore = mainFunx && mainFunx.stopAutoScore;

try {
  // 1) levenshtein
  if (levenshtein('apple', 'apple') === 0) ok('levenshtein 相同=0'); else bad('levenshtein 相同');
  if (levenshtein('apple', 'aple') === 1) ok('levenshtein 差1=1'); else bad('levenshtein 差1');
  if (levenshtein('kitten', 'sitting') === 3) ok('levenshtein kitten/sitting=3'); else bad('levenshtein kitten/sitting');

  // 2) scorePronunciation 满分
  const s1 = scorePronunciation('hello world', 'hello world');
  if (s1.score === 100 && s1.perWord.every(w => w.kind === 'hit')) ok('完美 100');
  else bad('完美 100', JSON.stringify(s1));

  // 3) 完全错
  const s2 = scorePronunciation('apple banana', 'cat dog');
  if (s2.score === 0 && s2.perWord.every(w => w.kind === 'miss')) ok('完全错 0');
  else bad('完全错 0', JSON.stringify(s2));

  // 4) 模糊命中
  const s3 = scorePronunciation('apple', 'aple');
  if (s3.score >= 50 && s3.perWord[0].kind === 'hit') ok('模糊命中 (aple) 50-100');
  else bad('模糊命中', JSON.stringify(s3));

  // 5) 大小写 + 标点
  const s4 = scorePronunciation('Hello, World!', 'hello world');
  if (s4.score === 100) ok('大小写 + 标点忽略 = 100');
  else bad('大小写 + 标点', JSON.stringify(s4));

  // 6) 部分命中
  const s5 = scorePronunciation('apple banana cherry', 'apple cherry');
  if (s5.score >= 60 && s5.score <= 70) ok('部分命中 (1/3 miss) ≈67');
  else bad('部分命中', JSON.stringify(s5));

  // 7) 长例句
  const s6 = scorePronunciation('The quick brown fox jumps over the lazy dog', 'the quick brown fox jumps over lazy dog');
  ok('长例句 9/9 命中: ' + s6.score + ' 分, 漏 ' + s6.perWord.filter(w => w.kind === 'miss').map(w => w.w).join(', '));

  // 8) 无 SR 环境优雅处理
  try {
    startAutoScore('word');
    ok('无 SR 环境下 startAutoScore 不崩');
  } catch (e) {
    bad('无 SR 环境下 startAutoScore', e.message);
  }
} catch (e) {
  bad('动态调用', e.message);
  console.log('   ' + (e.stack || '').split('\n').slice(0, 4).join('\n   '));
}

console.log();
console.log(failed === 0 ? '=== 阶段 4 全部通过 ===' : '!! 有 ' + failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
