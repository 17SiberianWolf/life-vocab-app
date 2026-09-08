# 阶段 5 · 部署与 DevOps

## 文件结构

```
life-vocab-app/
├── index.html               # 由 build_index.py 生成的最终单文件应用
├── data/                    # 源数据 (cards.json / topics.json)
├── lib/                     # 阶段 5 新增:db / sync / auth-ui / install-prompt
├── audio/                   # edge-tts 预生成 mp3 (可选,提升离线体验)
├── icons/                   # PWA 图标
├── supabase/                # 阶段 5 新增:SQL schema + setup 指南
│   ├── SCHEMA.sql
│   └── SETUP.md
├── build-config.json        # 构建配置(含 Supabase enabled 开关)
├── .env.local               # 本地敏感配置(不提交 git)
├── .env.example             # 配置示例
├── build_index.py           # 构建脚本
├── test-stage5.js           # 阶段 5 测试
├── vercel.json              # Vercel 部署配置
├── README.md
└── DEPLOY.md                # 本文件
```

---

## 本地开发循环

```bash
# 1. 第一次: 配置 Supabase(见 supabase/SETUP.md)
cp .env.example .env.local
# 编辑 .env.local,填入 PROJECT_URL + ANON_KEY

# 2. 修改 data/cards.json 或 topics.json 后,重新构建
python build_index.py

# 3. 本地预览
python -m http.server 8080
# 访问 http://localhost:8080
```

## 部署到 Vercel

> **配置来源说明**:Supabase 的 URL + anon key 已经写在 `build-config.json`(已提交 git)。
> 构建时 `build_index.py` 会把它们注入 `index.html`,**无需**在 Vercel 里单独设环境变量。
> anon/publishable key 是设计上可公开的(RLS 保证数据只属于本人),提交它安全;
> 唯一绝不能进前端/仓库的是 `service_role` / `sb_secret_` key。

### 一次性配置

1. 把代码 push 到 GitHub(见下方 Git 小节)
2. https://vercel.com → **Add New → Project** → 导入 GitHub 仓库 `life-vocab-app`
3. 框架自动识别为 "Other"(读取 `vercel.json`),直接点 **Deploy**(无需改任何设置)

### 自动部署

每次 push 到 `main` 分支,Vercel 自动跑 `python3 build_index.py` 重新构建并部署。
PR 可生成 Preview URL,适合先看效果再合并。

### 关于音频(当前未部署)

`audio/`(61MB mp3)被 `.gitignore` 排除,**线上用浏览器 TTS 发音兜底**(功能正常)。
之后想上离线高清英音,两个办法:
- 把 `audio/` 从 `.gitignore` 去掉、`git add audio`、重新 push(仓库变大);
- 或上传到 Supabase Storage(免费 1GB)并改 `speak()` 里的音频 URL 指向 CDN。

### 自定义域名

Vercel → Settings → Domains → 添加 `vocab.yourdomain.com`

---

## Git 化(本地→GitHub)

### 初始化

```bash
cd life-vocab-app
git init
git add -A
git commit -m "init: 阶段 5 (云同步 + 登录 + PWA)"
git branch -M main
git remote add origin https://github.com/<your-name>/life-vocab-app.git
git push -u origin main
```

### 后续迭代

```bash
# 改完代码
python build_index.py        # 重新生成 index.html
git add -A
git commit -m "feat: 增加 X 功能"
git push                       # Vercel 自动部署
```

---

## 发布检查清单

每次发版前:

- [ ] `python build_index.py` 无错
- [ ] `node test-stage5.js` 全过
- [ ] `python -m http.server` 起服务,浏览器手动测:
  - [ ] 双击 `index.html` 能打开(file:// 直开也可)
  - [ ] 顶栏右侧能登录/显示云端状态
  - [ ] 玩游戏 → 答题 → 刷新页面 → 进度在(本地模式)
  - [ ] 登录后 → 答题 → 等几秒 → toast「已同步」
  - [ ] 另一台设备登录同账号 → 看到进度
- [ ] Supabase Dashboard → Table Editor → `cards_progress` 应有新行
- [ ] 离线场景(DevTools → Application → Service Workers → Offline):
  - [ ] 仍能打开
  - [ ] 答案暂存
  - [ ] 联网时自动 flush(toast「离线写已同步」)

---

## 已知限制 / 待办

| 项 | 影响 | 临时方案 |
|---|---|---|
| iOS Safari PWA 受限 | 通知/后台不全 | 鼓励 Chrome 安装 |
| Web Speech API 仅 Chrome/Edge | 部分浏览器无录音评分 | 仍有自评三档兜底 |
| RLS 限制 anon key 仅本人行 | 是设计 | 无 |
| 单文件 482KB | 首次打开略慢 | audio 按需懒加载 |
