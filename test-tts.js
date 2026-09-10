/* ============================================================
 * test-tts.js · 移动端发音 (TTS) 链路专项测试
 * ------------------------------------------------------------
 * 覆盖手机端"听不到声音"的 5 类根因对应的修复逻辑:
 *   ① 无 Web Speech 支持 -> 直接走在线发音
 *   ② 缺 en-GB 语音包 -> 音色宽松匹配 / lang 兜底
 *   ③ 本地 TTS 静默失败 -> 1.2s 后自动切在线发音
 *   ④ Chrome cancel 吞语句 -> 先 cancel 再延迟播
 *   ⑤ iOS 手势解锁 -> touchstart/mousedown/keydown/click 均已注册
 * 运行: node test-tts.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n-- ' + t + ' --'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// 从构建产物中提取 TTS 代码段 (自包含, 仅依赖注入的全局对象)
// ------------------------------------------------------------
const s = html.indexOf('const TTS = {');
const e = html.indexOf('// SRS 算法');
if (s < 0 || e < 0) {
  console.error('[FATAL] 无法在 index.html 中定位 TTS 代码段');
  process.exit(1);
}
const ttsCode = html.slice(s, e);

// ------------------------------------------------------------
// mock 环境
// ------------------------------------------------------------
function makeEnv(opts) {
  opts = opts || {};
  const utterances = [];
  const audios = [];
  const listeners = [];
  // 注: 解锁用的空白 utterance (text===' ') 单独计数, 避免干扰正常播报断言
  const calls = { cancel: 0, speak: 0, unlock: 0, online: 0, resume: 0 };

  class SpeechSynthesisUtterance {
    constructor(text) { this.text = text; utterances.push(this); }
  }
  class AudioEl {
    constructor(src) {
      this.src = src; this.playbackRate = 1; this.played = false;
      this._listeners = {};
      this._err = !!opts.onlineError;   // 模拟加载失败 -> 触发 error 事件
      audios.push(this);
    }
    play() {
      this.played = true; calls.online++;
      if (opts.emitStalled) {
        // 模拟长句缓冲: 先 stalled(无数据), 稍后才真正播完
        setTimeout(() => this._emit('stalled'), 0);
        setTimeout(() => this._emit('playing'), 10);
        setTimeout(() => this._emit('ended'), 40);
      } else {
        // 成功后异步触发 ended 让逐词链式播放推进; 失败则触发 error
        const ev = this._err ? 'error' : 'ended';
        setTimeout(() => this._emit(ev), 0);
      }
      return Promise.resolve();
    }
    pause() {}
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    removeEventListener(type, fn) {
      if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn);
    }
    // 测试辅助: 模拟加载失败触发 error 事件
    _emit(type) { (this._listeners[type] || []).forEach(fn => fn({ type })); }
  }

  const synth = {
    speaking: !!opts.speaking,
    pending: !!opts.pending,
    paused: !!opts.paused,
    onvoiceschanged: null,
    getVoices: () => opts.voices || [],
    cancel() { calls.cancel++; this.speaking = false; this.pending = false; },
    speak(u) {
      if (u.text === ' ') { calls.unlock++; return; }   // 手势解锁的空白语句
      calls.speak++;
      // 模拟"静默失败": 不触发 onstart; 正常情况触发 onstart
      if (!opts.silentFail && u.onstart) setTimeout(() => u.onstart(), 0);
    },
    pause() {},
    resume() { calls.resume++; }
  };

  const window_ = Object.assign({}, opts.withoutSynth ? {} : {
    speechSynthesis: synth,
    SpeechSynthesisUtterance
  });

  const document_ = {
    addEventListener: (type, fn) => listeners.push(type),
    removeEventListener: () => {},
    createElement: () => ({ classList: { add() {}, remove() {} }, style: {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {} }
  };

  const navigator_ = {
    userAgent: opts.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: opts.platform || 'Win32',
    maxTouchPoints: opts.maxTouchPoints || 0
  };

  const STATE = { settings: Object.assign({ locale: 'en-GB', rate: 1, ttsMode: 'auto' }, opts.settings), cards: [] };
  const hints = [];
  const ttsHint = (msg, kind) => hints.push({ msg, kind });

  const api = new Function(
    'window', 'document', 'navigator', 'Audio', 'STATE', 'console', 'alert', 'SpeechSynthesisUtterance', 'ttsHint',
    ttsCode + '\nreturn { TTS, pickVoice, loadVoices, unlockTTS, playOnline, speakWeb, doSpeak, speakTTS, speak, runTTSDiag, IS_IOS };'
  )(window_, document_, navigator_, AudioEl, STATE, console, () => {}, SpeechSynthesisUtterance, ttsHint);

  // 真实播报语句 (排除手势解锁用的空白 utterance / 静音 wav)
  const realUtterances = () => utterances.filter(u => u.text !== ' ');
  const realAudios = () => audios.filter(a => String(a.src).indexOf('data:') !== 0);

  return { api, utterances, realUtterances, audios, realAudios, listeners, calls, synth, STATE, window: window_, hints };
}

(async function run() {
  console.log('=== 移动端发音链路专项测试 ===');

  section('1. 无 Web Speech 支持 -> 在线兜底');
  {
    const env = makeEnv({ withoutSynth: true });
    ok('TTS.ok 判定为不可用', env.api.TTS.ok === false);
    env.api.speakTTS('hello', false);
    ok('直接调用在线发音', env.realAudios().length === 1, 'audios=' + env.realAudios().length);
    ok('在线 URL 走同源 /tts 代理 (绕开运营商封锁)', env.realAudios()[0] && env.realAudios()[0].src.indexOf('/tts?audio=') >= 0,
       env.realAudios()[0] && env.realAudios()[0].src);
  }

  section('2. 音色宽松匹配 (国行机缺 en-GB 语音包)');
  {
    const env = makeEnv({ voices: [{ name: 'Samantha', lang: 'en-US' }] });
    env.api.loadVoices();
    const v = env.api.pickVoice('en-GB');
    ok('en-GB 缺包时回退到 en-US', v && v.lang === 'en-US', v && v.lang);
  }
  {
    const env = makeEnv({ voices: [{ name: 'Ting', lang: 'zh-CN' }, { name: 'Alex', lang: 'en-US' }] });
    env.api.loadVoices();
    ok('中英混合音色表能挑出英语音色', env.api.pickVoice('en-GB').lang === 'en-US');
  }
  {
    const env = makeEnv({ voices: [] });
    env.api.loadVoices();
    ok('无音色时返回 null (交给系统默认)', env.api.pickVoice('en-GB') === null);
  }
  {
    const env = makeEnv({ voices: [{ name: 'Ting', lang: 'zh-CN' }] });
    env.api.loadVoices();
    const v = env.api.pickVoice('en-GB');
    ok('只有中文音色时仍能兜底返回, 不崩溃', v === null || typeof v.lang === 'string');
  }

  section('3. 无音色时 lang 兜底');
  {
    const env = makeEnv({ voices: [] });
    env.api.speakTTS('hello', false);
    const u = env.realUtterances()[0];
    ok('utterance.lang 保留用户语种设置', u && u.lang === 'en-GB', u && u.lang);
    ok('无音色时不设置 voice, 交给系统默认', u && !u.voice);
  }
  {
    const env = makeEnv({ voices: [], settings: { locale: 'en-US' } });
    env.api.speakTTS('hello', true);
    const u = env.realUtterances()[0];
    ok('慢速时 rate < 1', u && u.rate < 1, u && u.rate);
  }
  {
    const env = makeEnv({ voices: [{ name: 'Samantha', lang: 'en-US' }], settings: { locale: 'en-GB' } });
    env.api.loadVoices();
    env.api.speakTTS('hello', false);
    const u = env.realUtterances()[0];
    ok('有可用音色时 voice 与 lang 保持一致', u && u.voice && u.lang === u.voice.lang, u && u.lang);
  }

  section('4. 本地 TTS 静默失败 -> 1.2s 后自动切在线');
  {
    const env = makeEnv({ voices: [], silentFail: true });
    env.api.speakTTS('hello', false);
    ok('首次仍先尝试本地语音', env.calls.speak === 1, 'speak=' + env.calls.speak);
    await sleep(1400);
    ok('1.2s 无 onstart 后切换在线发音', env.realAudios().length === 1, 'audios=' + env.realAudios().length);
    ok('标记 TTS.broken (后续不再空等)', env.api.TTS.broken === true);
    env.api.speakTTS('world', false);
    ok('后续直接走在线, 不再调用本地 speak', env.calls.speak === 1, 'speak=' + env.calls.speak);
  }

  section('5. 发音方式开关');
  {
    const env = makeEnv({ voices: [{ name: 'Samantha', lang: 'en-US' }], settings: { ttsMode: 'online' } });
    env.api.speakTTS('hello', false);
    ok('仅在线: 不调用本地语音', env.calls.speak === 0);
    ok('仅在线: 直接播放音频', env.realAudios().length === 1);
  }
  {
    const env = makeEnv({ voices: [{ name: 'Samantha', lang: 'en-US' }], settings: { ttsMode: 'local' }, silentFail: true });
    env.api.speakTTS('hello', false);
    await sleep(1400);
    ok('仅本地: 静默失败也不切在线', env.realAudios().length === 0, 'audios=' + env.realAudios().length);
  }

  section('6. Chrome/Android: cancel 后延迟播 (避免语句被吞)');
  {
    const env = makeEnv({ voices: [], speaking: true });
    env.api.speakTTS('hello', false);
    ok('正在播报时先 cancel', env.calls.cancel === 1);
    ok('cancel 后不立即 speak (让出 tick)', env.calls.speak === 0, 'speak=' + env.calls.speak);
    await sleep(160);
    ok('延迟后补播新语句', env.calls.speak === 1, 'speak=' + env.calls.speak);
  }
  {
    const env = makeEnv({ voices: [], paused: true });
    env.api.speakTTS('hello', false);
    ok('paused 状态先 resume', env.calls.resume >= 1);
  }

  section('7. iOS 手势解锁监听');
  {
    const env = makeEnv({ voices: [] });
    ['touchstart', 'mousedown', 'keydown', 'click'].forEach(ev => {
      ok('已注册 ' + ev + ' 解锁监听', env.listeners.indexOf(ev) >= 0);
    });
    const env2 = makeEnv({ voices: [], ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone' });
    ok('iOS UA 正确识别', env2.api.IS_IOS === true);
  }

  section('8. 在线发音语种映射');
  {
    const env = makeEnv({ withoutSynth: true, settings: { locale: 'en-US' } });
    env.api.speakTTS('hello', false);
    ok('美式 -> type=2', env.realAudios()[0].src.indexOf('type=2') >= 0, env.realAudios()[0].src);
    const env2 = makeEnv({ withoutSynth: true, settings: { locale: 'en-GB' } });
    env2.api.speakTTS('hello', false);
    ok('英式 -> type=1', env2.realAudios()[0].src.indexOf('type=1') >= 0, env2.realAudios()[0].src);
  }

  section('9. 空文本安全');
  {
    const env = makeEnv({ voices: [] });
    env.api.speakTTS('', false);
    env.api.speakTTS(null, false);
    ok('空文本不触发任何播放', env.calls.speak === 0 && env.realAudios().length === 0);
  }

  section('10. 例句整句自然朗读 (不再逐词拆读)');
  {
    const env = makeEnv({ withoutSynth: true });
    env.api.speakTTS('Please hand me the knife.', false);
    ok('例句只发一次 /tts 请求(整句合成)', env.realAudios().length === 1, 'audios=' + env.realAudios().length);
    const src = env.realAudios()[0] && env.realAudios()[0].src;
    ok('URL 含整句原文(带空格, 未拆分)', src && src.indexOf('audio=Please%20hand%20me%20the%20knife.') >= 0, src);
    ok('整句也走同源 /tts 代理', src && src.indexOf('/tts?audio=') >= 0);
    ok('整句不逐词(无多个 audio 请求)', env.realAudios().length === 1);
  }
  {
    const env = makeEnv({ withoutSynth: true });
    env.api.speakTTS("I can't find my wallet.", false);
    const src = env.realAudios()[0] && env.realAudios()[0].src;
    ok('含撇号句子整句合成(不丢词)', env.realAudios().length === 1 && src && src.indexOf("audio=I%20can't%20find%20my%20wallet.") >= 0, src);
  }

  section('11. 整句在线失败退化为逐词, 不卡死 + 可恢复');
  {
    const env = makeEnv({ withoutSynth: true, onlineError: true, settings: { ttsMode: 'online' } });
    env.api.speakTTS('computer', false);   // 单 token 失败
    await sleep(80);
    ok('单 token 失败后已推进', env.realAudios().length >= 1);
    // 再发一句, 验证失败后链路仍可继续播放(说明未卡死)
    env.api.speakTTS('hello world', false);
    await sleep(80);
    ok('失败后可继续播放新文本 (不卡死)', env.realAudios().length >= 2, 'audios=' + env.realAudios().length);
  }
  {
    const env = makeEnv({ withoutSynth: true, onlineError: true });
    env.api.speakTTS('This sentence will partly fail.', false);
    await sleep(150);
    ok('整句在线失败 -> 退化逐词保底出声, 不卡死', env.realAudios().length >= 1);
    ok('退化路径每词仍走同源 /tts 代理', env.realAudios().every(a => a.src.indexOf('/tts?audio=') >= 0));
  }

  section('12. 长句缓冲期不误报失败 (stalled 不再触发逐词回退)');
  {
    const env = makeEnv({ withoutSynth: true, emitStalled: true });
    env.api.speakTTS('Although it was raining heavily, she still decided to walk to the office.', false);
    await sleep(120);
    ok('例句仅一次整句请求 (未误触发逐词)', env.realAudios().length === 1, 'audios=' + env.realAudios().length);
    ok('缓冲期 stalled 不再误提示"整句在线发音失败"',
       env.hints.filter(h => String(h.msg).indexOf('整句在线发音失败') >= 0).length === 0,
       JSON.stringify(env.hints));
  }

  console.log('\n=== 通过 ' + pass + ' 项, 失败 ' + fail + ' 项 ===');
  process.exit(fail === 0 ? 0 : 1);
})();
