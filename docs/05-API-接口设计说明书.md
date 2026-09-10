# 05 · 接口设计说明书

| 项 | 内容 |
|---|---|
| 文档编号 | LV-API-v1.0 |
| 版本 | 1.0 |
| 协议 | HTTPS / REST（PostgREST 规范）+ Supabase Auth |
| 机器可读契约 | [openapi.yaml](./openapi.yaml)（OpenAPI 3.0.3） |

---

## 1. 接口总览

本系统**没有自建后端**，所有服务端接口由 Supabase 自动提供：

| 类别 | Base Path | 提供方 |
|---|---|---|
| 认证 | `/auth/v1/*` | Supabase GoTrue |
| 数据 | `/rest/v1/*` | PostgREST（自动映射 Postgres 表） |

```
Base URL: https://sbtvdsxyvkyunydpngyb.supabase.co
```

### 1.1 认证方式

所有请求必须携带：

| Header | 值 |
|---|---|
| `apikey` | `<ANON_KEY>`（取自 `build-config.json` → `supabase.anon_key`） |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <access_token>`（登录后；未登录时用 anon key 亦可访问公开表，但被 RLS 限制） |

> `anon_key` 是**可公开**的发布密钥。数据隔离完全依赖 RLS 策略，不依赖密钥保密。

---

## 2. 认证接口

### 2.1 注册

```http
POST /auth/v1/signup
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `email` | string | ✅ | |
| `password` | string | ✅ | |

**响应 200**：

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

> 若项目开启邮箱确认，注册后需点确认邮件才能拿到 session。

### 2.2 登录

```http
POST /auth/v1/token?grant_type=password
```

请求体同上。SDK 封装为 `auth.signInWithPassword({ email, password })`。

### 2.3 获取当前会话

```http
GET /auth/v1/user
Authorization: Bearer <access_token>
```

### 2.4 登出

```http
POST /auth/v1/logout
```

### 2.5 前端封装

```js
Sync.signIn(email, password)       // → 登录 + pullAll() + flushQueue()
Sync.signUp(email, password)       // → 注册 + pullAll() + flushQueue()
Sync.signOut()                     // → 登出 + 清除本地 user_id
Sync.restoreSession()              // → 刷新页面后恢复会话
Sync.onAuthChange(cb)              // → 订阅认证状态变化
```

---

## 3. 数据接口

### 3.1 拉取全部进度

```http
GET /rest/v1/cards_progress?user_id=eq.{uid}&select=*
```

| 参数 | 说明 |
|---|---|
| `user_id=eq.{uid}` | PostgREST 过滤语法，等价于 `WHERE user_id = uid` |

**响应 200**：`cards_progress[]`

### 3.2 拉取用户设置

```http
GET /rest/v1/user_settings?user_id=eq.{uid}&select=*
```

前端使用 `maybeSingle()`，无记录时返回 `null`（不报错）。

### 3.3 拉取跟读评分

```http
GET /rest/v1/rec_scores?user_id=eq.{uid}&select=*&order=created_at.desc&limit=500
```

### 3.4 上传进度（Upsert）

```http
POST /rest/v1/cards_progress
Prefer: resolution=merge-duplicates,return=minimal
```

SDK 调用：

```js
supabase.from('cards_progress')
  .upsert(rows, { onConflict: 'user_id,card_id,mode' })
```

**批量策略**：前端按 **100 条/批**分片推送，避免单次请求体过大。

**请求体示例**：

```json
[
  {
    "user_id": "3f2a...-uuid",
    "card_id": 1234,
    "mode": "match",
    "reps": 3,
    "correct": 5,
    "ease": 2.5,
    "last_review": "2026-09-10T02:11:00.000Z",
    "next_due": "2026-09-14T02:11:00.000Z",
    "shadow_pool": false,
    "rec_score": null,
    "rec_attempts": 0,
    "updated_at": "2026-09-10T02:11:00.000Z"
  }
]
```

### 3.5 上传设置（Upsert）

```http
POST /rest/v1/user_settings
Prefer: resolution=merge-duplicates
```

```json
{
  "user_id": "3f2a...-uuid",
  "xp": 1280,
  "streak": 7,
  "last_active_date": "2026-09-10",
  "shadow_pool_meta": { "items": [] },
  "settings": { "locale": "en-GB", "rate": 1.0, "daily_new": 10 }
}
```

### 3.6 新增跟读评分

```http
POST /rest/v1/rec_scores
```

```json
{
  "user_id": "3f2a...-uuid",
  "card_id": 1234,
  "mode": "word",
  "score": 87.5,
  "transcript": "the quick brown fox",
  "raw": { "tgt": ["the"], "got": ["the"], "perWord": [] }
}
```

> 评分记录**只增不改**，用于趋势分析。

---

## 4. 错误码

| HTTP | PostgREST / Auth 语义 | 前端处理 |
|---|---|---|
| 200 / 201 | 成功 | — |
| 400 | 请求语法错误 | 记录日志，入队重试 |
| 401 | JWT 无效或过期 | SDK 自动刷新 token；失败则登出 |
| 403 | RLS 策略拒绝 | 视为权限错误，提示重新登录 |
| 409 | 唯一约束冲突 | upsert 场景不应出现；入队重试 |
| 5xx | 服务端错误 | 入队，等待联网重试 |

