# life-vocab-app · 单词碰碰乐

> 面向「CET-6 词汇 + 主题分类 + 配对游戏 + TTS 强化听说」的 Web 学习应用。零构建、双击即用、离线可玩。

## 一句话定位

把生活场景词汇按主题整理，单击「碰碰乐」与英文释义配对，每对成功触发发音——练听、练读、练反应。

---

## 当前进度（阶段 5 · Supabase 云同步 + PWA 增强）

| 维度 | 现状 |
|---|---|
| 主题 | **11 个** —— 商务汇报 💼（置顶） / 厨房 🍳 / 水果 🍎 / 客厅 🛋 / 蔬菜 🥬 / 出行 🚗 / 购物 🛍 / 健康 💊 / 社交 👥 / 餐饮 🍽 / 家居 🏠 |
| 词量 | **748 张**（商务 158 + 10 个生活主题 590） |
| 离线音频 | **2992 个 mp3, 61 MB**（word + example + word_slow + example_slow · 全主题全词） |
| 玩法 | **6 个** —— Browse 浏览 / Match 碰碰乐 / Listen 听音 / Memory 连连看 / Gravity 消消乐 / 🎙 跟读 |
| 跟读 | 顶级 nav「🎙 跟读」+ 主题卡入口：先听原声 → 录音跟读（MediaRecorder）→ 回放对比 → **真实评分（Web Speech API）** + 三档自评（流利/费劲/卡壳）|
| 真实评分 | 录音后弹窗 [📊 评分单词] / [📊 评分例句] 按钮：在线聆听 → 词级命中比对 + 编辑距离模糊匹配 → 0-100 分 + 词级高亮 → ≥80 自动进 SRS known / <50 进 shadow pool / 进度仪表盘显示「发音均分」KPI |
| 进度可视化 | 顶级 nav「📊 进度」：9 项 KPI（含发音均分）+ 各主题掌握度柱状图 + SRS 阶梯分布 + 最近 14 天学习活跃热力 + 学习建议 |
| **云同步**（新）| **Supabase** 后端 + Auth（邮箱注册/登录）→ 任意电脑登录同一账号自动同步进度。RLS 保证数据隔离。 |
| **跨设备同步**（新）| 数据模型：`cards_progress`(每卡每 mode SRS) + `user_settings`(XP/streak/偏好) + `rec_scores`(录音历史) |
| **同步策略**（新）| 在线写：本地 IndexedDB → 异步推云；离线写：入队 + 联网自动 flush；冲突：`updated_at` last-write-wins |
| **PWA 增强**（新）| `manifest.webmanifest` + `sw.js` + 图标（192/512 + maskable） + 自动安装提示（after 24h 关闭抑制） |
| **登录 UI**（新）| 顶栏右侧 🟢 用户名/🔐 登录/☁ 本地模式指示 + 登录/注册 modal（邮箱 + 密码）|
| **存储层重构**（新）| localStorage → IndexedDB（`LVDB` 抽象层，支持 progress/settings/recScores/syncQueue/meta 五表）|
| 商务卡模块 | **12 个 M 模块**：M1 会议开场与收尾 / M2 进度与里程碑 / M3 数据与趋势描述 / M4 风险与问题升级 / M5 资源与人力 / M6 产线与机械设备 / M7 调试与验收 / M8 收款与催款 / M9 范围与变更 / M10 备件与售后 / M11 成本与预算 / M12 干系人与沟通 |
| 商务卡来源 | 来自 `pm-english/cards.md`（HSM/CGL/CCM 连铸连轧改造项目 · 德式汇报风格） |
| 浏览模式 | 商务主题支持 **M1-M12 子模块切换**（顶部 pill 横排，每模块 8-20 张） |
| 卡片字段 | 生活卡：en/zh/ex/ex_zh/tip · 商务卡：en/zh/ex/sc(汇报场景)/tip(沟通要点) |
| SRS | 1 / 2 / 4 / 7 / 15 / 30 天间隔重复，错题连对 2 次才移出 |
| 错题本 | shadow pool：游戏中答错自动入池，按主题筛选 |
| TTS | 浏览器 SpeechSynthesis（en-GB 优先）+ 离线 mp3 兜底 |
| 语速 | 0.85 / 1.0 / 1.2 三档 |
| 进度 | localStorage（兼容）+ IndexedDB（新版）+ Supabase（云端）三处同步 |
| 音频包 | 已为厨房前 10 张生成 mp3（共 40 个文件，约 700KB） |
| 离线 | 数据嵌入 HTML → file:// 协议下双击即可玩；PWA 可安装到桌面 |

