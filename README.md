# life-vocab-app · 单词碰碰乐

> 面向「生活 + 职场英语词汇」的 **PWA 学习应用**：单文件 `index.html` + 同源 TTS 发音 + SRS 间隔复习 + 6 种游戏 + Supabase 跨设备同步。零构建、可安装到桌面、离线可玩。

**🏷 当前版本：[v1.0.7](./CHANGELOG.md)（2026-09-10）** ·
线上：https://life-vocab-app.pages.dev ·
数据：**3230 张卡 / 25 主题 / 2700+ 唯一词条**

> 近期（v1.0.1~v1.0.7）连续修复了**手机端发音**问题：例句现已**整句自然朗读**（国内百度翻译 TTS 主引擎 + Google 兜底），不再逐词拆读；单词走有道双口音。详见 [CHANGELOG](./CHANGELOG.md)。

## 📚 文档索引

完整项目资料（16 项）已归档至 **[docs/00-归档总目.md](./docs/00-归档总目.md)**：

| 类别 | 文档 |
|---|---|
| **设计与架构** | [01-SRS 需求规格](./docs/01-SRS-需求规格说明书.md) · [02-HLD 概要设计](./docs/02-HLD-概要设计说明书.md) · [03-LLD 详细设计](./docs/03-LLD-详细设计说明书.md) · [10-ADR 架构决策](./docs/10-ADR-架构决策记录.md) |
| **数据与接口** | [04-DB 数据库设计](./docs/04-DB-数据库设计说明书.md) · [05-API 接口设计](./docs/05-API-接口设计说明书.md) · [openapi.yaml](./docs/openapi.yaml) · [12-数据字典](./docs/12-数据字典-词库规范.md) |
| **界面** | [06-UIUX 设计规范](./docs/06-UIUX-设计规范.md) |
| **质量与运维** | [07-TEST 测试文档](./docs/07-TEST-测试文档.md) · [08-OPS 部署运维](./docs/08-OPS-部署运维手册.md) · [11-SECURITY 安全设计](./docs/11-SECURITY-安全设计说明书.md) |
| **使用与开发** | [09-USER 用户手册](./docs/09-USER-用户手册.md) · [CONTRIBUTING 开发者指南](./CONTRIBUTING.md) · [CHANGELOG 变更日志](./CHANGELOG.md) |
| **发布与风险** | [13-RELEASE v1.0](./docs/13-RELEASE-v1.0.md) · [14-风险登记册](./docs/14-已知问题与风险登记册.md) |

> **要改代码先看 [CONTRIBUTING.md](./CONTRIBUTING.md)** —— 尤其「不要手改 `index.html`」和「发版必须 bump `sw.js` 版本号」两条。

---

## 一句话定位

把生活 / 职场场景词汇按主题整理，单击「碰碰乐」与英文释义配对，每对成功触发发音——练听、练读、练反应。手机浏览器「添加到主屏幕」即像一个 App。

---

## 功能一览

| 能力 | 说明 |
|---|---|
| **6 种玩法** | Browse 浏览 / Match 碰碰乐 / Listen 听音 / Memory 连连看 / Gravity 消消乐 / 🎙 跟读 |
| **SRS 间隔复习** | 1 / 2 / 4 / 7 / 15 / 30 天间隔重复，错题连对 2 次才移出 shadow pool |
| **真实发音评分** | 🎙 跟读：MediaRecorder 录音 → Web Speech API 转写 → 词级命中比对 + 编辑距离模糊匹配 → 0-100 分 + 三档自评 |
| **进度仪表盘** | 9 项 KPI（含「发音均分」）+ 主题掌握度 + SRS 阶梯 + 14 天活跃热力 |
| **同源 TTS 发音** | 单词有道 / 例句百度(主)+Google(备) 整句自然朗读，手机端不依赖任何外部域名 |
| **PWA 可安装** | manifest + Service Worker（network-first + 自动刷新）+ 桌面/主屏安装 |
| **跨设备同步** | Supabase 邮箱登录，进度/设置/跟读分自动多设备同步（RLS 隔离），不配置也能本地用 |

---

## 当前进度快照（v1.0.7）

