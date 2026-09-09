# 阶段 5 · 部署与 DevOps

## 部署方案：Cloudflare Pages

> **免备案、零成本、国内可访问**。邮箱注册即可，无需信用卡。
>
> 历史路径：Vercel（`.vercel.app` 大陆受限，已废）→ CloudBase（控制台门槛高，已废）→ **当前统一走 Cloudflare Pages**。

### 优势

| 维度 | 说明 |
|---|---|
| 费用 | 完全免费（无限流量、无限请求、无限构建） |
| 国内访问 | 走 Cloudflare 香港/日本节点，比 Vercel/Netlify 稳，秒开为主 |
| 备案 | 不需要 |
| 部署 | 连 GitHub 自动部署，5 分钟上线 |
| HTTPS | 自动 |
| 客服 | 在线客服 + 庞大社区 |

### 发音策略（浏览器自带 TTS）

`build-config.json` 中 `audio.embed = false` → 构建时剥离卡片 mp3 路径，`speak()` 直接走 `window.speechSynthesis` 兜底，零 404。
`audio/`（2992 个 mp3）**不上传**。以后想恢复高清英音：改 `embed: true` + 重新构建 + 上传 audio/。

### 项目结构

```
life-vocab-app/
├── index.html              # 单文件应用（构建产物，~344KB）
├── manifest.webmanifest    # PWA
├── sw.js                   # Service Worker
├── icons/                  # PWA 图标
├── build-config.json       # 构建配置（Supabase + audio 策略）
├── data/                   # 源数据（开发用，运行时已嵌入 index.html）
├── lib/                    # 阶段5 库（开发用，已嵌入 index.html）
├── supabase/               # SQL schema
├── build_index.py          # 构建脚本
├── gen_audio.py            # TTS 音频生成（按需）
└── test-*.js               # 回归测试
```

### Cloudflare Pages 部署步骤

1. 注册账号：`https://dash.cloudflare.com/sign-up`（邮箱 + 密码，无需信用卡）
2. 创建项目：左侧 `Workers & Pages` → `Create application` → 选 `Pages` 选项卡 → `Connect to Git` → 授权 GitHub → 勾选 `17SiberianWolf/life-vocab-app`
3. 配置（**全部默认/留空**）：
   - Project name: `life-vocab-app`（会得到 `life-vocab-app.pages.dev`）
   - Framework preset: `None`
   - Build command: **留空**（你的 `index.html` 已经是构建产物，直接 serve）
   - Build output directory: `/`
4. 点 `Save and Deploy`，等 1–2 分钟，得到 `https://life-vocab-app.pages.dev`

每次 `git push` 到 main，Cloudflare 自动重新部署。

### 国内访问预期

- 大部分时间能秒开（Cloudflare 走香港/日本节点）
- 偶发 2–3 秒延迟，比 Vercel 那种"经常打不开"强一个量级
- Supabase 后端（境外）的速度是独立问题：登录/同步可能稍慢但通常能通

### 已知风险

1. **Supabase SDK 走 jsdelivr CDN**（`cdn.jsdelivr.net`）：国内可能慢/偶发失败 → 若登录加载异常，把 supabase-js 内联进 index.html
2. **Supabase 后端在境外**：登录/同步速度独立于前端 CDN
3. **Cloudflare Pages 不绑备案域名无法用国内节点**：默认 `*.pages.dev` 走海外节点，速度比国内 CDN 慢一些

---

## 本地开发循环

```bash
# 修改 data/cards.json 或 topics.json 后,重新构建
python build_index.py

# 本地预览（带 no-cache 头,避免缓存旧版本）
python serve.py 8173
# 访问 http://localhost:8173
```

## Git 工作流

```bash
git add -A
git commit -m "feat: 描述改动"
git push
# Cloudflare Pages 自动部署，几秒后 https://life-vocab-app.pages.dev 更新
```

## 发布检查清单

每次发版前：

- [ ] `python build_index.py` 无错
- [ ] `node test-stage5.js` 全过
- [ ] `python serve.py 8173` 起服务，浏览器手动测：
  - [ ] 顶栏右侧能登录/显示云端状态
  - [ ] 玩游戏 → 答题 → 刷新页面 → 进度在（本地模式）
  - [ ] 登录后 → 答题 → 等几秒 → toast「已同步」
  - [ ] 另一台设备登录同账号 → 看到进度
- [ ] Cloudflare Pages 部署成功（push 后自动）

## 已知限制 / 待办

| 项 | 影响 | 临时方案 |
|---|---|---|
| iOS Safari PWA 受限 | 通知/后台不全 | 鼓励 Chrome 安装 |
| Web Speech API 仅 Chrome/Edge | 部分浏览器无录音评分 | 仍有自评三档兜底 |
| RLS 限制 anon key 仅本人行 | 是设计 | 无 |
| 国内访问受 Cloudflare 节点限制 | 比国内 CDN 慢 | 已是最优解（其他更慢） |
| 默认域名 .pages.dev 偶发慢 | 个人用够 | 未来买域名+备案可绑国内节点 |
