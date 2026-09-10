# 安全设计说明书

| 项 | 内容 |
|---|---|
| 项目 | 单词碰碰乐 life-vocab-app |
| 版本 | v1.0.0 |
| 密级 | 内部公开 |
| 安全模型 | 前端零信任 + RLS 行级隔离 |

---

## 1. 安全定位与威胁模型

### 1.1 系统性质

本项目是**纯前端单页应用 + BaaS 后端**（Supabase）。核心安全事实：

> ⚠️ **前端代码中不存在任何秘密。** 所有 JS、API 地址、匿名密钥都对任何访问者完全可见。

这不是缺陷，而是浏览器应用的固有属性。因此本系统的安全边界**不依赖"密钥保密"，而依赖"服务端授权策略"**。

### 1.2 资产清单与敏感度

| 资产 | 敏感度 | 说明 |
|---|---|---|
| 词库数据（cards.json / topics.json） | 🟢 公开 | 非原创核心资产，无保密需求 |
| 用户邮箱 | 🟡 中 | 个人身份信息（PII） |
| 密码哈希 | 🔴 高 | 由 Supabase Auth 托管，**本应用永不接触明文密码** |
| 学习进度（cards_progress） | 🟡 中 | 个人数据，泄露影响小但属于隐私 |
| 跟读录音/识别文本 | 🟡 中 | 语音不上传，仅识别文本落库 |
| Supabase anon key | 🟢 公开 | 设计为可公开，安全靠 RLS |
| Supabase service_role key | 🔴 极高 | **本项目不使用，也严禁写入前端** |

### 1.3 威胁建模（STRIDE）

| 威胁 | 场景 | 风险 | 缓解措施 | 状态 |
|---|---|---|---|---|
| **S**poofing 冒充 | 攻击者伪造 user_id 读取他人进度 | 高 | RLS `auth.uid() = user_id` + JWT 服务端校验 | ✅ 已缓解 |
| **T**ampering 篡改 | 攻击者用 anon key 直接改他人数据 | 高 | RLS `with check` 约束写入 | ✅ 已缓解 |
| **R**epudiation 否认 | 用户否认操作 | 低 | Supabase Auth 记录登录事件 | 🟢 可接受 |
| **I**nformation Disclosure 信息泄露 | ① anon key 暴露 ② 词库被爬 ③ XSS 窃取 token | 中 | ① 设计上可公开 ② 词库非机密 ③ `escapeHtml` 转义 | ✅ 已缓解 |
| **D**enial of Service 拒绝服务 | 恶意刷 API 耗尽额度 | 中 | Supabase 自带速率限制；单用户场景影响有限 | 🟡 残留风险 |
| **E**levation of Privilege 提权 | 绕过 RLS 获取全表 | 高 | 三张表均启用 RLS + 策略全覆盖 | ✅ 已缓解 |

---

## 2. 认证与授权

### 2.1 认证方式

- **方式**：邮箱 + 密码，由 **Supabase Auth**（GoTrue）托管
- **凭证**：登录成功后返回 **JWT（access_token + refresh_token）**，由 `@supabase/supabase-js` 自动管理
- **存储**：token 存于浏览器 `localStorage`（Supabase SDK 默认行为）
- **有效期**：access_token 默认 1 小时，SDK 自动用 refresh_token 续期

> **关键**：应用代码**从不接触明文密码**，也**不自行实现任何密码学逻辑**。所有凭证处理交由 Supabase SDK。

### 2.2 授权模型：RLS 是唯一安全边界

```sql
-- supabase/SCHEMA.sql（三张表相同模式）
alter table cards_progress enable row level security;

create policy "own rows cards_progress"
  on cards_progress for all
  using (auth.uid() = user_id)        -- SELECT/UPDATE/DELETE 可见范围
  with check (auth.uid() = user_id);  -- INSERT/UPDATE 写入约束
```

**工作原理**：
1. 前端每个请求携带 JWT
2. Supabase 用 JWT 解出 `auth.uid()`
3. Postgres 在**执行 SQL 前**自动注入 `auth.uid() = user_id` 过滤条件
4. 即使攻击者拿到 anon key 直接构造请求，也只能读写自己 `user_id` 的行

