# Supabase 准备指南 · 阶段 5

> 用时: 10-15 分钟  
> 用途: 创建 life-vocab-app 的云端存储 + 用户认证  
> 难度: 零基础可跟

---

## 第 1 步 · 注册 & 建项目（2 分钟）

1. 访问 https://supabase.com/dashboard
2. 用 **GitHub 账号登录**（推荐），或邮箱
3. New Project → 命名 `life-vocab-app` → 选最近的数据中心（亚洲选 Singapore）
4. 设置 **Database Password**（自己记住，只用一次）
5. 点 Create Project → 等待 ~1 分钟初始化

## 第 2 步 · 跑建表 SQL（3 分钟）

1. 左侧菜单 → **SQL Editor** → New query
2. 打开 `life-vocab-app/supabase/SCHEMA.sql`，**全部复制粘贴**进去
3. 点右下角 **Run**（或 Ctrl+Enter）
4. 应看到 "Success. No rows returned"

> 验证：左侧 **Table Editor** 应能看到 3 张表：`cards_progress`、`user_settings`、`rec_scores`

## 第 3 步 · 关闭邮箱注册确认（可选，1 分钟）

如想直接邮箱+密码登录而无需邮件确认：

1. 左侧 **Authentication** → **Providers**
2. 找到 **Email** → 展开
3. **Confirm email** 关闭
4. Save

> 不关也行，首次登录 Supabase 会发一封验证邮件。

## 第 4 步 · 拿两个 Key（1 分钟）

1. 左侧 **Settings** → **API**
2. 复制两项给我：

| 字段 | 位置 | 用途 |
|------|------|------|
| **Project URL** | "Project URL" 行 | 例如 `https://xxxxx.supabase.co` |
| **anon public** key | "Project API keys" → `anon` `public` | 以 `eyJ...` 开头的一长串 JWT |

> 这两个值只会嵌入到打包后的 `index.html` 内（前端可见但安全，因为 RLS 限制为只能读写自己 user_id 的行）。

## 第 5 步 · 启用 GitHub OAuth（可选，5 分钟）

如想"用 GitHub 一键登录"而非邮箱密码：

1. **Authentication** → **Providers** → **GitHub** → Enabled on
2. 需要创建一个 GitHub OAuth App：https://github.com/settings/developers/new
3. 填入回调 URL：`https://<你的-project-ref>.supabase.co/auth/v1/callback`
4. 把 GitHub 提供的 Client ID / Secret 填回 Supabase
5. Save

---

## 接下来给我什么？

回我一条消息，把以下两个值贴过来即可：

```
PROJECT_URL = https://xxxxxxxxxxxxx.supabase.co
ANON_KEY    = eyJhbGciOiJIUzI1NiIs...
```

我会把它们写入 `life-vocab-app/.env.local`（不提交到 git）和 `build-config.json`（构建时注入到 `index.html`），然后：

1. 跑构建 → 注入 → 产出最终 `index.html`
2. 跑 `test-stage5.js` 验证登录、同步、冲突合并
3. 推到 GitHub + 部署 Vercel

完成后你就能在任意浏览器登录同一个账号、跨设备同步进度。

---

## 常见问题

**Q：Supabase 免费层够用吗？**  
A：500 MB 数据库 / 5 GB 流量 / 50,000 月活，对个人用户绰绰有余。

**Q：会不会数据泄露？**  
A：所有表都启用了 RLS（行级安全），即使 anon key 公开也只能读写 `auth.uid() = user_id` 的行。别人拿你的 key 也看不到你的数据。

**Q：能不能自托管？**  
A：可以，Supabase 开源，Docker 一键起。但免费层已够用，没必要自托管。
