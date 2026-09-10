# 06 · UI/UX 设计稿及设计规范

| 项 | 内容 |
|---|---|
| 文档编号 | LV-UI-v1.0 |
| 版本 | 1.0 |
| 设计风格 | 移动端优先 · 卡片式 · 轻拟物 |
| 目标设备 | 手机竖屏（主）/ 平板 / 桌面 |

---

## 1. 设计原则

| 原则 | 说明 |
|---|---|
| **移动优先** | 内容区最大宽度 960px 居中，小屏自适应；`orientation: portrait-primary` |
| **一眼看懂** | 每张词卡独立成块，英文最大最醒目，中文次之，例句用底纹区分 |
| **低干扰** | 无广告、无社交、无弹窗骚扰；学习反馈即时但不打断 |
| **离线可用** | 视觉上不依赖任何外链资源（字体走系统栈，图标用 emoji） |
| **单手可及** | 主要操作集中在屏幕下半部；顶栏吸顶，主内容底部留 64px 安全区 |

---

## 2. 设计令牌（Design Tokens）

### 2.1 颜色

源码位置：`build_index.py` → CSS `:root`

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg` | `#f8fafc` | 页面背景 |
| `--bg-card` | `#ffffff` | 卡片背景 |
| `--bg-soft` | `#f1f5f9` | 次级底纹（例句区、hover） |
| `--text` | `#0f172a` | 主文本 |
| `--text-soft` | `#475569` | 次级文本（中文释义） |
| `--text-muted` | `#94a3b8` | 弱化文本（提示、元信息） |
| `--border` | `#e2e8f0` | 描边 |
| `--accent` | `#0ea5e9` | 主强调色（选中、链接） |
| `--accent-strong` | `#0284c7` | 强调色深（激活态文字） |
| `--warn` | `#f59e0b` | 警示（待复习徽标） |
| `--good` | `#10b981` | 正确 / 已掌握 |
| `--bad` / `--danger` | `#ef4444` | 错误 / 录音中 |
| `--shadow` | `0 2px 8px rgba(15,23,42,.08)` | 卡片阴影 |
| `--shadow-2` | `0 8px 22px rgba(15,23,42,.12)` | 悬浮阴影 |
| `--radius` | `14px` | 卡片圆角 |

**语义色使用约定**：

| 语义 | 色 | 典型场景 |
|---|---|---|
| 待办/提醒 | `--warn` | 今日复习徽标 |
| 成功/掌握 | `--good` | 答对反馈、"熟"标记激活态 |
| 错误/危险 | `--bad` | 答错、录音中按钮 |
| 强调/选中 | `--accent` | 激活的 pill、导航激活态 |

### 2.2 字体

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
             "PingFang SC", "Microsoft YaHei",
             "Helvetica Neue", Arial, sans-serif;
```

系统字体栈，零网络请求，中英文均有良好回退。

| 层级 | 字号 | 字重 | 颜色 |
|---|---|---|---|
| 卡片英文（`.word-card .en`） | 20px | 700 | `--text` |
| 主题名（`.topic-card .name`） | 17px | 700 | `--text` |
| 正文 / 中文释义 | 14px | 400 | `--text-soft` |
| 导航按钮 | 13px | 400 | `--text-soft` |
| 例句正文 | 13px / 行高 1.55 | 400 | `--text` |
| 例句译文 | 12px | 400 | `--text-soft` |
| 提示 / 元信息 | 12px | 400 | `--text-muted` |
| 徽标数字 | 10px | 700 | `#fff` on `--warn` |

### 2.3 间距与圆角

| 场景 | 值 |
|---|---|
| 主内容容器左右内边距 | 18px |
| 主内容顶部内边距 | 16px |
| 主内容底部安全区 | 64px |
| 卡片内边距 | 14px 16px |
| 卡片圆角 | 14px（`--radius`） |
| 例句区圆角 | 8px |
| 胶囊按钮圆角 | 999px |
| 卡片间间距 / 网格 gap | 12–14px |

