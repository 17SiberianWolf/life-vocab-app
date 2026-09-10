# 08 · 部署运维手册

| 项 | 内容 |
|---|---|
| 文档编号 | LV-OPS-v1.0 |
| 版本 | 1.0 |
| 生产环境 | Cloudflare Pages |
| 生产地址 | https://life-vocab-app.pages.dev |
| 源码仓库 | https://github.com/17SiberianWolf/life-vocab-app |

---

## 1. 部署架构

```mermaid
graph LR
    DEV[本地开发] -->|git push| GIT[GitHub main]
    GIT -->|Webhook 自动触发| CF[Cloudflare Pages]
    CF -->|部署 dist/| CDN[全球 CDN]
    CDN --> USER[用户浏览器]
    USER -->|HTTPS| SB[Supabase 云]
```

| 环节 | 说明 |
|---|---|
| 构建 | **不在云端执行**。构建产物 `dist/` 直接提交进仓库 |
| 部署 | Cloudflare Pages 监听 `main` 分支 push，自动部署 |
| 分发 | Cloudflare 全球 CDN（大陆走香港/日本节点） |
| 数据 | Supabase 云服务，前端直连 |

---

## 2. 环境清单

| 环境 | 用途 | 地址 | 数据 |
|---|---|---|---|
| 本地 | 开发调试 | `http://127.0.0.1:8173` | 本地 IndexedDB；若已配置 Supabase 则会同步到生产库 |
| 生产 | 正式使用 | `https://life-vocab-app.pages.dev` | Supabase 生产项目 |

> ⚠️ 本地调试时若已登录，学习结果**会真实写入生产数据库**。如需隔离，请临时把 `build-config.json` 的 `supabase.enabled` 设为 `false` 后重新构建（改回后记得恢复）。

---

## 3. 构建流程

### 3.1 前置条件

| 项 | 版本 |
|---|---|
| Python | 3.8+（仅构建期，部署环境不需要） |
| Node.js | 22+（仅测试期） |
| Git | 任意 |

### 3.2 构建命令

```bash
python build_index.py
```

**构建脚本做了什么**：

1. 读取 `data/topics.json` + `data/cards.json`
2. 读取 `build-config.json`（Supabase 配置、同步参数、音频开关）
3. 若 `audio.embed == false`，剥离每张卡的 `audio_word` / `audio_example` / `audio_word_slow` / `audio_example_slow` 字段
4. 把词库与配置内嵌进 HTML 模板，生成根目录 `index.html`
5. **输出纯净部署目录 `dist/`**：仅 `index.html` + `manifest.webmanifest` + `sw.js` + `icons/`（共 7 个文件）

### 3.3 dist/ 目录规范

```
dist/
├── index.html              # 单文件应用（词库 + 配置 + 逻辑）
├── manifest.webmanifest    # PWA 清单
├── sw.js                   # Service Worker
└── icons/                  # 4 个 PNG 图标
```

**约束**：`dist/` 必须提交进 git（部署环境无 python3，不能云端构建）；但 `.git/`、`*.py`、`test-*.js`、`data/` 等**绝不能**进入部署产物。

---

## 4. 标准发布流程

> **每次发布必须完整执行以下步骤，遗漏任何一步都可能导致用户看不到更新。**

| # | 步骤 | 命令 / 操作 | 校验 |
|---|---|---|---|
| 1 | 修改源码 | 编辑 `build_index.py` / `lib/*.js` / `data/*.json` | — |
| 2 | **bump 缓存版本** | 编辑 `sw.js`：`CACHE_NAME = 'wordmatch-vN'` → `vN+1` | ⚠️ 最易遗漏，漏了用户永远加载旧页 |
| 3 | 重新构建 | `python build_index.py` | 观察输出无报错 |
| 4 | 跑测试 | 依次执行 6 个 `node test-*.js` | 全部通过 |
| 5 | 人工回归 | 按 [07-TEST §6.3](./07-TEST-测试文档.md) 清单验证 | 8 项全过 |
| 6 | 提交 | `git add -A && git commit -m "..."` | — |
| 7 | 推送 | `git push` | 显示 `main -> main` |
| 8 | 等待部署 | Cloudflare Pages 自动部署，约 1–2 分钟 | Dashboard 显示 Success |
| 9 | 验证线上 | `curl -s https://life-vocab-app.pages.dev/ \| grep -c "关键字"` | 新代码已出现 |
| 10 | 通知用户刷新 | — | 用户需 **Ctrl+F5** 强制刷新 |