**`using` 与 `with check` 的区别（缺一不可）**：
- `using`：决定**能看到/修改哪些已有行**（读、改、删）
- `with check`：决定**能写入什么样的新行**（防止把数据写给别人或篡改 user_id）

### 2.3 「未登录」状态

- 未登录时 `auth.uid()` 返回 `NULL`，所有 RLS 策略不匹配 → **云端读写全部被拒**
- 应用降级为**纯本地模式**（IndexedDB），功能完整但不同步
- 这是设计意图，不是错误

---

## 3. 数据安全

### 3.1 传输安全

| 链路 | 保护 |
|---|---|
| 浏览器 ↔ Cloudflare Pages | HTTPS（Cloudflare 强制 TLS） |
| 浏览器 ↔ Supabase | HTTPS（Supabase 强制 TLS） |
| Service Worker 缓存 | 同源缓存，不外泄 |

### 3.2 静态数据

- **云端**：Postgres 静态加密（Supabase 平台提供）
- **本地**：IndexedDB **未加密**（浏览器同源策略保护，非加密存储）
  - **风险评估**：🟢 可接受。本地数据仅学习进度，且需物理访问设备 + 同源才能读取
  - 若未来存敏感内容，需引入 WebCrypto 加密

### 3.3 数据最小化

- 只收集**邮箱**一个身份字段，不收集姓名/电话/位置
- 跟读功能**只上传识别文本，不上传录音文件**
- 无第三方分析/埋点/广告 SDK

---

## 4. 应用安全

### 4.1 XSS 防护

**风险**：应用大量使用 `innerHTML` 渲染用户/数据内容（35 处）。

**措施**：所有插入 HTML 的动态数据均经 `escapeHtml()` 转义：