| 维度 | 现状 |
|---|---|
| 主题 | **25 个** —— 商务汇报💼 / 学术雅思📚 / 中国菜品🥢 / 运动健康⚽ / 旅行出行✈ / 情绪性格😊 / 金钱金融💰 / 功能表达💬 / 科技数码📱 / 天气环境🌍 / 社会传媒📰 / 短语习语🔗 / 学习教育🎓 / 工业现场🏭 / 职场办公💻，以及生活 11 个（厨房🍳/水果🍎/蔬菜🥬/客厅🛋/出行🚗/购物🛍/健康💊/社交👥/餐饮🍽/家居🏠…）|
| 词量 | **3230 张 / 2700+ 唯一词条**（原 748 精编 + 2482 扩充）|
| 发音 | **同源 TTS 代理**（单词有道双口音回退；例句百度主 + Google 备，整句自然朗读）；桌面端优先本地 Web Speech，失败自动转在线 |
| 玩法 | **6 个**（含 🎙 跟读）|
| 云同步 | Supabase Auth（邮箱）+ 三表 `cards_progress` / `user_settings` / `rec_scores`，IndexedDB→云异步推、离线入队 flush、last-write-wins |
| PWA | `manifest.webmanifest` + `sw.js`（wordmatch-v16，network-first + 自动刷新）+ 图标（192/512 + maskable）|
| 商务卡 | 12 个 M 模块（M1~M12），来源 `pm-english/cards.md` |
| SRS | 1/2/4/7/15/30 天间隔，SM-2 风格 |
| 测试 | 7 套件、243 项断言全绿（见 [测试](#测试) 节）|

> 完整阶段路线图见文末 [历史路线图](#历史路线图)。

---

## TTS 发音机制（v1.0.7）

发音统一走 **同源 Cloudflare Pages Function 代理** `functions/tts.js`（路径 `/tts`），由 Cloudflare 边缘回源取音频，**手机端不与任何外部域名直接通信** —— 这是绕开国内运营商对 jsdelivr / 有道 / Google 直连封锁的关键铁律。

| 输入 | 引擎路由 | 说明 |
|---|---|---|
| **单词**（无空格且 ≤40 字符）| 有道 `dictvoice` | 英式无音频自动回退美式（双口音回退），响应头 `X-TTS-Source: youdao-proxy` |
| **例句**（含空格或较长）| **百度翻译 TTS `fanyi.baidu.com/gettts`（主引擎）** + Google `translate_tts?client=gtx`（备份）| 国内免密钥、整句自然合成；长文本按词边界切片拼接；响应头 `X-TTS-Source: baidu-sentence / google-sentence` |

- **整句自然朗读**：例句一次性请求整句音频播放，不再逐词拆读（v1.0.4 的逐词方案已推翻）；仅在整句在线请求**真失败**时才退化为逐词保底出声。
- **桌面端**：本地 `speechSynthesis` 优先，静默失败（1.2s 无 `onstart`）自动转在线同源代理。
- **设置项**：「发音方式」`自动 / 仅本地语音 / 仅在线音频`；「🔊 发音自检」可一键诊断环境并试听。
- **Edge TTS 调研结论**：Microsoft Edge TTS 免费且音质最佳，但其握手依赖 `Sec-*` 保留头，而 Cloudflare Worker/Pages Function 运行时禁止客户端设置该类头 → 不可行，已放弃。
- **离线高清音频（可选）**：早期用 `edge-tts` 生成 mp3（`audio.embed=true` 时嵌入），当前默认 `audio.embed=false` 走在线代理，零 404、无需上传音频。

---

## 部署（Cloudflare Pages）

> ⚠️ 曾踩坑：Vercel 构建环境无 `python3` 导致 502、且 `.vercel.app` 大陆被限；腾讯云 CloudBase 免费版静态托管权限受限。最终选 **Cloudflare Pages**（[ADR-006](./docs/10-ADR-架构决策记录.md)）。

| 项 | 配置 |
|---|---|
| 平台 | Cloudflare Pages |
| Build command | **留空**（不构建）|
| Output directory | `dist` |
| 仓库 | GitHub（push 即自动部署）|
| 关键点 | `dist/` 已提交进 git，部署时零构建；`functions/tts.js` 随 Pages Function 自动生效 |

```bash
git push origin main   # Cloudflare 拉取 dist/ 自动上线
```

---

## 本地开发与构建

```bash
# 1. 改词库数据
vim data/cards.json data/topics.json

# 2. 重新构建（注入 build-config.json 的 Supabase 配置，产出 index.html + dist/）
python build_index.py

# 3. 本地预览（带 no-cache）
python serve.py 8173
# 浏览器开 http://localhost:8173

# 4. 发版纪律：每次改代码 / 词库后，务必 bump sw.js 的 CACHE_NAME（否则用户拿不到新页面）
#    sw.js: const CACHE_NAME = 'wordmatch-v16';  →  'wordmatch-v17'
git add -A && git commit -m "..." && git push
```

> Supabase 配置通过 `build-config.json` 注入；SDK 已本地化到 `vendor/supabase.js`，与站点同源加载（不依赖任何 CDN）。

---

## 词库扩充（expand_vocab.py）

新增词条走「批次源文件 → 合并流水线」，不改 `cards.json` 本身：

```bash
# 1. 在 data/expansion/ 下新建/追加批次文件
#    格式: {"topic":"tech","items":[["en","中文释义","English example","例句翻译","场景标签"], ...]}
python expand_vocab.py --dry     # 试运行: 只看会新增/跳过多少, 不写盘
python expand_vocab.py           # 正式合并 (自动备份到 data/backup/)
python expand_vocab.py --stats   # 查看各主题词条数
python build_index.py            # 重新构建 index.html + dist/
```

- 去重键为 `(en.lower(), topic)` —— 同词同主题跳过，跨主题允许。
- 每次改完记得 bump `sw.js` 的 `CACHE_NAME`，否则已缓存用户拿不到新词库。

---

## 跨设备同步（Supabase）

- **登录**：右上角「登录」用邮箱 + 密码注册（无需邮箱验证）。
- **同步内容**：每张卡的学习状态（熟练度/SRS）、错题本、设置项、跟读得分记录。词库本身不同步（所有人共享同一份）。
- **策略**：在线写 → 本地 IndexedDB 异步推云；离线写 → 入队，联网自动 flush；冲突按 `updated_at` **last-write-wins**。
- **不配置 Supabase 也能用**：顶栏显示「☁ 本地」，进度只存本机 IndexedDB，功能完整。

---

## PWA 与 Service Worker

- **manifest**：`manifest.webmanifest` + 图标（192/512 + maskable），支持「安装到桌面 / 添加到主屏幕」。
- **sw.js（wordmatch-v16）**：
  - 导航请求 **network-first**（在线取最新，离线回退缓存），并注册 `controllerchange` 监听——新 SW 接管后**自动刷新一次**，用户无需手动强刷两次；
  - 静态资源 cache-first。
- **发版铁律**：改代码 / 词库后必须 bump `CACHE_NAME`，否则旧缓存用户看不到更新。

---

## 测试

7 个轻量断言套件（自研 + Node.js，校验已构建的 `index.html`，不读源码），**合计 243 项全绿**为发版门槛：

```bash
node test-app.js        # 阶段 1：MVP 与 6 种玩法
node test-business.js   # 商务卡集成
node test-stage2.js     # 阶段 2：主题/词库数据
node test-stage3.js     # 阶段 3：游戏逻辑 + SRS
node test-stage4.js     # 阶段 4：跟读评分
node test-stage5.js     # 阶段 5：云同步 + PWA
node test-tts.js        # 移动端发音链路（同源 /tts、双引擎路由、长句不误报、发音自检）
```

发布检查清单见 [08-OPS 部署运维手册](./docs/08-OPS-部署运维手册.md)。

---

## 与 pm-english/ 的关系

`life-vocab-app` 是**全新独立项目**，不复用 `pm-english/` 代码，只参考其思路：

- 发音同源代理思路一致（在线 TTS 为主，本地兜底）
- SRS 复习规则沿用：`1 / 2 / 4 / 7 / 15 / 30` 天间隔
- 数据 schema 借鉴：`(m, en, zh, ex, sc, tip)` + `topic` 字段

场景互补：`pm-english/` 攻商务词汇 + 汇报剧本；`life-vocab-app/` 攻生活词汇 + 游戏化碰碰乐。

---

## 故障排查

| 现象 | 处理 |
|---|---|
| 浏览器无声音 | 先点设置页「🔊 发音自检」诊断；检查系统音量 / 标签页是否静音 / 蓝牙耳机连接。在线发音已同源，手机运营商不会拦截 |
| 例句提示"整句在线发音失败"但仍读完 | 多为瞬时网络抖动，已自动降级逐词保底；若频繁，切「仅在线音频」或检查网络 |
| 跟读打不了分 | 需授权麦克风；用 Chrome/Edge（Safari/Firefox 语音识别不完整）；语音识别需联网 |
| 打开是旧版本 | 已支持 `controllerchange` 自动刷新；必要时 Ctrl+F5 强刷（DevTools → Application → Clear site data）|
| 双击 index.html 没反应 | Chrome 因 `file://` 限制可能失败：改用 `python serve.py 8173` 或安装到桌面后用 PWA |
| 想清空进度 | 设置页 → 「重置进度」|

---

## 历史路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | MVP Web + Match | ✅ 完成 |
| 2 | 主题扩充 + Listen/Memory/Gravity + SRS + 错题本 | ✅ 完成 |
| 3 | 录音跟读 + PWA + 进度可视化 | ✅ 完成 |
| 4 | Supabase 云同步（多设备）| ✅ 完成（v1.0.0 归档）|
| 5 | 手机端发音连续修复（同源代理 / 百度主引擎 / 长句误报修复）| ✅ 完成（v1.0.7）|

---

*文档随应用版本（当前 v1.0.7）维护；功能如有更新以应用内实际界面与 [CHANGELOG](./CHANGELOG.md) 为准。*
