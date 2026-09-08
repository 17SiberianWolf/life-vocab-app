/* ============================================================
 * lib/db.js · IndexedDB 抽象层（阶段 5）
 * ============================================================
 * 取代 localStorage 的存储抽象：
 *   - progress       : 每张卡每次 mode 的 SRS 状态
 *   - settings       : 全局 state（含 XP/streak/shadow_pool_meta/settings）
 *   - recScores      : 录音评分快照 (key: `${cardId}:${mode}:${ts}`)
 *   - syncQueue      : 离线写待上传队列
 *   - meta           : 元信息（last_sync_at, user_id）
 *
 * 全部 Promise 化，提供同步 API 给 sync 层
 * 浏览器 + Service Worker 都能用
 * ========================================================== */
(function (root) {
  'use strict';

  const DB_NAME = 'life_vocab_db';
  const DB_VERSION = 1;
  const STORES = ['progress', 'settings', 'recScores', 'syncQueue', 'meta'];

  let _dbPromise = null;
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            if (name === 'progress') {
              store.createIndex('byCard', 'cardId', { unique: false });
              store.createIndex('byMode', 'mode',  { unique: false });
            }
          }
        });
      };
    });
    return _dbPromise;
  }

  function tx(storeName, mode) {
    mode = mode || 'readonly';
    return openDB().then(db => {
      const t = db.transaction(storeName, mode);
      return t.objectStore(storeName);
    });
  }

  function _wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  const DB = {
    async get(store, id) {
      try {
        const s = await tx(store);
        return await _wrap(s.get(id));
      } catch (e) {
        console.warn('[db.get]', store, id, e.message);
        return null;
      }
    },

    async put(store, value) {
      const s = await tx(store, 'readwrite');
      return _wrap(s.put(value));
    },

    async putMany(store, list) {
      const s = await tx(store, 'readwrite');
      return Promise.all(list.map(v => _wrap(s.put(v))));
    },

    async getAll(store) {
      try {
        const s = await tx(store);
        return await _wrap(s.getAll());
      } catch (e) {
        console.warn('[db.getAll]', store, e.message);
        return [];
      }
    },

    async del(store, id) {
      const s = await tx(store, 'readwrite');
      return _wrap(s.delete(id));
    },

    async clear(store) {
      const s = await tx(store, 'readwrite');
      return _wrap(s.clear());
    },

    async count(store) {
      try {
        const s = await tx(store);
        return await _wrap(s.count());
      } catch (e) { return 0; }
    },

    async getMeta(key, fallback) {
      const v = await DB.get('meta', key);
      return v ? v.value : fallback;
    },

    async setMeta(key, value) {
      return DB.put('meta', { id: key, value });
    },

    // 从旧版 localStorage 一次性迁移
    async migrateFromLocalStorage(legacyKeys) {
      const report = { migrated: [], skipped: [] };
      for (const [oldKey, store] of legacyKeys) {
        let raw;
        try { raw = localStorage.getItem(oldKey); }
        catch (e) { report.skipped.push(oldKey); continue; }
        if (!raw) { report.skipped.push(oldKey); continue; }
        try {
          const data = JSON.parse(raw);
          if (store === 'settings') {
            await DB.put('settings', { id: 'state', value: data });
          } else if (store === 'recScores') {
            const ts = Date.now();
            for (const [k, v] of Object.entries(data)) {
              await DB.put('recScores', { id: k, value: v });
            }
          }
          report.migrated.push(oldKey);
        } catch (e) {
          report.skipped.push(oldKey);
        }
      }
      return report;
    }
  };

  root.LVDB = DB;
  if (typeof module !== 'undefined') module.exports = DB;
})(typeof self !== 'undefined' ? self : globalThis);