```javascript
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

**已覆盖场景**：主题名、卡片例句、用户邮箱显示、跟读识别文本等。

**残余风险**：
- ⚠️ 词库数据来自本地 JSON（可信来源），但若未来支持**用户自定义词条**，该输入必须经过 `escapeHtml`
- ⚠️ 若未来支持导入第三方词库，需增加**导入数据的清洗与校验**

### 4.2 注入防护

| 类型 | 防护 |
|---|---|
| SQL 注入 | 全部通过 supabase-js 的查询构造器（参数化），无手写 SQL 拼接 |
| HTML 注入 | `escapeHtml()` |
| JSON 注入 | `JSON.parse` + try/catch；词库为构建时内联的可信数据 |

### 4.3 依赖安全

| 依赖 | 引入方式 | 风险 |
|---|---|---|
| `@supabase/supabase-js` | CDN（`cdn.jsdelivr.net`） | 🟡 **CDN 可用性风险** —— 若 jsdelivr 被墙或挂掉，登录功能失效 |
| 无其他运行时依赖 | — | ✅ |

**缓解建议（未实施）**：将 supabase-js 内联进 `index.html`，彻底摆脱 CDN 依赖。
**优先级**：中（当前登录功能实测可用，可作为 v1.1 优化项）

### 4.4 敏感信息管理

| 规则 | 状态 |
|---|---|
| `service_role` key **绝不**写入前端或提交 git | ✅ 未使用 |
| `.env.local` 加入 `.gitignore` | ✅ |
| 仓库中不出现真实密钥（仅 build-config 中的 **anon** key，设计上可公开） | ✅ |
| 若密钥意外泄露，立即在 Supabase 控制台轮换 | 📋 应急流程 |

> **注意**：`build-config.json` 中的 `supabase.anon_key` 是**可公开的匿名密钥**（等效 anon key），泄露不构成安全事件。真正危险的是 `service_role` key，本项目从未使用。

---

## 5. 隐私与合规

### 5.1 数据主体权利

| 权利 | 实现方式 |
|---|---|
| **访问权** | 设置页可导出本地数据（JSON） |
| **删除权** | 退出登录后清除本地数据；云端数据需在 Supabase 控制台删除账号 |
| **可携带权** | 导出 JSON 格式，结构见 `05-API` |
| **撤回同意** | 不登录即不上传任何数据 |

### 5.2 合规状态

- **ICP 备案**：未备案。当前使用 `*.pages.dev` 域名（Cloudflare 提供），**不涉及中国大陆服务器**，无需备案
- **个人信息保护法**：仅收集邮箱，且为用户主动注册时提供；无强制收集
- **GDPR**：⚠️ 若未来有欧盟用户，需在注册流程增加隐私政策同意勾选项

### 5.3 儿童隐私

本应用面向成人英语学习者，**未做年龄验证**，无意收集儿童数据。

---

## 6. 安全检查清单（上线/变更必查）

### 6.1 每次数据库变更

- [ ] 新建的表**必须** `enable row level security`
- [ ] 新建的表**必须**创建 `auth.uid() = user_id` 策略（含 `using` + `with check`）
- [ ] 变更后用**两个不同账号**验证互相看不到对方数据
- [ ] 确认未误开 `service_role` 权限给前端

### 6.2 每次代码发布

- [ ] 确认无新引入的密钥/口令硬编码
- [ ] 确认新增的 `innerHTML` 渲染点都调用了 `escapeHtml`
- [ ] 确认 `.env.local` 未被 `git add`
- [ ] 确认未把 `dist/` 之外的构建中间产物（含 `.git/`）推上去

### 6.3 定期（建议每季度）

- [ ] 检查 Supabase 控制台的 Auth 日志有无异常登录
- [ ] 导出 `cards_progress` 做离线备份
- [ ] 确认 RLS 策略仍生效（Supabase 控制台 → Table Editor → 查看策略）

---

## 7. 安全事件应急响应

| 事件 | 响应 |
|---|---|
| **anon key 泄露** | 🟢 不构成事件（设计上可公开）。但需确认 RLS 全部生效 |
| **service_role key 泄露** | 🔴 **P0**：立即在 Supabase 控制台 `Settings → API → Reset service_role key`；排查 git 历史，必要时 force-push 清理 |
| **发现越权漏洞** | 🔴 **P0**：立即检查该表 RLS 是否启用；补齐策略；评估数据泄露范围 |
| **账号被盗** | 用户在 Supabase 控制台重置密码；检查异常 IP |
| **Supabase 项目被删/不可用** | 🟡 从本地 IndexedDB 导出 JSON 恢复；联系 Supabase 支持 |

---

## 8. 已知安全缺陷与接受理由

| 编号 | 缺陷 | 风险 | 接受理由 |
|---|---|---|---|
| SEC-01 | 本地 IndexedDB 未加密 | 低 | 需物理接触设备 + 同源才能读取；数据非敏感 |
| SEC-02 | 无 CSP（Content-Security-Policy）响应头 | 低 | 单文件应用、无外部脚本注入点；Cloudflare Pages 配置 CSP 需额外设置 |
| SEC-03 | supabase-js 走第三方 CDN | 中 | 影响可用性而非安全性；有内联方案待实施 |
| SEC-04 | 无账号删除自助入口 | 低 | 单用户项目；可通过 Supabase 控制台处理 |
| SEC-05 | 无登录失败锁定/验证码 | 低 | Supabase Auth 自带速率限制 |

---

## 附录 A：安全配置快照

```sql
-- 当前 RLS 状态（应始终为 t）
select relname, relrowsecurity
from pg_class
where relname in ('cards_progress','user_settings','rec_scores');

-- 期望结果：三行 relrowsecurity = true
```

## 附录 B：验证 RLS 是否生效的方法

1. 注册**两个**测试账号 A / B
2. 用 A 学习若干词，产生进度
3. 退出，用 B 登录
4. 打开开发者工具 → Console，执行：
   ```javascript
   const { data } = await window._sb.from('cards_progress').select('*');
   console.log(data.length);  // 期望：0（看不到 A 的数据）
   ```
5. 若返回非 0，**RLS 未生效，立即排查**

---

*本文档应在任何数据库结构变更、认证方式变更、引入新第三方依赖后同步更新。*
