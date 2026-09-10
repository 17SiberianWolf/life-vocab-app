# 开发者指南（CONTRIBUTING）

> 面向要修改本项目代码的人。文档索引见 [docs/00-归档总目.md](./docs/00-归档总目.md)。

---

## 0. 最重要的一条：不要手改 `index.html`

```
源码                          构建产物（自动生成，勿手改）
─────────────────────────     ──────────────────────────
build_index.py   ──┐
lib/*.js         ──┼─ build ─→ index.html
data/*.json      ──┘            dist/index.html  ← 部署用
                                dist/sw.js
                                dist/manifest.webmanifest
                                dist/icons/
```

**`index.html` 是 900KB 的生成文件。直接改它，下次构建就会被覆盖。**

✅ 正确做法：改 `build_index.py` 或 `lib/*.js` → 跑 `python build_index.py` → 改 `sw.js` 版本号 → 测试 → push。

---

## 1. 环境准备

```bash
# 必需
- Python 3.8+        # 构建
- Node.js 18+        # 测试
- Git

# 可选
- pip install edge-tts   # 仅当需要重新生成离线 mp3 时（当前默认不用）
```

**无第三方 Python 依赖即可构建**（构建脚本只用标准库 + json）。

---

## 2. 本地开发

### 2.1 起本地服务（推荐）

```bash
python serve.py 8173
# 浏览器打开 http://localhost:8173
```

> ⚠️ **不要用 `python -m http.server`** —— 它不发 `Cache-Control: no-store`，浏览器会缓存旧 JS，你会以为改动没生效而白白排查。`serve.py` 已强制禁用缓存。

### 2.2 构建

```bash
python build_index.py
```

输出：
- `index.html`（根目录，调试用）
- `dist/`（部署产物，7 个文件）

**每次改完代码都要跑。**

### 2.3 改 sw.js 缓存版本（必做！）

```bash
# sw.js
- const CACHE_NAME = 'wordmatch-v16';
+ const CACHE_NAME = 'wordmatch-v17';
```

> **原因**：静态资源仍走 cache-first；不 bump 版本号，用户浏览器**永远加载旧 JS/词库**，你会收到"我这边还是老样子"的反馈。（导航请求已改 network-first + `controllerchange` 自动刷新，但静态资源仍需 bump。）
> 这是本项目**最容易忘、后果最明显**的一步。

### 2.4 跑测试

```bash
node test-stage2.js     # 数据与基础功能
node test-stage3.js     # 游戏逻辑
node test-stage4.js     # 阶段4功能
node test-stage5.js     # 云同步/PWA
node test-business.js   # 商务主题专项
node test-app.js        # 主应用 JS 语法与结构
node test-tts.js        # 移动端发音链路（同源 /tts、双引擎、长句不误报）
```

全部输出 `OK` 且无 `FAIL` 才可提交（7 套件合计 253 项全绿）。

---

## 3. 代码结构

```
build_index.py          # 【主源码】主应用 JS/CSS/HTML 都在这里作为模板字符串
                        #   第 1-430 行：CSS
                        #   第 430-800 行：HTML 骨架
                        #   第 800-2450 行：主应用 IIFE（全部业务逻辑）
                        #   第 2450+ 行：构建与 dist 输出逻辑

lib/db.js               # IndexedDB 封装（Promise 接口）
lib/sync.js             # Supabase 同步层（推/拉/离线队列/冲突合并）
lib/auth-ui.js          # 登录注册 UI
lib/install-prompt.js   # PWA 安装横幅

data/cards.json         # 词库（3230 张）
data/topics.json        # 主题（25 个）
data/expansion/         # 扩充批次源文件

expand_vocab.py         # 词库合并流水线
build-config.json       # 构建配置（supabase/audio/pwa 开关）
serve.py                # 无缓存静态服务器
sw.js                   # Service Worker
manifest.webmanifest    # PWA 清单
```

### 3.1 模块约定（**重要**）

每个 `lib/*.js` 都是**独立 IIFE**，互不共享作用域：

```javascript
(function (root) {
  'use strict';
  // ❌ 错误：假设 $ 是全局的
  $('#btn').onclick = ...;

  // ✅ 正确：模块内自己定义
  const $ = (s) => document.querySelector(s);
  $('#btn').onclick = ...;
})(window);
```

> ⚠️ **历史 bug**：`install-prompt.js` 曾直接调用 `$()`，而 `$` 定义在 `auth-ui.js` 的闭包内 → `ReferenceError` → 按钮全失效且横幅关不掉。
> **教训：跨模块不共享任何工具函数，每个模块自备。**

### 3.2 事件委托约定

词卡组件（`makeWordCard()`）在多个容器复用（浏览页/今日复习/错题本），因此：

```javascript
// ❌ 错误：绑在单一容器
document.getElementById('cardList').addEventListener('click', ...);

// ✅ 正确：绑在 document
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const cardEl = btn.closest('[data-card-id]');
  if (!cardEl) return;   // 必须有空值防护
  ...
});
```

### 3.3 异步回调约定（**重要**）

任何 `setTimeout` / `setInterval` 回调，如果它会在游戏回合结束后触发，**必须做回合身份校验**：

```javascript
// ❌ 危险：离开视图后仍会执行
setTimeout(() => { r.cursor++; nextGravity(); }, 400);

// ✅ 正确：先确认回合还有效
setTimeout(() => {
  if (STATE.gravityRound !== r) return;   // 回合已作废
  r.cursor++; nextGravity();
}, 400);
```

> ⚠️ **历史 bug**：消消乐退出后定时器继续跑，后台持续发音、掉命、弹窗；重进时旧 interval 叠加导致下落越来越快。
> **新增任何延迟回调都要带这个校验。**