---

## 阶段 5 快速上手

### 1. 准备 Supabase 项目（10-15 分钟）

参考 [`supabase/SETUP.md`](./supabase/SETUP.md)：
1. 注册 Supabase 并建项目
2. SQL Editor 跑 `supabase/SCHEMA.sql` 建表
3. Settings → API 复制 PROJECT_URL + anon key

### 2. 本地配置

```bash
cp .env.example .env.local
# 把 SUPABASE_URL 和 SUPABASE_ANON_KEY 填入 .env.local
```

### 3. 重新构建

```bash
python build_index.py       # 注入 Supabase 配置到 index.html
python -m http.server 8080
# 浏览器开 http://localhost:8080 → 顶栏右侧应显示「🔐 登录」按钮(不再「☁ 本地」)
```

### 4. 部署

参考 [`DEPLOY.md`](./DEPLOY.md)：推 GitHub → Vercel → 自动上线。

### 5. 跨设备验证

1. 电脑 A 登录、玩 5 张卡
2. 电脑 B 用同账号登录
3. 应看到卡片已 known 和 SRS 进度一致

> **不配置 Supabase 也可用**：顶栏会显示「☁ 本地」按钮，进度只在本机保留（IndexedDB），但所有功能完整。

---

## 快速上手

### 双击即玩（最简单）

直接双击 `index.html`，Chrome/Edge 会打开本应用。所有 748 张卡片的数据已嵌入，离线也能选主题、浏览词卡、玩 5 个游戏。TTS 默认走浏览器内置语音；前 10 个厨房词有离线 mp3 兜底。

### 预生成离线音频（Windows 推荐用包装脚本）

```cmd
:: 第一次: 安装 edge-tts 到独立 venv
setup.bat

:: 之后: 任意命令都会用 venv 里的 python 跑
run.bat --topic kitchen --limit 5      :: 厨房前 5 张,4 类音频共 20 个 mp3
run.bat --topic fruit --limit 10       :: 水果前 10 张
run.bat                                  :: 全量生成 748 张 (约 60-90 分钟)
run.bat --rewrite                       :: 强制覆盖已有 mp3
```

如果你习惯 Git Bash，等价命令是 `./setup.sh` 与 `./run.sh --topic kitchen`。

### ⚠ 关于 `python` 命令报 `ModuleNotFoundError: No module named 'edge_tts'`

这是 **Python 解释器不一致** 导致的典型问题，不是脚本 bug：

- Windows 上 PowerShell 里默认的 `python` 通常是**系统安装的 Python**（如 3.14.5）
- 而 `edge-tts` 装在 **WorkBuddy 托管的 venv** 里（`C:\Users\Administrator\.workbuddy\binaries\python\envs\life-vocab\Scripts\python.exe`）
- 二者包不互通，所以在 cmd 里 `python gen_audio.py` 会报找不到 edge_tts

**解决（任选其一）**：

1. **最简单**：用项目自带的包装脚本
   - `run.bat` 已自动用 venv python，**直接用 `run.bat` 替代 `python gen_audio.py`** 即可
2. **指定绝对路径**跑：
   ```cmd
   "C:\Users\Administrator\.workbuddy\binaries\python\envs\life-vocab\Scripts\python.exe" gen_audio.py --topic kitchen --limit 5
   ```