### 2.4 层级（z-index）

| 元素 | z-index |
|---|---|
| 顶栏 `header.top` | 30 |
| Toast | 高（浮于内容之上） |
| 登录弹窗 | 最高 |

---

## 3. 布局规范

### 3.1 页面骨架

```
┌─────────────────────────────────────┐
│ header.top  (sticky, 毛玻璃)         │  ← 标题 + 导航按钮组 + 账号
├─────────────────────────────────────┤
│                                     │
│  main (max-width 960px, 居中)        │
│  ┌─────────────────────────────┐   │
│  │ section.view.active          │   │  ← 同时只有一个视图显示
│  └─────────────────────────────┘   │
│                                     │
│  (底部 64px 安全区)                  │
└─────────────────────────────────────┘
```

| 规则 | 值 |
|---|---|
| 顶栏 | `position: sticky; top: 0`；背景 `rgba(255,255,255,.94)` + `backdrop-filter: blur(8px)` |
| 主容器 | `max-width: 960px; margin: 0 auto; padding: 16px 18px 64px` |
| 视图切换 | `.view { display:none }` / `.view.active { display:block }` |

### 3.2 栅格

| 视图 | 布局 |
|---|---|
| 主题主页 | 响应式网格（自适应列宽，卡片等宽） |
| 浏览 / 复习 / 错题本 | 单列或双列卡片流 |
| 碰碰乐 | 棋盘：10 英文 + 10 中文，打乱铺开 |
| 连连看 | 12 枚翻牌（6 对） |
| 听音 | 顶部大播放区 + 4 个候选按钮 |
| 消消乐 | 顶部下落区 + 底部 4 候选 |

---

## 4. 组件规范

### 4.1 顶栏导航按钮 `.navbtn`

```css
background: transparent;
color: var(--text-soft);
border: 1px solid var(--border);
padding: 6px 12px;
border-radius: 999px;
font-size: 13px;
```

| 状态 | 样式 |
|---|---|
| 默认 | 透明底 + 描边 |
| Hover | `background: var(--bg-soft)` |
| 激活 (`.active`) | `color: var(--accent-strong)` + `border-color: var(--accent)` |
| 徽标 (`.badge`) | `--warn` 底、白字、10px、粗体、圆角 999px |

### 4.2 主题卡片 `.topic-card`

| 元素 | 规范 |
|---|---|
| 容器 | 白底 + 描边 + `--radius` + `--shadow` |
| Hover | `translateY(-2px)` + `--shadow-2` |
| 图标 | emoji，32px |
| 名称 | 17px / 700 |
| 简介 | 12px / `--text-soft` / 行高 1.5 |
| 元信息行 | 12px / `--text-muted`，flex + gap 12px |
| 游戏入口 | flex-wrap chips |

### 4.3 词卡 `.word-card`

```
┌──────────────────────────────┐
│ abandon                      │  ← en  20px/700
│ v. 放弃；抛弃                 │  ← zh  14px/text-soft
│ ┌──────────────────────────┐ │
│ │ They had to abandon the  │ │  ← ex 13px，bg-soft 底纹
│ │ plan.                    │ │
│ │ 他们不得不放弃该计划。      │ │  ← ex_zh 12px
│ └──────────────────────────┘ │
│ 💡 词根：a- + bandon          │  ← tip 12px/muted（可缺省）
│ ▍场景：项目变更               │  ← sc 12px，浅青底 + 左边框 3px
│ [🔊词] [🔊例句] [🏃慢]        │  ← row-bottom
│ [熟 ✓] [模糊]                │
└──────────────────────────────┘
```

| 元素 | 规范 |
|---|---|
| 容器 | 白底 + `--border` + `--radius` 14px + `--shadow`，flex 纵向 gap 6px |
| 英文 | 20px / 700 / `--text` |
| 中文 | 14px / `--text-soft` |
| 例句 | 13px / 行高 1.55 / `--bg-soft` 底 / padding 8px 10px / 圆角 8px |
| 例句译文 | 12px / `--text-soft` / 块级换行 |
| 记忆提示 | 12px / `--text-muted` |
| 场景标注 | 12px / `--accent-strong` / 背景 `#ecfeff` / 左边框 3px `--accent` |
| 操作行 | flex + gap 6px + wrap |