**统一降级策略**：

```
任何网络/服务端错误
  → 写入 IndexedDB syncQueue
  → 监听 window 'online' 事件
  → flushQueue() 自动补传
  → 用户全程无感（本地数据已写入，功能不中断）
```

---

## 5. 前端模块内部接口

### 5.1 LVDB（`lib/db.js`）

| 方法 | 签名 | 说明 |
|---|---|---|
| `get` | `(store, id) → Promise<obj\|null>` | 失败返回 null，不抛异常 |
| `put` | `(store, value) → Promise` | 写入/覆盖（按 id） |
| `putMany` | `(store, list) → Promise` | 批量写入 |
| `getAll` | `(store) → Promise<array>` | 失败返回 `[]` |
| `del` | `(store, id) → Promise` | 删除 |
| `clear` | `(store) → Promise` | 清空 |
| `count` | `(store) → Promise<number>` | 计数，失败返回 0 |
| `getMeta` | `(key, fallback) → Promise<any>` | 读元信息 |
| `setMeta` | `(key, value) → Promise` | 写元信息 |
| `migrateFromLocalStorage` | `(pairs) → Promise<{migrated, skipped}>` | 旧版迁移 |

### 5.2 Sync（`lib/sync.js`）

| 方法 | 签名 | 说明 |
|---|---|---|
| `init` | `(config) → {mode, reason?}` | 初始化，返回 `cloud` / `local` |
| `signIn` / `signUp` / `signOut` | `(email, password)` | 认证 |
| `restoreSession` | `() → user\|null` | 恢复会话 |
| `pushProgress` | `(list) → {uploaded} \| {queued}` | 推进度 |
| `pushSettings` | `(state) → {uploaded} \| {queued}` | 推设置 |
| `pushRecScore` | `(rec) → {uploaded} \| {queued}` | 推评分 |
| `pullAll` | `() → {progress, settings, recScores}` | 全量拉取 |
| `flushQueue` | `() → {flushed, failed}` | 补传离线队列 |
| `flushSoon` | `()` | 防抖 500ms 后补传 |
| `mergeRow` | `(local, cloud) → row` | 冲突合并 |
| `getStatus` | `() → {mode, online, user, hasSession}` | 状态快照 |
| `on` / `onAuthChange` / `onStatusChange` | `(event, cb)` | 事件订阅 |

**事件**：

| 事件 | payload | 触发时机 |
|---|---|---|
| `auth:changed` | user \| null | 登录/登出/会话恢复 |
| `sync:pushed` | `{count}` | 进度推送成功 |
| `sync:pushed-settings` | — | 设置推送成功 |
| `sync:pulled` | `{progress, settings, recScores}` | 拉取完成 |
| `sync:queued` | `{store, count}` | 写入离线队列 |
| `sync:flushed` | `{count}` | 队列补传完成 |
| `sync:partial` | `{flushed, failed}` | 部分补传失败 |
| `sync:pull-failed` | message | 拉取失败 |

### 5.3 AuthUI（`lib/auth-ui.js`）

| 方法 | 说明 |
|---|---|
| `AuthUI.init()` | 渲染顶栏账号按钮、绑定事件 |
| `AuthUI.showLogin()` | 弹出登录/注册 modal |
| `AuthUI.signOut()` | 退出登录 |
| `AuthUI.toast(msg, kind)` | 短暂提示（2.4s） |
| `AuthUI.renderAccountBtn()` | 重渲染顶栏状态 |

---

## 6. 浏览器原生接口依赖

| 接口 | 用途 | 降级策略 |
|---|---|---|
| `window.speechSynthesis` | TTS 朗读 | 不存在时静默跳过 |
| `webkitSpeechRecognition` | 跟读转写 | 不支持时评分功能不可用 |
| `navigator.mediaDevices.getUserMedia` | 麦克风录音 | 拒绝授权时提示 |
| `MediaRecorder` | 录音编码 | 同上 |
| `indexedDB` | 本地存储 | 不可用时 LVDB 返回空值 |
| `navigator.onLine` + `online/offline` 事件 | 网络状态 | 始终假定在线 |
| `beforeinstallprompt` | PWA 安装 | 不触发则不显示横幅 |

---

## 7. 接口变更管理

| 变更类型 | 影响 | 处理方式 |
|---|---|---|
| 新增表字段 | 旧客户端不写该字段，默认为空 | 向后兼容，无需版本号 |
| 删除/重命名字段 | 旧客户端写入失败 | 需发版 + bump `CACHE_NAME` + 提示用户刷新 |
| 修改 RLS 策略 | 影响所有客户端 | 先在测试项目验证再上线生产 |
| 更换 Supabase 项目 | 全部用户需重新注册 | 需数据迁移方案 |

> 当前无 API 版本号机制（PostgREST 路径固定 `/rest/v1`）。若未来需要破坏性变更，应引入自定义 Header（如 `X-Client-Version`）由服务端分流，或新建表并双写过渡。