3. **重新做一次环境**：`setup.bat` 会自动检测并重建 venv

### 本地 HTTP 服务器（推荐，数据最新）

如果修改了 `data/cards.json`，需要重新生成 `index.html`：

```bash
cd life-vocab-app
python build_index.py
python -m http.server 8080
# 访问 http://localhost:8080
```

> `build_index.py` 会把 `data/cards.json` 与 `data/topics.json` 嵌入到 `index.html` 的 `<script id="appData">` 块内。

---

## 项目结构

```
life-vocab-app/
├── index.html              # 单文件 Web 应用(数据已嵌入)
├── build_index.py          # 数据嵌入构建脚本
├── gen_audio.py            # edge-tts 批量音频生成
├── data/
│   ├── topics.json         # 主题配置
│   └── cards.json          # 卡片数据(590 张)
├── audio/                  # 离线 mp3
│   ├── word/{topic}/{id}.mp3        常速词
│   ├── example/{topic}/{id}.mp3     常速例句
│   ├── slow/{topic}/{id}_w.mp3      0.85 倍速词
│   └── slow/{topic}/{id}_e.mp3      0.85 倍速例句
├── test-app.js           # 阶段 1 JS 启动验证(Node + mock DOM)
├── test-stage2.js        # 阶段 2 综合验证脚本
└── README.md
```

---

## 每日 30 分钟节奏建议

| 时段 | 做什么 |
|---|---|
| 0-5 min  热身 | 打开「今日复习」先看 2-3 张 due 卡 |
| 5-15 min 听力 | 玩 1 轮 Listen 听音（4 选 1）专攻辨音 |
| 15-25 min 综合 | 玩 2-3 轮 Match / Memory / Gravity 任选 |
| 25-30 min 复盘 | 标记「熟/模糊」，错题自动进 shadow pool |

---

## 5 个游戏与 SRS

### 5 个游戏

| 入口 | 玩法 | 强化能力 |
|---|---|---|
| **Browse** 浏览 | 词卡 en/zh/例句 + TTS + 三态标记 | 慢速精读 |
| **Match** 碰碰乐 | 8-10 词配对（en↔zh） | 反应+反应记忆 |
| **Listen** 听音 | TTS 读词，4 选 1 | **听力辨音**（你重点要练的） |
| **Memory** 连连看 | n×n 网格翻牌，en+zh 配对消除 | 视觉记忆 |
| **Gravity** 消消乐 | 词下落，4 选释义，选对加分+连击，选错扣血 | 限时反应+压力 |

### SRS 间隔复习（今日复习入口）

- 每个卡有 `reps`（连续 known 次数），按下表安排下次复习：

| reps | 1 | 2 | 3 | 4 | 5 | ≥6 |
|---|---|---|---|---|---|---|
| next_due | 1d | 2d | 4d | 7d | 15d | 30d |

- 答对 +1 reps，答错或模糊 → reps=0，next_due=1d
- 错题连对 2 次才正式移出 shadow pool
- 顶部 nav 角标实时显示待复习 / 错题数量

### 错题本（shadow pool）

- 游戏中答错自动入池
- 按主题筛选（仅显示有错题的主题）
- 连续 2 次答对才移出

### 真实发音评分（🎙 跟读页内）

- **触发方式**：跟读页录音后，弹窗底部有 [📊 评分单词] / [📊 评分例句] 两个按钮（基于 Web Speech API，需联网，Chrome/Edge 完整支持）
- **流程**：点击评分 → 浏览器再次聆听你的朗读 → 实时转写 → 与原文逐词比对 → 0-100 分
- **评分规则**：
  - 单词级匹配（忽略大小写、标点）
  - 编辑距离 ≤ 1 的近似词给 0.7 权重（如 aple → apple）
  - 满分 100，0 分全错
  - 例句长文本的丢分更细致