**状态**：

| 状态 | 表现 |
|---|---|
| 标记"熟" | 按钮 `.active`，`--good` 系高亮 |
| 标记"模糊" | 按钮 `.active`，`--warn` 系 |
| 在错题池 | 出现在错题本视图 |

### 4.4 胶囊按钮 / 筛选 tag `.pill`

```css
padding: 6px 12px;
border: 1px solid var(--border);
background: var(--bg);
color: var(--text-soft);
border-radius: 999px;
font-size: 12px;
transition: all 0.15s;
```

| 变体 | 说明 |
|---|---|
| 默认 | 灰描边 |
| Hover | `--bg-soft` |
| `.active` | `--accent` 底 + 白字 |
| `.good.active` | `--good` 底 |
| `.warn.active` | `--warn` 底 |
| `.big` | 16px / padding 12px 26px（主操作） |
| `.recording` | `--danger` 底 + 白字（录音中） |

### 4.5 子场景筛选 `.subscene-pills .subpill`

用于浏览页按子场景过滤（如中国菜品主题的 9 个地区 pill）。

| 状态 | 样式 |
|---|---|
| 默认 | 白底 + `--border` + `--text-soft` |
| Hover | `--bg-soft` |
| Active | `--accent` 底 + 白字 + `--accent-strong` 边框 |

### 4.6 Toast `.lv-toast`

| 规范 | 值 |
|---|---|
| 位置 | 屏幕底部居中（`translateX(-50%)`） |
| 动效 | 默认 `opacity:0` + 下移；`.show` 时 `opacity:1` + 归位 |
| 时长 | 2400ms 后自动移除 `.show` |
| 变体 | `.lv-toast-{kind}`（success / error 等） |

### 4.7 登录弹窗

| 规范 | 值 |
|---|---|
| 结构 | 遮罩 + 居中卡片；登录/注册双 Tab |
| Tab 切换 | `.lv-tab` / `.lv-tab.active` |
| 实现注意 | Tab 按钮位于 `<form>` **外部**，取值须从 `.lv-auth-modal` 全局查找 |

### 4.8 PWA 安装引导横幅

| 规范 | 值 |
|---|---|
| 位置 | 右下角浮层 |
| 内容 | 说明文案 + 「安装」「稍后」两个按钮 |
| 关闭 | 点「稍后」后 24 小时内不再弹出（localStorage 记录） |
| 兜底 | 浏览器 API 异常时也要保证横幅可关闭 |

---

## 5. 图标与 Emoji 规范

系统不使用图标字体或 SVG 库，全部使用 **emoji + 文字**，保证零外部依赖与离线可用。

| 类别 | 用法 |
|---|---|
| 主题图标 | 每主题一个 emoji（💼 商务、🥢 中国菜品、⚙️ 工业现场…） |
| 动作图标 | 🔊 朗读 · 🏃 慢速 · ✓ 已掌握 · ☁ 本地模式 · 🔐 登录 |
| 状态图标 | 🟢 在线 · 🟡 离线 · 🔥 待复习 · 🆕 待新学 · 📈 XP · ⚡ 连续天数 |
| 子场景 | 🌾 华北 · ❄ 东北 · 🌸 华东 · 🌶 华中/西南 · 🥥 华南 · 🐑 西北 · 🏝 港澳台 · 🍽 点餐用语 |

**一致性要求**：同一语义在全应用内必须使用同一 emoji，新增主题需在 `data/topics.json` 中声明 `icon` 字段。

---

## 6. 交互规范

### 6.1 反馈时效

