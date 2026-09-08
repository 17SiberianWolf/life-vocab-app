/* ============================================================
 * lib/sync.js · Supabase 同步层 (阶段 5)
 * ============================================================
 * - 无 Supabase 配置时降级到纯本地（IndexedDB）
 * - 在线写 → 异步推云；离线写 → 入队 + 联网时自动 flush
 * - 冲突策略：last-write-wins (基于 updated_at)
 * - RLS 保证：即使 anon key 公开也只能读写自己的行
 * ========================================================== */
(function (root) {
  'use strict';

  if (typeof root.LVDB === 'undefined') {
    console.warn('[sync] LVDB not found, sync disabled');
    return;
  }
  const DB = root.LVDB;

  // ---------- 状态 ----------
  let _client = null;
  let _user = null;
  let _online = (typeof navigator !== 'undefined' ? navigator.onLine : true);
  let _authListeners = [];
  let _statusListeners = [];
  let _cfg = null;
  let _flushTimer = null;

  // ---------- 事件总线 ----------
  const _bus = {
    on(ev, cb) {
      (this._listeners[ev] = this._listeners[ev] || []).push(cb);
    },
    emit(ev, payload) {
      const ls = this._listeners[ev] || [];
      ls.slice().forEach(cb => { try { cb(payload); } catch (e) { console.warn(e); } });
    },
    _listeners: {}
  };

  function _emitAuth(user) {
    _authListeners.slice().forEach(cb => { try { cb(user); } catch (e) {} });
  }
  function _emitStatus(status) {
    _statusListeners.slice().forEach(cb => { try { cb(status); } catch (e) {} });
  }

  // ---------- 初始化 ----------
  function init(config) {
    _cfg = config || {};
    const url = (_cfg.url || '').trim();
    const key = (_cfg.anon_key || '').trim();

    // 占位 URL 或未配置 → 本地模式
    if (!url || !key || url.indexOf('YOUR-') === 0) {
      console.info('[sync] 未配置 Supabase,本地模式');
      _client = null;
      _emitStatus(getStatus());
      return { mode: 'local' };
    }
    // supabase-js SDK 未加载
    if (typeof root.supabase === 'undefined' || typeof root.supabase.createClient !== 'function') {
      console.warn('[sync] supabase-js 未加载,降级本地模式');
      _client = null;
      _emitStatus(getStatus());
      return { mode: 'local', reason: 'sdk-missing' };
    }
    try {
      _client = root.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'lv_auth' }
      });
      _client.auth.onAuthStateChange((_event, session) => {
        _user = (session && session.user) || null;
        _emitAuth(_user);
        _bus.emit('auth:changed', _user);
      });
      console.info('[sync] Supabase 客户端已就绪');
      _emitStatus(getStatus());
      return { mode: 'cloud' };
    } catch (e) {
      console.error('[sync.init] 创建客户端失败:', e);
      _client = null;
      _emitStatus(getStatus());
      return { mode: 'local', reason: e.message };
    }
  }

  // ---------- 在线/离线 ----------
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      _online = true;
      _emitStatus(getStatus());
      flushQueue().catch(() => {});
    });
    window.addEventListener('offline', () => {
      _online = false;
      _emitStatus(getStatus());
    });
  }

  // ---------- 认证 ----------
  async function signIn(email, password) {
    if (!_client) throw new Error('本地模式:请先配置 Supabase');
    const { data, error } = await _client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _user = data.user;
    await DB.setMeta('user_id', _user.id);
    _emitAuth(_user);
    // 拉到本地 + flush 队列
    await pullAll();
    await flushQueue();
    return _user;
  }

  async function signUp(email, password) {
    if (!_client) throw new Error('本地模式:请先配置 Supabase');
    const { data, error } = await _client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      _user = data.user;
      await DB.setMeta('user_id', _user.id);
      _emitAuth(_user);
      await pullAll();
      await flushQueue();
    }
    return data.user;
  }

  async function signOut() {
    if (!_client) return;
    await _client.auth.signOut();
    _user = null;
    await DB.del('meta', 'user_id');
    _emitAuth(null);
  }

  async function restoreSession() {
    if (!_client) return null;
    try {
      const { data, error } = await _client.auth.getSession();
      if (error) return null;
      if (data && data.session && data.session.user) {
        _user = data.session.user;
        await DB.setMeta('user_id', _user.id);
        _emitAuth(_user);
        return _user;
      }
    } catch (e) { console.warn('[restoreSession]', e); }
    return null;
  }

  // ---------- 推送 ----------
  function _row(row) {
    return {
      user_id: _user.id,
      card_id: row.card_id,
      mode: row.mode,
      reps: row.reps || 0,
      correct: row.correct || 0,
      ease: row.ease || 2.5,
      last_review: row.last_review || null,
      next_due: row.next_due || null,
      shadow_pool: row.shadow_pool || false,
      rec_score: row.rec_score || null,
      rec_attempts: row.rec_attempts || 0
    };
  }

  async function pushProgress(list) {
    if (!list || !list.length) return { uploaded: 0 };
    if (!_client || !_user) {
      // 离线入队
      return _enqueueAll('progress', list);
    }
    try {
      const rows = list.map(r => ({ ..._row(r), updated_at: new Date().toISOString() }));
      // 分批,避免一次推送过大
      const batch = 100;
      let uploaded = 0;
      for (let i = 0; i < rows.length; i += batch) {
        const slice = rows.slice(i, i + batch);
        const { data, error } = await _client.from('cards_progress').upsert(slice, {
          onConflict: 'user_id,card_id,mode'
        });
        if (error) throw error;
        uploaded += slice.length;
      }
      _bus.emit('sync:pushed', { count: uploaded });
      return { uploaded };
    } catch (e) {
      console.warn('[pushProgress] fail', e.message);
      return _enqueueAll('progress', list);
    }
  }

  async function pushSettings(state) {
    if (!_client || !_user) return _enqueueAll('settings', [state]);
    try {
      const row = {
        user_id: _user.id,
        xp: state.xp || 0,
        streak: state.streak || 0,
        last_active_date: state.last_active_date || null,
        shadow_pool_meta: state.shadow_pool_meta || {},
        settings: state.settings || {}
      };
      const { error } = await _client.from('user_settings').upsert(row);
      if (error) throw error;
      _bus.emit('sync:pushed-settings');
      return { uploaded: 1 };
    } catch (e) {
      return _enqueueAll('settings', [state]);
    }
  }

  async function pushRecScore(rec) {
    if (!_client || !_user) return _enqueueAll('recScores', [rec]);
    try {
      const row = {
        user_id: _user.id,
        card_id: rec.card_id,
        mode: rec.mode,
        score: rec.score,
        transcript: rec.transcript || null,
        raw: rec.raw || null
      };
      const { error } = await _client.from('rec_scores').insert(row);
      if (error) throw error;
      return { uploaded: 1 };
    } catch (e) {
      return _enqueueAll('recScores', [rec]);
    }
  }

  function _enqueueAll(store, list) {
    for (const data of list) {
      const w = { type: 'upsert', store, data, queued_at: Date.now() };
      DB.put('syncQueue', w).catch(() => {});
    }
    _bus.emit('sync:queued', { store, count: list.length });
    return { queued: list.length };
  }

  // ---------- 拉取 ----------
  async function pullAll() {
    if (!_client || !_user) return { mode: 'local' };
    const uid = _user.id;
    try {
      const [pRes, sRes, rRes] = await Promise.all([
        _client.from('cards_progress').select('*').eq('user_id', uid),
        _client.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
        _client.from('rec_scores').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500)
      ]);
      if (pRes.error) throw pRes.error;
      // 写入本地
      const rows = pRes.data || [];
      for (const row of rows) {
        const id = `${uid}:${row.card_id}:${row.mode}`;
        await DB.put('progress', { id, ...row, _cloud_updated: row.updated_at });
      }
      if (sRes.data) {
        await DB.put('settings', { id: 'state', value: sRes.data, _cloud_updated: sRes.data.updated_at });
      }
      const recs = rRes.data || [];
      for (const r of recs) {
        const id = `${uid}:${r.card_id}:${r.created_at}`;
        await DB.put('recScores', { id, ...r });
      }
      await DB.setMeta('last_sync_at', Date.now());
      _bus.emit('sync:pulled', { progress: rows.length, settings: !!sRes.data, recScores: recs.length });
      return { ok: true, progress: rows.length, settings: !!sRes.data, recScores: recs.length };
    } catch (e) {
      console.error('[pullAll] fail', e);
      _bus.emit('sync:pull-failed', e.message);
      return { error: e.message };
    }
  }

  // ---------- 离线队列 ----------
  async function flushQueue() {
    if (!_client || !_user) return { flushed: 0 };
    const items = await DB.getAll('syncQueue');
    if (!items.length) return { flushed: 0 };

    const byStore = {};
    for (const w of items) {
      (byStore[w.store] = byStore[w.store] || []).push(w.data);
    }

    let flushed = 0, failed = 0;
    for (const [store, list] of Object.entries(byStore)) {
      try {
        if (store === 'progress') {
          const r = await pushProgress(list);
          flushed += r.uploaded || 0;
        } else if (store === 'settings') {
          const r = await pushSettings(list[0]);
          flushed += r.uploaded || 0;
        } else if (store === 'recScores') {
          for (const r of list) {
            const x = await pushRecScore(r);
            flushed += x.uploaded || 0;
          }
        }
      } catch (e) {
        failed += list.length;
      }
    }
    // 清掉成功推送的
    for (const w of items) {
      if (w.id != null) await DB.del('syncQueue', w.id);
    }
    if (failed > 0) _bus.emit('sync:partial', { flushed, failed });
    else _bus.emit('sync:flushed', { count: flushed });
    return { flushed, failed };
  }

  function flushSoon() {
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(() => flushQueue().catch(() => {}), 500);
  }

  // ---------- 冲突合并 ----------
  function mergeRow(local, cloud) {
    if (!cloud) return local;
    if (!local) return cloud;
    const lt = local._cloud_updated ? new Date(local._cloud_updated).getTime()
              : (local.updated_at ? new Date(local.updated_at).getTime() : 0);
    const ct = cloud._cloud_updated ? new Date(cloud._cloud_updated).getTime()
              : (cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0);
    if (ct > lt) return { ...local, ...cloud };   // 远端更新
    if (lt > ct) return local;                     // 本地更新
    return local;                                  // 同时间本地优先
  }

  // ---------- 状态查询 ----------
  function getStatus() {
    return {
      mode: _client ? 'cloud' : 'local',
      online: _online,
      user: _user,
      hasSession: !!_user
    };
  }

  function onAuthChange(cb) { _authListeners.push(cb); }
  function onStatusChange(cb) { _statusListeners.push(cb); }
  function on(event, cb)    { _bus.on(event, cb); }
  function isCloud() { return !!_client; }

  // ---------- 暴露 ----------
  root.Sync = {
    init, signIn, signUp, signOut, restoreSession,
    pushProgress, pushSettings, pushRecScore,
    pullAll, flushQueue, flushSoon, mergeRow,
    getStatus, isCloud,
    onAuthChange, onStatusChange, on,
    _client: () => _client
  };

})(typeof self !== 'undefined' ? self : globalThis);