- **自动联动 SRS**：
  - 评分 ≥ 80 → 自动进 known（奖励 6 XP）
  - 评分 < 50 → 自动进 shadow pool（奖励 2 XP）
  - 50-79 → 仅记录，不进 SRS
- **进度追踪**：
  - 每个卡的最高分/最近分/尝试次数/最近 5 次历史
  - 进度仪表盘新增 **「发音均分」** KPI 卡片（按颜色编码：绿 ≥80 / 黄 ≥50 / 红 <50）
- **优雅降级**：
  - 浏览器不支持 Web Speech API → 按钮不显示，仅留自评三档
  - 离线环境 → 同上，不影响录音回放和自评

---

## TTS 工作机制

`index.html` 内置的 `speak(text, slow)` 函数：

1. **优先本地 mp3**（如果 `gen_audio.py` 已为该词生成）：`<audio src="audio/word/kitchen/1.mp3">`
2. **否则浏览器 SpeechSynthesis**：`SpeechSynthesisUtterance` 走 `en-GB`（可在设置切换 `en-US`）
3. **语速**：`0.85` / `1.0` / `1.2`，通过 `<audio>.playbackRate` 与 `utterance.rate` 同时控制

音色默认 `en-GB-RyanNeural`，与 `pm-english/` 项目一致——贴合欧陆商务英语习惯。`gen_audio.py` 支持 `--voice` 切换。

---

## 音频生成

### 全量生成（590 张 × 4 ≈ 2360 个 mp3，约 50-70 分钟）

```bash
pip install edge-tts
python gen_audio.py            # 全部主题、全部卡片、覆盖已存在的
python gen_audio.py --rewrite  # 强制重新生成
```

### 按主题 / 限量

```bash
python gen_audio.py --topic kitchen --limit 10   # 仅厨房前 10 张
python gen_audio.py --topic fruit                 # 水果全部
python gen_audio.py --voice en-US-GuyNeural      # 切换音色
python gen_audio.py --rate-slow "-20%"           # 慢速档降到 -20%
```

### 数据更新后必须重新构建 HTML

```bash
# 1. 修改 data/cards.json / data/topics.json
# 2. 跑音频（如新增了词）
python gen_audio.py
# 3. 重新嵌入
python build_index.py
```

---

## 后续阶段（计划）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | MVP Web + Match | ✅ 完成（240 张 / 3 主题） |
| 2 | 主题扩充 + Listen/Memory/Gravity + SRS + 错题本 | ✅ **当前**（590 张 / 10 主题） |
| 3 | 录音跟读 + PWA + 进度可视化 | ⏳ 待启动 |
| 4 | Tauri 桌面封装 | ⏳ 待 Rust 工具链就绪 |

---

## 与 pm-english/ 的关系

`life-vocab-app` 是**全新独立项目**，不复用 `pm-english/` 的代码，只**参考其思路**：

- TTS 引擎与音色保持一致：`edge-tts + en-GB-RyanNeural`
- SRS 复习规则沿用：`1 / 2 / 4 / 7 / 15 / 30` 天间隔
- 数据 schema 借鉴：`(m, en, zh, ex, sc, tip)` + 加 `topic` 字段

具体应用场景互补：

- `pm-english/` —— 商务场景词汇 + 汇报剧本 + 40 天计划（向德国老板汇报）
- `life-vocab-app/` —— 生活场景词汇 + 游戏化碰碰乐（日常口语+听力）

---

## 故障排查

| 现象 | 处理 |
|---|---|
| 浏览器无声音 | 第一次需要联网下载 SpeechSynthesis 语音包；如果需要完全离线，先跑 `gen_audio.py` 全量生成 |
| 双击 index.html 没反应 | Chrome 可能因 `<audio>` 的 file:// 路径失败：改用 `python -m http.server` |
| 想换音色 | `python gen_audio.py --voice en-US-GuyNeural`，重新生成后 `python build_index.py` |
| 想清空进度 | 设置页 → 「重置进度」 |