---

## 4. 扩充词库

详细规范见 [docs/12-数据字典-词库规范.md](./docs/12-数据字典-词库规范.md) §6。

### 快速流程

```bash
# ① 新建批次文件
#    data/expansion/batch_XX_<name>.json
#    格式: {"topic":"<topic_id>", "items":[["en","zh","ex","ex_zh","sc","scene","tip"], ...]}

# ② 试运行
python expand_vocab.py --dry

# ③ 正式合并（自动备份 + 去重）
python expand_vocab.py

# ④ 看统计
python expand_vocab.py --stats

# ⑤ 重新构建
python build_index.py

# ⑥ bump sw.js 版本号（必做）

# ⑦ 测试 + 提交
node test-stage5.js
git add -A && git commit -m "..." && git push
```

### 新增主题

在 `data/expansion/topics_new.json` 追加主题定义（含 `subscenes`），然后跑 `expand_vocab.py` 会自动合并进 `data/topics.json`。

---

## 5. 提交规范

### 5.1 Commit Message

采用 Conventional Commits：

```
<type>: <简短描述>

<正文：说明为什么改，而不是改了什么>

<可选：影响范围、关联 issue>
```

**type 取值**：

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 文档 |
| `chore` | 构建/配置/杂项 |
| `refactor` | 重构（无功能变化） |
| `test` | 测试 |

**示例**：
```
fix: 修复离开游戏视图后游戏未停止的泄漏问题

根因: show() 切换视图只改 DOM 显示, 无任何停止逻辑,
定时器与待执行回调在后台继续运行。

- 新增 stopAllGames(): 切视图时清掉 4 个游戏的回合状态/计时器
- 所有延迟回调加回合身份校验
- sw.js 缓存版本 v4 -> v5
```

### 5.2 提交前检查清单

- [ ] 跑过 `python build_index.py`
- [ ] **bump 了 `sw.js` 的 `CACHE_NAME`**（改代码时必须）
- [ ] 所有测试通过（6 个套件）
- [ ] `git status` 中没有 `data/backup/`、`.env.local`、`audio/`
- [ ] 没有把 `service_role` key 写进代码

---

## 6. 发布流程

```bash
# ① 构建
python build_index.py

# ② bump sw.js

# ③ 全量测试
for f in test-stage2.js test-stage3.js test-stage4.js test-stage5.js test-business.js test-app.js; do node $f; done

# ④ 确认 dist/ 是最新
git status   # dist/ 应该有改动

# ⑤ 提交推送（Cloudflare Pages 自动部署）
git add -A && git commit -m "..." && git push

# ⑥ 等 1-2 分钟，验证线上
curl -s https://life-vocab-app.pages.dev/ | grep -c "关键字符串"
```

**回滚**：
```bash
git revert <commit>     # 推荐，保留历史
git push                # 自动重新部署
```

或紧急回滚：`git reset --hard <上一个好版本> && git push -f`（**慎用**，会重写历史）。

---

## 7. 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 改了代码线上没变 | ① 没 bump sw.js ② 没跑 build ③ 浏览器缓存 | 三步都做 + `Ctrl+F5` |
| 本地改了没生效 | 用了 `python -m http.server` | 改用 `python serve.py 8173` |
| 按钮点了没反应 | 事件委托绑错层级 / 跨模块用了别处的 `$` | 见 §3.1 / §3.2 |
| 退出游戏还有声音 | 异步回调没做回合校验 | 见 §3.3 |
| `push` 被拒 | 远程有本地没有的提交 | `git pull --rebase` 后再 push |
| `push` Connection reset | 直连 GitHub 被墙 | 走 SSH 443：`~/.ssh/config` 配 `ssh.github.com:443` |
| 部署后 502 | 构建命令失败 | **Build command 留空**，用已提交的 `dist/` |
| 部署到 `*.workers.dev` | 选错产品（Workers 而非 Pages） | 必须走 `Continue to Pages` 入口 |

---

## 8. 测试编写约定

测试脚本**不能读 `build_index.py` 源文件**（沙箱限制），改为校验构建产物 `index.html`：

```javascript
// ❌ 不行
fs.readFileSync('build_index.py', 'utf8');

// ✅ 可以
fs.readFileSync('index.html', 'utf8');
```

新增断言时，注意断言要随数据演进而更新——例如"商务卡 158 张"在词库扩充后会失败，应改为"≥ 158 张"或按实际值。

---

## 9. 安全约束

- ❌ **绝不**把 Supabase `service_role` key 写入任何文件
- ❌ **绝不**提交 `.env.local`
- ✅ 新增数据表必须启用 RLS 并配 `auth.uid() = user_id` 策略
- ✅ 新增 `innerHTML` 渲染点必须用 `escapeHtml()`

详见 [docs/11-SECURITY-安全设计说明书.md](./docs/11-SECURITY-安全设计说明书.md)。

---

## 10. 文档维护

修改以下内容时，**必须同步更新对应文档**：

| 改动 | 需更新文档 |
|---|---|
| 架构/技术选型变化 | `02-HLD` + 新增 ADR |
| 数据库表结构变化 | `04-DB` + `05-API` + `openapi.yaml` |
| 词库字段变化 | `12-数据字典` |
| 游戏算法变化 | `03-LLD` |
| 部署方式变化 | `08-OPS` + 新增 ADR |
| 设计令牌/组件变化 | `06-UIUX` |
| 发版 | `CHANGELOG.md` |

---

*有疑问先看 `docs/03-LLD`（实现细节）和 `docs/10-ADR`（决策理由）。*