### 4.1 发布检查清单（复制使用）

```
[ ] sw.js CACHE_NAME 已 +1
[ ] python build_index.py 成功
[ ] test-app.js      通过
[ ] test-stage2.js   通过
[ ] test-business.js 通过
[ ] test-stage3.js   通过
[ ] test-stage4.js   通过
[ ] test-stage5.js   通过
[ ] 人工回归 8 项完成
[ ] git push 成功
[ ] 线上验证新代码已生效
```

---

## 5. Git 与网络配置

### 5.1 仓库

| 项 | 值 |
|---|---|
| 远程 | `git@github.com:17SiberianWolf/life-vocab-app.git` |
| 分支 | `main` |
| 协议 | SSH over 443（绕过大陆网络限制） |

### 5.2 SSH 配置（`~/.ssh/config`）

```
Host github.com
    HostName ssh.github.com
    Port 443
    User git
    IdentityFile ~/.ssh/id_ed25519
```

> 直连 `github.com:22` 在大陆网络下会 `Connection reset`，必须走 `ssh.github.com:443`。

### 5.3 常见 git 问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `Connection reset` | 直连 22 端口被墙 | 配置 §5.2 后重试 |
| `commit 成功但 push 失败` | 同一命令内 push 偶发失败 | **单独再执行一次 `git push`** |
| 远程有本地没有的提交 | 建仓时勾选了 LICENSE | 确认无重要内容后 `git push -f` |

---

## 6. 回滚

| 场景 | 操作 |
|---|---|
| 代码问题 | `git revert <commit>` → push；或 Cloudflare Dashboard → Deployments → 选历史版本 → Rollback |
| 数据问题（词库错误） | 从 `data/backup/` 恢复 `cards_*.json` → 重新构建 → 发布 |
| 配置错误（Supabase 写错） | 修正 `build-config.json` → 重新构建 → 发布 |

**注意**：回滚代码**不会**回滚用户的学习数据（数据在 Supabase 与各设备本地）。

---

## 7. 备份与恢复

| 数据 | 备份方式 | 频率 | 恢复方式 |
|---|---|---|---|
| 词库 `data/cards.json` | `expand_vocab.py` 每次合并自动备份到 `data/backup/`；且已纳入 Git | 每次变更 | 复制备份文件覆盖后重新构建 |
| 云端用户数据 | Supabase Dashboard → Table Editor → Export CSV；或 `pg_dump` | 建议每季度 | CSV 导入 / `psql` 恢复 |
| 本地进度 | 登录后自动上云 | 自动 | 在新设备登录即可拉取 |
| PWA 图标 | 由 `make_icons.py` 重新生成 | 无需备份 | 重新生成 |

> `data/backup/` 已在 `.gitignore` 中排除，不进仓库。

---

## 8. 监控与告警

**当前状态：未配置正式监控。** 这是个人项目的已知简化项。

| 可用的观测手段 | 位置 |
|---|---|
| 部署状态 | Cloudflare Pages Dashboard → Deployments |
| 云端数据库用量 | Supabase Dashboard → Reports |
| 认证用户数 | Supabase Dashboard → Authentication → Users |
| 客户端错误 | 浏览器 DevTools Console（需用户主动反馈） |

### 8.1 建议补充（可选）

- Cloudflare Pages 的 Web Analytics（免费、无侵入）
- Supabase 的免费额度告警（邮件通知）
- 前端全局 `window.onerror` 上报（需自建接收端，当前未做）

---

## 9. 故障排查 Runbook