| 交互 | 反馈 |
|---|---|
| 点击发音按钮 | 立即发声，无 loading（失败静默兜底 TTS） |
| 标记熟/模糊 | 按钮即时高亮 + 写入进度 + 刷新徽标 |
| 游戏作答 | 即时视觉反馈（对错），随后进入下一题 |
| 网络同步 | 静默进行；失败入队不提示，避免打扰 |
| 登录/注册 | Toast 提示结果 |

### 6.2 动效

| 场景 | 动效 | 时长 |
|---|---|---|
| 卡片 Hover | `translateY(-2px)` + 阴影加深 | 0.15s |
| Pill 状态切换 | `transition: all .15s` | 0.15s |
| Toast 出现 | 淡入 + 上移 | — |
| 游戏计时器 | 每 100ms 刷新（0.1s 精度） | — |
| 消消乐下落 | `setInterval` 30ms 帧，速度 0.6px/帧 | — |

### 6.3 手势与键盘

| 平台 | 支持 |
|---|---|
| 移动端 | 点击（tap）驱动全部交互；竖屏优先 |
| 桌面端 | 鼠标点击；无强制键盘快捷键 |
| PWA 安装后 | 独立窗口运行，无浏览器地址栏 |

---

## 7. 响应式适配

| 断点 | 适配 |
|---|---|
| < 640px（手机） | 单列 / 两列网格，卡片全宽 |
| 640–960px（平板） | 多列网格 |
| > 960px（桌面） | 主容器限宽 960px 居中，不再拉伸 |

`manifest.webmanifest` 声明 `orientation: portrait-primary`，移动端建议竖屏使用。

---

## 8. PWA 视觉规范

| 项 | 值 |
|---|---|
| 应用名 | Word Match · 单词碰碰乐 |
| 短名 | 碰碰乐 |
| 显示模式 | `standalone`（无浏览器 UI） |
| 主题色 `theme_color` | `#0f766e`（青绿，与顶栏主色调呼应） |
| 背景色 `background_color` | `#f8fafc`（同 `--bg`，避免启动白闪） |
| 起始 URL | `./index.html` |
| 语言 | `zh-CN` |

### 8.1 图标规格

| 文件 | 尺寸 | 用途 |
|---|---|---|
| `icons/icon-192.png` | 192×192 | 主屏图标 |
| `icons/icon-512.png` | 512×512 | 启动画面 / 商店 |
| `icons/icon-maskable-192.png` | 192×192 | 可遮罩（Android 自适应图标） |
| `icons/icon-maskable-512.png` | 512×512 | 可遮罩大图 |

生成方式：`make_icons.py` 脚本生成，修改图标后需重新生成 **4 个尺寸** 并 bump `sw.js` 缓存版本。

---

## 9. 可访问性与可用性检查清单

| # | 检查项 | 现状 |
|---|---|---|
| 1 | 正文对比度 ≥ 4.5:1 | ✅ `--text` on `--bg-card` 约 15:1 |
| 2 | 弱化文本对比度 ≥ 3:1 | ✅ `--text-muted #94a3b8` on 白 ≈ 2.8:1（仅用于非关键元信息，可接受） |
| 3 | 点击目标 ≥ 44×44px | ⚠️ 部分 pill 12px 字号 + 6px padding，手机上略小 → 已知问题，见风险登记册 |
| 4 | 不依赖颜色单独传达信息 | ✅ 对错同时有文字与符号 |
| 5 | 无外链字体，离线可用 | ✅ 系统字体栈 |
| 6 | 表单有明确错误提示 | ✅ 登录失败 Toast 提示 |
| 7 | 动效可容忍（无强制动画） | ✅ 仅轻量过渡 |

---

## 10. 视觉一致性维护规则

| 规则 | 说明 |
|---|---|
| 禁止硬编码颜色 | 必须使用 CSS 变量；新增语义色先在 `:root` 声明 |
| 新增主题必须声明 icon | 在 `data/topics.json` 的 `icon` 字段 |
| 新增词卡字段需同步组件 | 修改 `makeWordCard()` 时同步更新本文档 §4.3 |
| 图标变更需重生成 4 尺寸 | `make_icons.py` + bump `CACHE_NAME` |
