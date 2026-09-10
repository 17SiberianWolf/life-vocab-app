/* ============================================================
 * test-spell.js · 「✍ 拼写」玩法专项测试
 * ------------------------------------------------------------
 * 覆盖:
 *   ① 结构接入 (视图/导航/路由/生命周期/入口)
 *   ② 移动端可靠性 (首个文本输入框: 输入属性/字号/触控目标)
 *   ③ 判定与提示纯函数 (宽松口径 / 逐字符实时校验 / 遮罩)
 *   ④ 逐字符实时警示行为 (输错立即红框 + 文本定位)
 *   ⑤ 数据预检 (严格判定下 en 无首尾/连续空格; 每主题题量充足)
 * 运行: node test-spell.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { getAppData } = require('./test-helpers');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n-- ' + t + ' --'); }

// ------------------------------------------------------------
// 1. 结构接入 (静态)
// ------------------------------------------------------------
section('1. 结构接入');
const struct = [
  ['#view-spell 视图区块',            /id="view-spell"/],
  ['视图标题 Spell 拼写',             /id="spellTitle"/],
  ['中文释义容器 #spellZh',           /id="spellZh"/],
  ['拼写输入框 #spellInput',          /id="spellInput"/],
  ['提交按钮 #spellSubmit',           /id="spellSubmit"/],
  ['提示按钮 #spellHint',             /id="spellHint"/],
  ['跳过按钮 #spellSkip',             /id="spellSkip"/],
  ['警示容器 #spellWarn',             /id="spellWarn"/],
  ['发音按钮 #spellPlay',             /id="spellPlay"/],
  ['慢速按钮 #spellPlaySlow',         /id="spellPlaySlow"/],
  ['STATE.spellRound 字段',           /spellRound:\s*null/],
  ['renderSpell 函数',                /function renderSpell\b/],
  ['startSpellRound 函数',            /function startSpellRound\b/],
  ['nextSpell 函数',                  /function nextSpell\b/],
  ['submitSpell 函数',                /function submitSpell\b/],
  ['showHint 函数',                   /function showHint\b/],
  ['skipSpell 函数',                  /function skipSpell\b/],
  ['endSpellRound 函数',              /function endSpellRound\b/],
  ['stopSpellGame 函数',              /function stopSpellGame\b/],
  ['stopAllGames 调用 stopSpellGame', /stopGravityGame\(\);\s*stopSpellGame\(\);/],
  ["show() 含 spell 分支",            /name === 'spell'\)\s*renderSpell/],
  ['顶栏入口 data-go="spell"',        /data-go="spell"/],
  ['主题卡入口 data-action="spell"',  /data-action="spell"/],
  ['题源正则 SPELL_EN_OK',            /const SPELL_EN_OK = \/\^\[A-Za-z\]/],
];
for (const [n, re] of struct) ok(n, re.test(html));

// ------------------------------------------------------------
// 2. 移动端可靠性
// ------------------------------------------------------------
section('2. 移动端可靠性 (首个文本输入框)');
const mob = [
  ['inputmode="text"',                /id="spellInput"[^>]*inputmode="text"/],
  ['autocomplete="off"',              /id="spellInput"[^>]*autocomplete="off"/],
  ['autocorrect="off"',               /id="spellInput"[^>]*autocorrect="off"/],
  ['autocapitalize="none"',           /id="spellInput"[^>]*autocapitalize="none"/],
  ['spellcheck="false"',              /id="spellInput"[^>]*spellcheck="false"/],
  ['enterkeyhint="done"',             /id="spellInput"[^>]*enterkeyhint="done"/],
  ['.spell-input 样式存在',           /\.spell-input \{/],
  ['移动端输入框 font-size 16px',     /\.spell-input \{ font-size: 16px/],
  ['移动端输入框 min-height 44px',    /\.spell-input \{[^}]*min-height: 44px/],
  ['抖动动画 spell-shake',            /@keyframes spell-shake/],
  ['移动端不自动聚焦(守卫 IS_MOBILE)', /!IS_MOBILE/],
];
for (const [n, re] of mob) ok(n, re.test(html));

// ------------------------------------------------------------
// 3. 数据接入 (SRS / XP / 连击)
// ------------------------------------------------------------
section('3. 数据接入');
const dataWiring = [
  ['答对写回 recordResult(true)',   /recordResult\(r\.current\.id, true\)/],
  ['答错写回 recordResult(false)',  /recordResult\(r\.current\.id, false\)/],
  ['错误去重 wrongRecorded',        /wrongRecorded/],
  ['计 XP addXP(10)',               /addXP\(10\)/],
  ['连击 bumpStreak()',             /bumpStreak\(\)/],
  ['自动播报 speak(',               /speak\(cur\.en, false\)/],
  ['慢速发音 speak(..., true)',     /speak\(r\.current\.en, true\)/],
  ['回合身份守卫',                  /STATE\.spellRound !== r/],
];
for (const [n, re] of dataWiring) ok(n, re.test(html));

// ------------------------------------------------------------
// 4. 纯函数单元测试 (从构建产物抽取源码, 沙箱执行)
// ------------------------------------------------------------
section('4. 纯函数单元测试');
const sStart = html.indexOf('function normalizeSpelling(');
const sEnd = html.indexOf('function renderSpell(');
if (sStart < 0 || sEnd < 0 || sEnd <= sStart) {
  ok('抽取拼写纯函数代码段', false, 'index.html 中未找到拼写函数段');
} else {
  ok('抽取拼写纯函数代码段', true);
  const pureSrc = html.slice(sStart, sEnd);
  let api;
  try {
    api = new Function(
      pureSrc + '\n;return { normalizeSpelling, firstSpellMismatch, hintText, spellLetterCount, SPELL_EN_OK };'
    )();
  } catch (e) {
    ok('沙箱执行拼写纯函数', false, e.message);
  }

  if (api) {
    ok('沙箱执行拼写纯函数', true);
    const { normalizeSpelling: N, firstSpellMismatch: F, hintText: H, spellLetterCount: C, SPELL_EN_OK: R } = api;

    // 4.1 归一化: 忽略大小写, 但空格/特殊字符严格
    ok('忽略大小写 Knife≡knife',                 N('Knife') === N('knife'));
    ok('漏空格 goodmorning≢good morning',        N('goodmorning') !== N('good morning'));
    ok('首尾空格严格 "  knife "≢knife',          N('  knife ') !== N('knife'));
    ok('连续空格严格 "good  morning"≢"good morning"', N('good  morning') !== N('good morning'));
    ok('特殊字符严格 kn!fe≢knife',               N('kn!fe') !== N('knife'));
    ok('弯撇号归一 don’t≡don\'t',                N('don\u2019t') === N("don't"));
    ok('连字符变体归一 well–known≡well-known',   N('well\u2013known') === N('well-known'));

    // 4.2 逐字符实时校验 (警示核心)
    ok("F('stas','start')===3 (中间字母错)",     F('stas', 'start') === 3);
    ok("F('xtart','start')===0 (首字母错)",      F('xtart', 'start') === 0);
    ok("F('sta','start')===-1 (正确前缀)",       F('sta', 'start') === -1);
    ok("F('startx','start')===5 (多打字符)",     F('startx', 'start') === 5);
    ok("F('goodmorning','good morning')===4 (漏空格)", F('goodmorning', 'good morning') === 4);
    ok("F('','start')===-1 (空输入)",            F('', 'start') === -1);
    ok("F('Star','start')===-1 (大小写不敏感)",  F('Star', 'start') === -1);
    ok("F('start','start')===-1 (完全正确)",     F('start', 'start') === -1);

    // 4.3 提示遮罩
    ok("hintText('start',2)==='st___'",          H('start', 2) === 'st___');
    ok("hintText('start',0)==='_____'",          H('start', 0) === '_____');
    ok("hintText(\"don't\",4)===\"don't\"",      H("don't", 4) === "don't");
    ok("hintText('good morning',2) 保留空格",     H('good morning', 2) === 'go__  _______');
    ok("spellLetterCount('good morning')===11",  C('good morning') === 11);

    // 4.4 题源过滤
    ok("SPELL_EN_OK 接受 'start'",               R.test('start'));
    ok("SPELL_EN_OK 接受 'good morning'",        R.test('good morning'));
    ok("SPELL_EN_OK 接受 \"don't\"",             R.test("don't"));
    ok("SPELL_EN_OK 接受 'well-known'",          R.test('well-known'));
    ok("SPELL_EN_OK 拒绝 'pear (Asian)'",        !R.test('pear (Asian)'));
    ok("SPELL_EN_OK 拒绝 'the bill, please'",    !R.test('the bill, please'));
    ok("SPELL_EN_OK 拒绝 'A / B'",               !R.test('A / B'));
    ok("SPELL_EN_OK 拒绝 'I'd like...'",         !R.test("I'd like..."));
  }
}

// ------------------------------------------------------------
// 5. 逐字符实时警示行为 (mock DOM 跑输入处理器)
// ------------------------------------------------------------
section('5. 逐字符实时警示行为');
(function dynamicWarn() {
  const ids = ['spellRestart', 'spellPlay', 'spellPlaySlow', 'spellSubmit', 'spellHint', 'spellSkip', 'spellInput', 'spellZh', 'spellReveal', 'spellWarn', 'spellAnswered', 'spellCorrect', 'spellStreak', 'spellTimer', 'spellTitle'];
  const listeners = {};
  const els = {};
  function makeEl(id) {
    const e = { id, value: '', disabled: false, textContent: '', innerHTML: '', offsetWidth: 100, _cls: new Set(),
      addEventListener(t, fn) { (listeners[id] = listeners[id] || {})[t] = fn; }, focus() {}, blur() {} };
    e.classList = { add: (...c) => c.forEach(x => e._cls.add(x)), remove: (...c) => c.forEach(x => e._cls.delete(x)), contains: (c) => e._cls.has(c) };
    return e;
  }
  ids.forEach(id => { els[id] = makeEl(id); });
  const documentMock = { getElementById: (id) => els[id] || (els[id] = makeEl(id)) };

  const moduleSrc = html.slice(html.indexOf('function normalizeSpelling('), html.indexOf('// Memory 连连看'));
  const stateRef = { spellRound: { current: { en: 'start' }, errAt: -1 } };
  try {
    new Function('STATE', 'speak', 'recordResult', 'addXP', 'bumpStreak', 'shuffle', 'escapeHtml', 'IS_MOBILE', 'show', 'alert', 'document', 'performance', 'setInterval', 'clearInterval', moduleSrc)(
      stateRef, () => {}, () => {}, () => {}, () => {}, (a) => a, (x) => String(x), false, () => {}, () => {},
      documentMock, { now: () => 0 }, () => 0, () => {}
    );
  } catch (e) {
    ok('沙箱加载拼写模块', false, e.message);
    return;
  }
  ok('沙箱加载拼写模块', true);

  const input = els.spellInput, warn = els.spellWarn;
  const onInput = listeners.spellInput && listeners.spellInput.input;
  ok('拼写输入 input 监听已绑定', typeof onInput === 'function');
  if (typeof onInput !== 'function') return;

  // A: 正确前缀 -> 不警示
  input.value = 'sta'; input.disabled = false;
  onInput();
  ok('正确前缀不警示(sta)', !input.classList.contains('wrong') && warn.textContent === '');

  // B: 中间字母输错 -> 红框 + 定位第 4 个字符
  input.value = 'stas';
  onInput();
  ok('中间字母错 -> 输入框变红', input.classList.contains('wrong'));
  ok('中间字母错 -> 提示"第 4 个字符不正确"', /第 4 个字符/.test(warn.textContent), warn.textContent);

  // C: 首字母错 -> 立即警示
  stateRef.spellRound.errAt = -1;
  input.value = 'xtart';
  onInput();
  ok('首字母错 -> 输入框变红', input.classList.contains('wrong'));
  ok('首字母错 -> 提示"第 1 个字符不正确"', /第 1 个字符/.test(warn.textContent), warn.textContent);

  // D: 改正为完整正确 -> 红框消失
  stateRef.spellRound.errAt = -1;
  input.value = 'start';
  onInput();
  ok('改回正确 -> 红框消失且清空警示', !input.classList.contains('wrong') && warn.textContent === '');

  // E: 多打字符 -> 提示多输
  input.value = 'startx';
  onInput();
  ok('多打字符 -> 提示"多输了字符"', /多输了字符/.test(warn.textContent), warn.textContent);
})();

// ------------------------------------------------------------
// 5.2 完整回合流程 (mock DOM 驱动真实游戏循环)
// ------------------------------------------------------------
section('5.2 完整回合流程');
(function fullLoop() {
  const cardPool = (getAppData(html) || {}).cards || [];
  const goodPool = cardPool.filter(c => /^[A-Za-z][A-Za-z'\- ]*$/.test(c.en || ''));
  if (goodPool.length < 10) { ok('拼写题库充足(>=10)', false, 'pool=' + goodPool.length); return; }

  const ids = ['spellRestart', 'spellPlay', 'spellPlaySlow', 'spellSubmit', 'spellHint', 'spellSkip', 'spellInput', 'spellZh', 'spellReveal', 'spellWarn', 'spellAnswered', 'spellCorrect', 'spellStreak', 'spellTimer', 'spellTitle'];
  const listeners = {}, els = {};
  function makeEl(id) {
    const e = { id, value: '', disabled: false, textContent: '', innerHTML: '', offsetWidth: 100, _cls: new Set(),
      addEventListener(t, fn) { (listeners[id] = listeners[id] || {})[t] = fn; }, focus() {}, blur() {} };
    e.classList = { add: (...c) => c.forEach(x => e._cls.add(x)), remove: (...c) => c.forEach(x => e._cls.delete(x)), contains: (c) => e._cls.has(c) };
    return e;
  }
  ids.forEach(id => { els[id] = makeEl(id); });
  const documentMock = { getElementById: (id) => els[id] || (els[id] = makeEl(id)) };

  const timers = [];
  const flush = () => { let guard = 0; while (timers.length && guard++ < 100) timers.shift()(); };

  const STATE = { spellRound: null, cards: goodPool, topics: [], currentTopic: null, progress: {} };
  const calls = { speak: 0, recTrue: [], recFalse: [], xp: 0, streak: 0 };
  const moduleSrc = html.slice(html.indexOf('function normalizeSpelling('), html.indexOf('// Memory 连连看'));

  let api;
  try {
    api = new Function('STATE', 'speak', 'recordResult', 'addXP', 'bumpStreak', 'shuffle', 'escapeHtml', 'IS_MOBILE', 'show', 'alert', 'document', 'performance', 'setInterval', 'clearInterval', 'setTimeout',
      moduleSrc + '\n;return { startSpellRound, submitSpell, showHint, skipSpell };'
    )(
      STATE, () => { calls.speak++; }, (id, okv) => { (okv ? calls.recTrue : calls.recFalse).push(id); },
      (n) => { calls.xp += n; }, () => { calls.streak++; }, (a) => a, (x) => String(x), true, () => {}, () => {},
      documentMock, { now: () => 0 }, () => 0, () => {}, (fn) => { timers.push(fn); return timers.length; }
    );
  } catch (e) { ok('沙箱加载完整拼写模块', false, e.message); return; }
  ok('沙箱加载完整拼写模块', true);

  api.startSpellRound(); flush();
  ok('开局生成 10 题', STATE.spellRound && STATE.spellRound.queue.length === 10, 'n=' + (STATE.spellRound && STATE.spellRound.queue.length));
  ok('当前题含 en/zh', !!(STATE.spellRound.current && STATE.spellRound.current.en && STATE.spellRound.current.zh));
  ok('进题自动播报发音', calls.speak > 0);
  ok('中文释义已渲染', els.spellZh.textContent === STATE.spellRound.current.zh);

  // —— 答对流程 ——
  const cur = STATE.spellRound.current;
  els.spellInput.value = cur.en;
  api.submitSpell();
  ok('答对写回 SRS(true)', calls.recTrue.length === 1, JSON.stringify(calls.recTrue));
  ok('答对计入 XP(10)', calls.xp === 10);
  ok('答对累加连击', STATE.spellRound.streak === 1 && calls.streak === 1);
  ok('答对即时展示 ✓ 与答案', /✓/.test(els.spellReveal.textContent), els.spellReveal.textContent);
  ok('答对后暂停(未立即跳题)', STATE.spellRound.cursor === 0);
  flush();
  ok('延迟后推进到下一题', STATE.spellRound.cursor === 1);
  ok('答对后输入框清空', els.spellInput.value === '' && els.spellInput.disabled === false);

  // —— 大小写不敏感 (真实出题路径) ——
  const cur1b = STATE.spellRound.current;
  els.spellInput.value = cur1b.en.toUpperCase();
  api.submitSpell();
  ok('大小写不敏感也算对', calls.recTrue.length === 2);
  flush();

  // —— 连错 3 次流程 ——
  const cur2 = STATE.spellRound.current;
  const recFalseBefore = calls.recFalse.length;
  for (let i = 0; i < 3; i++) { els.spellInput.value = cur2.en + 'x'; api.submitSpell(); }
  ok('连错 3 次仅记 1 次 SRS(false)', calls.recFalse.length === recFalseBefore + 1, 'n=' + calls.recFalse.length);
  ok('连错 3 次展示正确答案', /正确答案/.test(els.spellReveal.textContent), els.spellReveal.textContent);
  ok('连错 3 次锁定输入框', els.spellInput.disabled === true);
  ok('连错清零连击', STATE.spellRound.streak === 0);
  ok('连错 3 次后暂停(未立即跳题)', STATE.spellRound.cursor === 2);
  flush();
  ok('连错后推进到下一题', STATE.spellRound.cursor === 3);

  // —— 跳过流程 (不计分/不写 SRS) ——
  const cur3 = STATE.spellRound.current;
  const recTrueBefore = calls.recTrue.length, recFalseBefore2 = calls.recFalse.length, answeredBefore = STATE.spellRound.answered;
  api.skipSpell();
  ok('跳过不计入 answered', STATE.spellRound.answered === answeredBefore);
  ok('跳过不写 SRS', calls.recTrue.length === recTrueBefore && calls.recFalse.length === recFalseBefore2);
  flush();
  ok('跳过推进到下一题', STATE.spellRound.cursor === 4);

  // —— 提示流程 ——
  const cur4 = STATE.spellRound.current;
  api.showHint();
  const hinted = els.spellReveal.textContent;
  ok('提示揭示首字母并显示字母数', new RegExp('^' + cur4.en[0] + '_').test(hinted) && /个字母/.test(hinted), hinted);
})();

// ------------------------------------------------------------
// 6. 数据预检 (严格判定前提: en 无首尾/连续空格; 每主题题量充足)
// ------------------------------------------------------------
section('6. 数据预检');
const appData = getAppData(html);
if (!appData || !Array.isArray(appData.cards)) {
  ok('读取 appData.cards', false);
} else {
  const cards = appData.cards;
  const OK = /^[A-Za-z][A-Za-z'\- ]*$/;
  ok('appData.cards 非空', cards.length > 3000, 'count=' + cards.length);

  const badSpace = cards.filter(c => {
    const en = c.en || '';
    return en !== en.trim() || /\s{2,}/.test(en);
  });
  ok('所有 en 无首尾/连续空格', badSpace.length === 0, badSpace.slice(0, 5).map(c => JSON.stringify(c.en)).join(','));

  const pool = cards.filter(c => OK.test(c.en || ''));
  const excluded = cards.length - pool.length;
  ok('可出题池 > 3000', pool.length > 3000, 'pool=' + pool.length);
  ok('被排除卡片占比 < 3%', excluded / cards.length < 0.03, 'excluded=' + excluded);

  // 被排除的都应含括号/斜杠/句点等"非纯词"字符
  const excludedCards = cards.filter(c => !OK.test(c.en || ''));
  const excludedAllPunct = excludedCards.every(c => /[^A-Za-z'\- ]/.test(c.en || ''));
  ok('被排除卡片均含非字母字符', excludedAllPunct);

  // 每主题过滤后仍应 >= 5 张
  const byTopic = {};
  pool.forEach(c => { byTopic[c.topic] = (byTopic[c.topic] || 0) + 1; });
  const topics = (appData.topics || []).map(t => t.topic_id);
  const thin = topics.filter(id => (byTopic[id] || 0) < 5);
  ok('每个主题过滤后 >= 5 张可出题', thin.length === 0, 'thin=' + thin.join(','));

  // 最长 en 长度合理 (用于判断窄屏换行风险)
  const maxLen = Math.max(...pool.map(c => (c.en || '').length));
  ok('最长 en <= 45 字符', maxLen <= 45, 'max=' + maxLen);
}

// ------------------------------------------------------------
console.log('\n========================================');
console.log('  拼写玩法测试: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
console.log('========================================');
process.exit(fail ? 1 : 0);