| # | 现象 | 可能原因 | 排查与处理 |
|---|---|---|---|
| 1 | 页面打不开 | 域名被限制 / 网络问题 | 换网络（手机热点）试；`ping`/`curl` 测试；确认是否误用 `*.workers.dev`（该域名大陆被墙，必须用 `*.pages.dev`） |
| 2 | 打开是旧版本 | Service Worker 缓存 | **Ctrl+F5** 强刷；仍不行则 DevTools → Application → Storage → Clear site data |
| 3 | 登录后不同步 | 未登录 / SDK 未加载 / 网络 | 顶栏看是否显示邮箱；Console 看是否有 `[sync] supabase-js 未加载`（CDN 失败 → 换网络或考虑内联 SDK） |
| 4 | 注册/登录无反应 | 页面 JS 报错 | Console 查红色报错；确认 Tab 查找逻辑未被改动 |
| 5 | 无发音 | 浏览器 TTS 不可用 / 输出设备问题 | **先检查耳机、音箱等物理连接与系统音量**（实际发生过的误报）；再查 Console 是否 `speechSynthesis` 报错 |
| 6 | 录音评分不可用 | 浏览器不支持 / 麦克风未授权 | 需用 Chrome/Edge；检查麦克风权限 |
| 7 | 徽标数字异常大 | 缓存旧版本 | 强刷；若仍异常，检查是否退回到旧代码 |
| 8 | 部署后 `.git/` 被上传 | 输出目录配置错误 | Cloudflare Pages 的 Output directory 必须是 `dist`，Build command 必须**留空** |
| 9 | 构建失败（云端） | 云端无 python3 | 按设计本就不需要云端构建，确认 Build command 为空 |
| 10 | 游戏在后台继续发音 | 生命周期钩子失效 | 检查 `show()` 是否调用 `stopAllGames()`；检查新增延迟回调是否带回合身份校验 |
| 11 | 单词下落越来越快 | 多局 interval 叠加 | 检查 `startGravityRound()` 开头是否 `clearInterval` |
| 12 | 词卡按钮点了没反应 | 事件委托绑定层级错误 | 确认委托绑在 `document` 级 |

---

## 10. 常见运维操作

### 10.1 扩充词库

```bash
# 1. 编写批次文件 data/expansion/batch_NN_xxx.json
#    格式: {"topic":"xxx","items":[[en,zh,ex,ex_zh,sc,scene,tip],...]}
# 2. 试运行
python expand_vocab.py --dry
# 3. 正式合并（自动备份 + 按 en+topic 去重）
python expand_vocab.py
# 4. 查看统计
python expand_vocab.py --stats
# 5. 重新构建并发布（按 §4 流程）
```

### 10.2 更换 Supabase 项目

1. 在新项目执行 `supabase/SCHEMA.sql`
2. 修改 `build-config.json` 的 `url` 与 `anon_key`
3. 重新构建 → 发布
4. **通知所有用户重新注册**（旧账号在新项目不存在）

### 10.3 禁用云同步（纯本地模式）

`build-config.json` → `"supabase": {"enabled": false}` → 重新构建 → 发布。应用降级为纯本地，功能不受影响。

### 10.4 重新生成 PWA 图标

```bash
python make_icons.py
# 随后必须 bump sw.js CACHE_NAME，否则用户仍看到旧图标
```

### 10.5 重新启用离线音频（不推荐）

`build-config.json` → `"audio": {"embed": true}` → 运行 `python gen_audio.py` 生成 mp3 → 重新构建。
⚠️ 会显著增大产物体积（历史数据：2992 个 mp3 共 61MB），且 `audio/` 未纳入 git。

---

## 11. 应急联系人与资源

| 资源 | 地址 |
|---|---|
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Supabase Dashboard | https://supabase.com/dashboard |
| GitHub 仓库 | https://github.com/17SiberianWolf/life-vocab-app |
| Supabase 状态页 | https://status.supabase.com |
| Cloudflare 状态页 | https://www.cloudflarestatus.com |
