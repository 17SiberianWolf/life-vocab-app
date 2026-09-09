# -*- coding: utf-8 -*-
"""
life-vocab-app 构建脚本 (阶段 2)

读取:
  data/topics.json + data/cards.json
输出:
  index.html   单文件 Web 应用,数据已嵌入,双击即可玩

阶段 2 新增:
  - 5 个游戏:Browse / Match / Listen / Memory / Gravity
  - SRS 间隔复习 (1/2/4/7/15/30 天)
  - 错题本 (shadow pool)
  - 10 个主题,590 张卡

用法:
  python build_index.py
  python build_index.py --data-dir data --out index.html
"""
import argparse
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------- HTML 模板 ----------
# 占位符: __APP_DATA_JSON__
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f766e">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<title>单词碰碰乐 · life-vocab-app</title>
<style>
  :root {
    --bg: #f8fafc;
    --bg-card: #ffffff;
    --bg-soft: #f1f5f9;
    --text: #0f172a;
    --text-soft: #475569;
    --text-muted: #94a3b8;
    --border: #e2e8f0;
    --accent: #0ea5e9;
    --accent-strong: #0284c7;
    --warn: #f59e0b;
    --good: #10b981;
    --bad: #ef4444;
    --danger: #ef4444;
    --shadow: 0 2px 8px rgba(15,23,42,.08);
    --radius: 14px;
    --shadow-2: 0 8px 22px rgba(15,23,42,.12);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei",
      "Helvetica Neue", Arial, sans-serif; -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility; }
  button { font-family: inherit; }
  a { color: var(--accent); text-decoration: none; }

  /* 顶栏 */
  header.top {
    position: sticky; top: 0; z-index: 30;
    background: rgba(255,255,255,.94); backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
    padding: 10px 18px; flex-wrap: wrap;
  }
  header.top .brand { font-weight: 700; font-size: 18px; color: var(--text); letter-spacing: -.3px; }
  header.top .brand .accent { color: var(--accent); }
  header.top .spacer { flex: 1; }
  header.top .navbtn {
    background: transparent; color: var(--text-soft); border: 1px solid var(--border);
    padding: 6px 12px; border-radius: 999px; cursor: pointer; font-size: 13px;
  }
  header.top .navbtn:hover { background: var(--bg-soft); }
  header.top .navbtn.active { color: var(--accent-strong); border-color: var(--accent); }
  header.top .navbtn .badge { background: var(--warn); color:#fff; font-size:10px; padding: 1px 6px; border-radius: 999px; margin-left: 4px; font-weight: 700; }

  main { max-width: 960px; margin: 0 auto; padding: 16px 18px 64px; }
  .view { display: none; }
  .view.active { display: block; }

  /* 主题卡片网格 */
  .topic-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;
  }
  .topic-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px;
    box-shadow: var(--shadow); transition: transform .15s ease, box-shadow .15s ease;
  }
  .topic-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); }
  .topic-card .icon { font-size: 32px; line-height: 1; }
  .topic-card .name { margin-top: 6px; font-weight: 700; font-size: 17px; }
  .topic-card .blurb { margin-top: 6px; font-size: 12px; color: var(--text-soft); line-height: 1.5; }
  .topic-card .meta { margin-top: 10px; font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; }
  .topic-card .meta b { color: var(--text-soft); }
  .topic-card .games { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
  .game-btn {
    display: inline-flex; align-items: center; gap: 4px;
    border: 1px solid var(--border); border-radius: 999px;
    padding: 4px 10px; font-size: 12px; background: var(--bg-card); color: var(--text-soft);
    cursor: pointer; user-select: none;
  }
  .game-btn:hover { background: var(--bg-soft); }
  .game-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .game-btn.primary:hover { background: var(--accent-strong); }

  /* 词卡浏览 */
  .card-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .word-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow);
    display: flex; flex-direction: column; gap: 6px;
  }
  .word-card .en { font-size: 20px; font-weight: 700; color: var(--text); }
  .word-card .zh { font-size: 14px; color: var(--text-soft); margin-top: 2px; }
  .word-card .ex { margin-top: 6px; font-size: 13px; line-height: 1.55; color: var(--text); background: var(--bg-soft); padding: 8px 10px; border-radius: 8px; }
  .word-card .ex .ex_zh { display: block; color: var(--text-soft); margin-top: 4px; font-size: 12px; }
  .word-card .tip { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  .word-card .sc { font-size: 12px; color: var(--accent-strong); margin-top: 4px; padding: 4px 8px; background: #ecfeff; border-left: 3px solid var(--accent); border-radius: 4px; }
  .subscene-pills .subpill { padding: 6px 12px; border: 1px solid var(--border); background: var(--bg); color: var(--text-soft); border-radius: 999px; cursor: pointer; font-size: 12px; transition: all 0.15s; }
  .subscene-pills .subpill:hover { background: var(--bg-soft); }
  .subscene-pills .subpill.active { background: var(--accent); color: white; border-color: var(--accent-strong); }
  .word-card .row-bottom { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    border: 1px solid var(--border); border-radius: 999px;
    padding: 4px 10px; font-size: 12px; background: var(--bg-card); color: var(--text-soft);
    cursor: pointer; user-select: none;
  }
  .pill:hover { background: var(--bg-soft); }
  .pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .pill.good.active { background: var(--good); border-color: var(--good); }
  .pill.warn.active { background: var(--warn); border-color: var(--warn); }

  /* Match / Memory / Gravity 公共棋盘 */
  .match-board, .memory-board, .listen-board {
    display: grid; gap: 12px;
  }
  .match-board, .listen-board { grid-template-columns: repeat(2, 1fr); }
  .memory-board { grid-template-columns: repeat(4, 1fr); }

  .match-card, .memory-card, .listen-option {
    background: var(--bg-card); border: 2px solid var(--border);
    border-radius: var(--radius); padding: 14px 12px; min-height: 86px;
    cursor: pointer; user-select: none;
    display: flex; align-items: center; justify-content: center;
    text-align: center; font-size: 16px; font-weight: 600;
    transition: transform .12s ease, background .15s ease, border-color .15s ease, opacity .25s ease;
  }
  .match-card:hover, .listen-option:hover { transform: translateY(-1px); }
  .match-card.selected, .listen-option.selected { border-color: var(--accent); background: #e0f2fe; }
  .match-card.matched, .listen-option.matched { background: #d1fae5; border-color: var(--good); opacity: .55; pointer-events: none; }
  .match-card.wrong, .listen-option.wrong { background: #fee2e2; border-color: var(--bad); animation: shake .35s; }
  .memory-card { padding: 0; }
  .memory-card .memory-face {
    width: 100%; height: 100%; min-height: 80px;
    display: flex; align-items: center; justify-content: center;
    border-radius: var(--radius);
    background: var(--bg-soft); color: var(--text-muted);
    font-size: 24px; user-select: none; padding: 10px;
    text-align: center; line-height: 1.3;
  }
  .memory-card.flipped .memory-face { background: #fef3c7; color: var(--text); font-size: 16px; font-weight: 600; }
  .memory-card.matched .memory-face { background: #d1fae5; color: var(--good); }
  @keyframes shake {
    0% { transform: translateX(0); } 25% { transform: translateX(-6px); }
    50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } 100% { transform: translateX(0); }
  }
  .match-card small, .listen-option small { display: block; font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 400; }

  /* Listen 中心发音区 */
  .listen-stage {
    text-align: center; padding: 24px; background: var(--bg-card);
    border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px;
    box-shadow: var(--shadow);
  }
  .listen-stage .play-btn {
    background: var(--accent); color: #fff; border: none;
    width: 76px; height: 76px; border-radius: 50%; font-size: 30px;
    cursor: pointer; box-shadow: var(--shadow-2);
    transition: transform .15s ease, background .15s ease;
  }
  .listen-stage .play-btn:hover { background: var(--accent-strong); transform: scale(1.05); }
  .listen-stage .play-btn.playing { background: var(--warn); }
  .listen-stage .prompt { color: var(--text-soft); margin-top: 10px; font-size: 13px; }
  .listen-stage .reveal { font-size: 22px; font-weight: 700; color: var(--text); margin-top: 8px; min-height: 30px; }

  /* Gravity 玩法 */
  .gravity-stage {
    position: relative; height: 280px; background: var(--bg-soft);
    border: 1px dashed var(--border); border-radius: var(--radius);
    overflow: hidden; margin-bottom: 16px;
  }
  .gravity-falling {
    position: absolute; left: 50%; transform: translateX(-50%);
    background: var(--bg-card); padding: 10px 18px;
    border: 2px solid var(--accent); border-radius: 999px;
    font-size: 18px; font-weight: 700; color: var(--text);
    box-shadow: var(--shadow);
    white-space: nowrap;
  }
  .gravity-options {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
  }

  /* 状态条 */
  .game-stats {
    display: flex; gap: 18px; align-items: center; padding: 10px 0;
    font-size: 14px; color: var(--text-soft); flex-wrap: wrap;
  }
  .game-stats b { color: var(--text); }

  /* 设置面板 */
  .panel {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 18px; box-shadow: var(--shadow);
  }
  .panel h3 { margin: 0 0 10px; font-size: 14px; color: var(--text); }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .row label { font-size: 13px; color: var(--text-soft); display: inline-flex; gap: 6px; align-items: center; }
  .row select, .row input[type=range] { font-size: 13px; }

  /* ===== 录音跟读视图 ===== */
  .rec-mode-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .rec-mode-row .navbtn.active { background: var(--accent); color: #fff; border-color: var(--accent-strong); }
  .rec-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 18px 20px; box-shadow: var(--shadow); margin-bottom: 14px;
  }
  .rec-en { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
  .rec-zh { font-size: 15px; color: var(--text-soft); margin-top: 4px; }
  .rec-ex { font-size: 14px; color: var(--text); background: var(--bg-soft); padding: 10px 12px; border-radius: 8px; margin-top: 10px; line-height: 1.6; }
  .rec-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .rec-stage { text-align: center; padding: 18px; background: var(--bg-soft); border-radius: var(--radius); margin-bottom: 14px; }
  .rec-meter { font-size: 13px; color: var(--text-soft); margin-bottom: 12px; }
  .rec-meter.recording { color: var(--danger); font-weight: 700; }
  .pill.big { font-size: 16px; padding: 12px 26px; }
  .pill.recording { background: var(--danger); color: #fff; }
  .rec-result { min-height: 40px; margin-bottom: 14px; }
  .rec-result .selfrate { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  /* 真实评分结果 */
  .rec-result .score-badge {
    display: inline-block; padding: 6px 14px; border-radius: 999px;
    font-weight: 800; font-size: 18px; margin: 6px 0;
  }
  .rec-result .score-badge.s-good { background: #d1fae5; color: #065f46; }
  .rec-result .score-badge.s-mid  { background: #fef3c7; color: #92400e; }
  .rec-result .score-badge.s-bad  { background: #fee2e2; color: #991b1b; }
  .rec-result .scored-target {
    background: var(--bg-soft); padding: 12px 14px; border-radius: 8px;
    margin: 8px 0; font-size: 16px; line-height: 2;
  }
  .rec-result .scored-target .w { padding: 1px 5px; border-radius: 4px; margin-right: 2px; }
  .rec-result .scored-target .w.hit   { background: #bbf7d0; color: #065f46; }
  .rec-result .scored-target .w.miss  { background: #fecaca; color: #991b1b; text-decoration: line-through; }
  .rec-result .scored-target .w.extra { background: #e0e7ff; color: #3730a3; }
  .rec-result .score-tr { color: var(--text-soft); font-size: 12px; margin-top: 6px; }
  .rec-result .score-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .rec-result .listening {
    background: #dbeafe; color: #1e40af; padding: 10px 14px; border-radius: 8px;
    font-size: 14px; font-weight: 600; text-align: center;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.55;} }
  .rec-result .score-history { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .rec-nav { display: flex; justify-content: space-between; align-items: center; gap: 8px; }

  /* ===== 进度可视化视图 ===== */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .kpi-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 14px; box-shadow: var(--shadow);
  }
  .kpi-card .kpi-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .kpi-card .kpi-value { font-size: 26px; font-weight: 800; color: var(--text); margin-top: 2px; }
  .kpi-card .kpi-sub { font-size: 11px; color: var(--text-soft); margin-top: 2px; }
  canvas { display: block; max-width: 100%; }
  canvas.chart-canvas { width: 100%; height: 200px; }
  canvas#activityChart.chart-canvas { height: 90px; }
  .srs-ladder { display: flex; flex-wrap: wrap; gap: 8px; }
  .srs-ladder .ladder-item {
    display: flex; flex-direction: column; align-items: center; padding: 10px 12px;
    background: var(--bg-soft); border-radius: 8px; min-width: 74px;
  }
  .srs-ladder .ladder-count { font-size: 22px; font-weight: 800; color: var(--accent-strong); }
  .srs-ladder .ladder-label { font-size: 11px; color: var(--text-soft); margin-top: 2px; }


  .streak {
    display: inline-flex; align-items: center; gap: 6px;
    background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 700;
  }
  .xp-bar {
    height: 8px; background: var(--bg-soft); border-radius: 999px; overflow: hidden;
    flex: 1; min-width: 120px;
  }
  .xp-bar > div { height: 100%; background: linear-gradient(90deg, var(--accent), #38bdf8); transition: width .3s ease; }

  .pager { display: flex; gap: 10px; align-items: center; justify-content: center; margin-top: 18px; }
  .pager button {
    background: var(--bg-card); border: 1px solid var(--border); padding: 6px 14px;
    border-radius: 999px; cursor: pointer; font-size: 13px; color: var(--text-soft);
  }
  .pager button:hover { background: var(--bg-soft); }
  .pager button:disabled { opacity: .5; cursor: not-allowed; }

  /* SRS / 错题本列表 */
  .srs-card-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 18px; }
  .filter-bar .pill.active { background: var(--accent); color: #fff; }

  /* 视图标题 */
  .view-title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
  .view-title-row h2 { margin:0; font-size:20px; }

  /* 大按钮(主操作) */
  .big-cta {
    background: var(--accent); color: #fff; border: none;
    padding: 12px 24px; border-radius: var(--radius); font-size: 15px;
    cursor: pointer; font-weight: 600; box-shadow: var(--shadow);
  }
  .big-cta:hover { background: var(--accent-strong); }
  .big-cta:disabled { background: var(--text-muted); cursor: not-allowed; }

  @media (max-width: 600px) {
    .match-board, .listen-board { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .memory-board { grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .match-card, .listen-option { padding: 10px 8px; min-height: 72px; font-size: 14px; }
    main { padding: 12px; }
    header.top { padding: 8px 12px; }
    .word-card { padding: 12px; }
    .game-btn { font-size: 11px; padding: 3px 8px; }
  }

  /* ===== 阶段 5 · 同步 / 登录 / PWA 安装 ===== */
  .lv-account-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--accent); color: #fff; padding: 4px 10px;
    border-radius: 999px; font-size: 12px; font-weight: 600;
  }
  .lv-mode-local { color: var(--warn) !important; border-color: var(--warn) !important; }
  .lv-mode-cloud { color: var(--accent-strong) !important; border-color: var(--accent) !important; }
  .lv-toast {
    position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 14px);
    background: rgba(15, 23, 42, .92); color: #fff; padding: 10px 18px;
    border-radius: 999px; font-size: 14px; z-index: 100; max-width: 90vw;
    box-shadow: 0 8px 22px rgba(0,0,0,.18);
    opacity: 0; transition: opacity .25s ease, transform .25s ease;
    pointer-events: none;
  }
  .lv-toast.show { opacity: 1; transform: translate(-50%, 0); }
  .lv-toast-ok   { background: rgba(16, 185, 129, .95); }
  .lv-toast-warn { background: rgba(245, 158, 11, .95); }
  .lv-toast-err  { background: rgba(239, 68, 68, .95); }

  .lv-auth-modal {
    position: fixed; inset: 0; z-index: 80;
    display: flex; align-items: center; justify-content: center;
  }
  .lv-modal-backdrop {
    position: absolute; inset: 0;
    background: rgba(15, 23, 42, .45);
  }
  .lv-modal-panel {
    position: relative; background: var(--bg-card);
    border-radius: 18px; padding: 22px 26px;
    width: min(380px, 90vw); box-shadow: 0 20px 50px rgba(0,0,0,.25);
    z-index: 1; animation: lv-pop .2s ease;
  }
  @keyframes lv-pop { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .lv-modal-panel h3 { margin: 0 0 14px; font-size: 19px; color: var(--text); }
  .lv-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
  .lv-tab {
    flex: 1; padding: 8px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text-soft);
    border-radius: 8px; cursor: pointer; font-size: 13px;
  }
  .lv-tab.active { background: var(--accent); color: #fff; border-color: var(--accent-strong); }
  .lv-modal-panel input[type=email], .lv-modal-panel input[type=password] {
    width: 100%; padding: 10px 12px; margin-bottom: 10px;
    border: 1px solid var(--border); border-radius: 8px;
    font-size: 14px; font-family: inherit; background: var(--bg);
  }
  .lv-primary-btn {
    width: 100%; padding: 11px; background: var(--accent);
    color: #fff; border: none; border-radius: 8px;
    font-size: 14px; cursor: pointer; font-weight: 600;
    font-family: inherit;
  }
  .lv-primary-btn:hover { background: var(--accent-strong); }
  .lv-primary-btn:disabled { background: var(--text-muted); cursor: not-allowed; }
  .lv-auth-error {
    color: var(--bad); font-size: 13px; min-height: 18px; margin-top: 8px;
  }
  .lv-hint {
    font-size: 12px; color: var(--text-muted);
    margin: 12px 0 0; line-height: 1.5;
  }

  .lv-install-banner {
    position: fixed; right: 16px; bottom: 16px; z-index: 70;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 16px;
    box-shadow: var(--shadow-2);
    display: flex; gap: 14px; align-items: center;
    transform: translateY(120%); transition: transform .35s cubic-bezier(.2,.8,.4,1);
  }
  .lv-install-banner.show { transform: translateY(0); }
  .lv-install-text { display: flex; flex-direction: column; }
  .lv-install-text strong { color: var(--text); font-size: 13px; }
  .lv-install-text span { color: var(--text-soft); font-size: 11px; }
  .lv-install-actions { display: flex; gap: 6px; }
  .lv-btn {
    border: 1px solid var(--border); background: var(--bg-card);
    color: var(--text-soft); padding: 6px 12px; border-radius: 8px;
    cursor: pointer; font-size: 12px; font-family: inherit;
  }
  .lv-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent-strong); }
  .lv-btn-ghost { background: transparent; }
</style>
</head>
<body>

<header class="top">
  <div class="brand"><span class="accent">单词</span>碰碰乐</div>
  <button class="navbtn" data-go="topics">主题</button>
  <button class="navbtn" data-go="srs">今日复习<span class="badge" id="srsBadge" style="display:none;">0</span></button>
  <button class="navbtn" data-go="errors">错题本<span class="badge" id="errBadge" style="display:none;">0</span></button>
  <button class="navbtn" data-go="record">🎙 跟读</button>
  <button class="navbtn" data-go="progress">📊 进度</button>
  <div class="spacer"></div>
  <span id="account-slot"></span>
  <span class="streak" id="streakBadge">⚡ 0 天连续</span>
  <span id="xpBadge" style="font-size:12px; color: var(--text-soft);">XP 0</span>
  <button class="navbtn" data-go="settings">设置</button>
</header>

<main>

  <!-- 主题选择 -->
  <section id="view-topics" class="view active">
    <h2 style="margin-top:8px; margin-bottom:6px; font-size:22px;">选择一个主题</h2>
    <p style="color: var(--text-soft); margin-top:0; margin-bottom:18px; font-size:14px;">
      <span id="topicsSummary">点击主题进入 6 种玩法。</span>
    </p>
    <div class="topic-grid" id="topicGrid"></div>
  </section>

  <!-- 词卡浏览 -->
  <section id="view-browse" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2 id="browseTitle">主题</h2>
      <div class="spacer" style="flex:1;"></div>
      <button class="navbtn" id="btnBrowseView">浏览</button>
    </div>
    <div class="subscene-pills" id="browseSubscenes" style="display:none; gap:6px; flex-wrap:wrap; padding: 0 4px 8px;"></div>
    <div class="card-list" id="cardList"></div>
    <div class="pager">
      <button id="prevPage">上一页</button>
      <span id="pageInfo" style="font-size:13px; color: var(--text-soft);"></span>
      <button id="nextPage">下一页</button>
    </div>
  </section>

  <!-- 5 个游戏视图 (Match / Listen / Memory / Gravity / Browse) -->

  <section id="view-match" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2 id="matchTitle">Match 碰碰乐</h2>
    </div>
    <div class="game-stats">
      <div>本轮词数:<b id="matchRoundSize">8</b></div>
      <div>用时:<b id="matchTimer">0.0s</b></div>
      <div>错误:<b id="matchErrors">0</b></div>
      <div>得分:<b id="matchScore">0</b></div>
      <button class="navbtn" id="matchRestart">重新开始</button>
      <button class="navbtn" id="matchSpeakEn">听本轮词</button>
    </div>
    <div class="match-board" id="matchBoard"></div>
    <p style="margin-top:14px; font-size:13px; color: var(--text-soft);">
      点英文卡后点中文释义。配对成功触发听力;答错会自动加入错题本。
    </p>
  </section>

  <section id="view-listen" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2 id="listenTitle">Listen 听音</h2>
    </div>
    <div class="listen-stage">
      <button class="play-btn" id="listenPlay">🔊</button>
      <div class="prompt">听 TTS 朗读,选正确的英文</div>
      <div class="reveal" id="listenReveal"></div>
    </div>
    <div class="game-stats">
      <div>已答:<b id="listenCount">0</b></div>
      <div>正确:<b id="listenCorrect">0</b></div>
      <div>连击:<b id="listenStreak">0</b></div>
      <button class="navbtn" id="listenRestart">换一批</button>
    </div>
    <div class="listen-board" id="listenBoard"></div>
  </section>

  <section id="view-memory" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2 id="memoryTitle">Memory 连连看</h2>
    </div>
    <div class="game-stats">
      <div>已匹配:<b id="memoryMatched">0</b>/<b id="memoryTotal">0</b></div>
      <div>步数:<b id="memoryMoves">0</b></div>
      <div>用时:<b id="memoryTimer">0.0s</b></div>
      <button class="navbtn" id="memoryRestart">重新开始</button>
    </div>
    <div class="memory-board" id="memoryBoard"></div>
  </section>

  <section id="view-gravity" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2 id="gravityTitle">Gravity 消消乐</h2>
    </div>
    <div class="game-stats">
      <div>分数:<b id="gravityScore">0</b></div>
      <div>生命:<b id="gravityLife">3</b></div>
      <div>连击:<b id="gravityStreak">0</b></div>
      <button class="navbtn" id="gravityRestart">开始 / 重新开始</button>
    </div>
    <div class="gravity-stage" id="gravityStage">
      <div class="gravity-falling" id="gravityFalling" style="top: -100px;">—</div>
    </div>
    <div class="gravity-options" id="gravityOptions"></div>
  </section>

  <!-- SRS 今日复习 -->
  <section id="view-srs" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2>今日复习 (SRS)</h2>
    </div>
    <p style="color: var(--text-soft); margin-top:0; font-size:13px;">
      基于 SM-2 简化版间隔重复规则:1 / 2 / 4 / 7 / 15 / 30 天阶梯。答对升级,答错或模糊回到起点。
    </p>
    <div class="panel" id="srsSummary">
      <h3>今日概览</h3>
      <div class="row" id="srsSummaryRow"></div>
    </div>
    <div class="view-title-row" style="margin-top:18px;">
      <h3 style="margin:0;">待复习 <span style="color:var(--text-muted); font-weight:400;" id="srsDueCount">(0)</span></h3>
    </div>
    <div class="srs-card-list" id="srsDueList"></div>
    <div class="view-title-row" style="margin-top:18px;">
      <h3 style="margin:0;">今日学习 <span style="color:var(--text-muted); font-weight:400;" id="srsNewCount">(0)</span></h3>
    </div>
    <div class="srs-card-list" id="srsNewList"></div>
  </section>

  <!-- 错题本 -->
  <section id="view-errors" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2>错题本 (Shadow Pool)</h2>
    </div>
    <p style="color: var(--text-soft); margin-top:0; font-size:13px;">
      游戏中答错或标记模糊的词自动进入。需连续 2 次答对才移出。
    </p>
    <div class="filter-bar" id="errorFilterBar">
      <span class="pill active" data-topic-filter="__all__">全部</span>
    </div>
    <div class="srs-card-list" id="errorList"></div>
    <div id="errorEmpty" style="text-align:center; padding: 40px 0; color: var(--text-muted); display:none;">
      🎉 没有错题。继续保持!
    </div>
  </section>

  <!-- 录音跟读 -->
  <section id="view-record" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2>🎙 跟读练习</h2>
    </div>
    <p style="color: var(--text-soft); margin-top:0; font-size:13px;">
      先听原声，再按下录音跟读，最后自评。跟读结果会进入 SRS 复习队列。浏览器需授权麦克风。
    </p>

    <div class="rec-mode-row">
      <button class="navbtn" id="recModeQueue" data-recmode="queue">今日队列</button>
      <button class="navbtn" id="recModeTopic" data-recmode="topic">当前主题</button>
    </div>

    <div class="rec-card" id="recCard">
      <div class="rec-en" id="recEn">—</div>
      <div class="rec-zh" id="recZh"></div>
      <div class="rec-ex" id="recEx"></div>
      <div class="rec-btns">
        <button class="pill" id="recPlay">🔊 听原声</button>
        <button class="pill" id="recPlaySlow">🐢 慢速</button>
        <button class="pill" id="recSpeakEn">🎯 读例句</button>
      </div>
    </div>

    <div class="rec-stage" id="recStage">
      <div class="rec-meter" id="recMeter">
        <span id="recState">⏺ 就绪</span>
      </div>
      <button class="pill big" id="recRecordBtn">⏺ 开始录音</button>
    </div>

    <div class="rec-result" id="recResult"></div>

    <div class="rec-nav">
      <button class="navbtn" id="recPrev">← 上一张</button>
      <span id="recProgress" style="font-size:13px; color: var(--text-soft);"></span>
      <button class="navbtn" id="recNext">下一张 →</button>
    </div>
  </section>

  <!-- 进度可视化 -->
  <section id="view-progress" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2>📊 学习进度</h2>
    </div>
    <div class="kpi-grid" id="kpiGrid"></div>
    <div class="panel">
      <h3>各主题掌握度</h3>
      <canvas id="masteryChart" class="chart-canvas"></canvas>
    </div>
    <div class="panel">
      <h3>SRS 复习阶梯分布</h3>
      <div class="srs-ladder" id="srsLadder"></div>
    </div>
    <div class="panel">
      <h3>最近 14 天学习活跃</h3>
      <canvas id="activityChart" class="chart-canvas"></canvas>
    </div>
    <div class="panel" style="margin-top:14px;">
      <h3>学习建议</h3>
      <div id="adviceBox" style="font-size:13px; color: var(--text-soft); line-height:1.6;"></div>
    </div>
  </section>

  <!-- 设置 -->
  <section id="view-settings" class="view">
    <div class="view-title-row">
      <button class="navbtn" data-go="topics">← 主题</button>
      <h2>设置</h2>
    </div>
    <div class="panel">
      <h3>TTS 语速</h3>
      <div class="row">
        <label><input type="radio" name="rate" value="0.85"> 0.85x 慢</label>
        <label><input type="radio" name="rate" value="1" checked> 1.0x 常速</label>
        <label><input type="radio" name="rate" value="1.2"> 1.2x 快</label>
      </div>
    </div>
    <div class="panel" style="margin-top:14px;">
      <h3>语音 (在线 TTS 仅作离线兜底)</h3>
      <div class="row">
        <label>
          <span>语种</span>
          <select id="localeSel">
            <option value="en-GB" selected>British English (英式)</option>
            <option value="en-US">American English (美式)</option>
          </select>
        </label>
      </div>
      <p style="font-size:12px; color: var(--text-muted); margin: 8px 0 0;">
        如已预生成 mp3 (本地包),优先使用预生成 mp3 。
      </p>
    </div>
    <div class="panel" style="margin-top:14px;">
      <h3>当前进度</h3>
      <div class="row" id="progressStats"></div>
    </div>
    <div class="panel" style="margin-top:14px;">
      <h3>重置</h3>
      <div class="row">
        <button class="navbtn" id="btnResetProgress">清空学习进度</button>
      </div>
    </div>
  </section>

</main>

<!-- 内嵌数据 -->
<script id="appData" type="application/json">__APP_DATA_JSON__</script>

<!-- 阶段 5 · Supabase 同步 + 登录 + PWA 安装 -->
__SYNC_SCRIPTS__

<script>
(function () {
  'use strict';

  // 阶段 5 · 同步层初始化(异步,不阻塞主流程)
  (function bootStage5() {
    var kick = function () {
      if (typeof window.__STAGE5_INIT__ === 'function') window.__STAGE5_INIT__();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', kick, { once: true });
    } else {
      // 给 supabase SDK 一个异步 tick 让它注入 window.supabase
      setTimeout(kick, 0);
    }
  })();

  // ============================================================
  // 数据加载 (优先 fetch,失败则用内嵌)
  // ============================================================
  const EMBED = JSON.parse(document.getElementById('appData').textContent);
  const STATE = {
    topics: EMBED.topics,
    cards: EMBED.cards,
    progress: loadProgress(),
    settings: loadSettings(),
    currentTopic: null,
    browsePage: 0,
    browseSubscene: '',  // '' = 全部; 'M1'/'M2'/... = 商务卡子模块
    pageSize: 12,
    matchRound: null,
    listenRound: null,
    memoryRound: null,
    gravityRound: null,
  };

  // ============================================================
  // localStorage 持久化
  // ============================================================
  function loadProgress() {
    try {
      const s = JSON.parse(localStorage.getItem('lifeVocabProgress') || '{}');
      return Object.assign({
        card_state: {},
        xp: 0,
        streak: 0,
        last_active: '',
        rec_count: 0,
        rec_history: [],   // [{d: 'YYYY-MM-DD', n: 次数, words: [id...]}]
        rec_scores: {},    // { cardId: { best, last, attempts, history: [..] } }
        day_log: {},       // { 'YYYY-MM-DD': 学习动作数 }
      }, s);
    } catch (e) { return { card_state: {}, xp: 0, streak: 0, last_active: '', rec_count: 0, rec_history: [], rec_scores: {}, day_log: {} }; }
  }
  function saveProgress() {
    localStorage.setItem('lifeVocabProgress', JSON.stringify(STATE.progress));
    // 阶段 5 · 异步同步到云端(失败入队,不影响本地)
    if (typeof window.Sync !== 'undefined' && window.Sync.isCloud && window.Sync.isCloud()) {
      _syncPushSoon();
    }
  }

  // 把 STATE.progress.card_state 转换为 cards_progress 行 → 推到云
  let _syncPushPending = [];
  let _syncPushTimer = null;
  function _syncPushSoon() {
    clearTimeout(_syncPushTimer);
    _syncPushTimer = setTimeout(_syncPushNow, 600);  // debounce
  }
  async function _syncPushNow() {
    try {
      if (!window.Sync || !window.Sync.isCloud || !window.Sync.isCloud()) return;
      const cs = STATE.progress.card_state || {};
      const list = [];
      for (const k of Object.keys(cs)) {
        const row = cs[k];
        if (!row) continue;
        // k 格式 "cardId:mode" 或 JSON.stringify 的结果(向后兼容)
        const parts = String(k).split(':');
        const card_id = parseInt(parts[0], 10);
        const mode = parts[1] || 'browse';
        list.push({
          card_id: card_id,
          mode: mode,
          reps: row.reps || 0,
          correct: row.correct || 0,
          ease: row.ease || 2.5,
          last_review: row.last_review || null,
          next_due: row.next_due || null,
          shadow_pool: !!row.shadow_pool,
          rec_score: row.rec_score || null,
          rec_attempts: row.rec_attempts || 0
        });
      }
      const r = await window.Sync.pushProgress(list);
      // 也把 settings 推一份
      const sr = await window.Sync.pushSettings({
        xp: STATE.progress.xp || 0,
        streak: STATE.progress.streak || 0,
        last_active_date: STATE.progress.last_active || null,
        shadow_pool_meta: { raw: STATE.progress.shadow_pool_meta || {} },
        settings: STATE.settings || {}
      });
      // console.debug('[sync-push]', r, sr);
    } catch (e) {
      console.warn('[sync-push] failed', e.message);
    }
  }

  // 监听云端拉取完成,触发 UI 刷新
  window.addEventListener('lv:sync-complete', function () {
    if (typeof window.Sync !== 'undefined') {
      window.Sync.pullAll().then(function (r) {
        if (r && r.ok) {
          // 把云端的 card_state 合并到本地(避免覆盖本地更新)
          _mergeCloudProgress(r);
        }
      });
    }
  });

  function _mergeCloudProgress(r) {
    // 简化策略:如果云端有更多/更新的数据,保留云端作为权威,
    // 但要求用户 reload 页面才生效(避免大改 UI)
    if (r && r.progress && window.AuthUI && window.AuthUI.toast) {
      window.AuthUI.toast('云端已同步 (' + r.progress + ' 条),刷新页面查看', 'ok');
    }
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('lifeVocabSettings') || '{}');
      return Object.assign({ rate: 1, locale: 'en-GB' }, s);
    } catch (e) { return { rate: 1, locale: 'en-GB' }; }
  }
  function saveSettings() {
    localStorage.setItem('lifeVocabSettings', JSON.stringify(STATE.settings));
  }

  // ============================================================
  // 视图切换 (hash 路由)
  // ============================================================
  // ============================================================
  // 游戏生命周期: 离开视图时彻底停止 (定时器/待执行回调/语音播报)
  // ============================================================
  function stopMatchGame() { stopMatchTimer(); STATE.matchRound = null; }
  function stopMemoryGame() { stopMemoryTimer(); STATE.memoryRound = null; }
  function stopListenGame() { STATE.listenRound = null; }
  function stopGravityGame() {
    const r = STATE.gravityRound;
    if (r && r.timer) { clearInterval(r.timer); r.timer = null; }
    STATE.gravityRound = null;
  }
  function stopAllGames() {
    stopMatchGame(); stopMemoryGame(); stopListenGame(); stopGravityGame();
    // 停掉正在播报的 TTS / 预载音频
    if (_currentAudio) { try { _currentAudio.pause(); } catch (e) {} _currentAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function show(name, topicId) {
    // 离开当前视图前, 停掉所有游戏运行状态, 避免后台继续计时/掉命/发音
    stopAllGames();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('header.top .navbtn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('active');
    const nav = document.querySelector(`header.top .navbtn[data-go="${name}"]`);
    if (nav) nav.classList.add('active');
    if (name === 'topics') renderTopics();
    if (name === 'browse') renderBrowse(topicId);
    if (name === 'match') renderMatch(topicId);
    if (name === 'listen') renderListen(topicId);
    if (name === 'memory') renderMemory(topicId);
    if (name === 'gravity') renderGravity(topicId);
    if (name === 'srs') renderSRS();
    if (name === 'errors') renderErrorBank();
    if (name === 'record') renderRecord();
    if (name === 'progress') renderProgress();
    if (name === 'settings') renderSettings();
    updateNavBadges();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (t) { show(t.getAttribute('data-go')); e.preventDefault(); }
  });
  window.addEventListener('hashchange', applyHash);
  function applyHash() {
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) { show('topics'); return; }
    const [view, arg] = h.split('/');
    show(view || 'topics', arg);
  }

  // ============================================================
  // 主题列表
  // ============================================================
  function renderTopics() {
    const grid = document.getElementById('topicGrid');
    grid.innerHTML = '';
    const sumEl = document.getElementById('topicsSummary');
    if (sumEl) sumEl.textContent = '共 ' + STATE.topics.length + ' 个主题、' + STATE.cards.length + ' 张卡，点击主题进入 6 种玩法。';
    STATE.topics
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(t => {
        const n = STATE.cards.filter(c => c.topic === t.topic_id).length;
        const mastered = STATE.cards.filter(c =>
          c.topic === t.topic_id && STATE.progress.card_state[c.id]?.status === 'known'
        ).length;
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.style.borderTop = '4px solid ' + t.color;
        card.innerHTML = `
          <div class="icon">${t.icon || ''}</div>
          <div class="name">${escapeHtml(t.name_zh)} <span style="font-size:12px; color: var(--text-muted); font-weight:400;">${escapeHtml(t.name_en)}</span></div>
          <div class="blurb">${escapeHtml(t.blurb || '')}</div>
          <div class="meta">
            <span><b>${n}</b> 词</span>
            <span><b>${mastered}</b> 已掌握</span>
          </div>
          <div class="games">
            <button class="game-btn" data-action="browse" data-topic="${t.topic_id}">📖 浏览</button>
            <button class="game-btn primary" data-action="match" data-topic="${t.topic_id}">⚔ 碰碰乐</button>
            <button class="game-btn" data-action="listen" data-topic="${t.topic_id}">🔊 听音</button>
            <button class="game-btn" data-action="memory" data-topic="${t.topic_id}">🧠 连连看</button>
            <button class="game-btn" data-action="gravity" data-topic="${t.topic_id}">⬇ 消消乐</button>
            <button class="game-btn" data-action="record" data-topic="${t.topic_id}">🎙 跟读</button>
          </div>
        `;
        grid.appendChild(card);
      });
    grid.addEventListener('click', onTopicClick);

    function onTopicClick(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const tid = btn.dataset.topic;
      show(action, tid);
    }
  }

  // ============================================================
  // 词卡浏览
  // ============================================================
  function renderBrowse(topicId) {
    STATE.currentTopic = topicId;
    const topic = STATE.topics.find(t => t.topic_id === topicId);
    document.getElementById('browseTitle').innerHTML =
      `${escapeHtml(topic?.name_zh || '')} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">${escapeHtml(topic?.name_en || '')}</span>`;
    // 若切换了 topic 而 subscene 不再有效则清空
    if (!topic?.subscenes) STATE.browseSubscene = '';
    // 渲染 subscene pill(仅当主题含 subscenes)
    const subWrap = document.getElementById('browseSubscenes');
    if (subWrap) {
      if (topic?.subscenes && topic.subscenes.length) {
        const cards = STATE.cards.filter(c => c.topic === topicId);
        let html = `<button class="subpill${STATE.browseSubscene === '' ? ' active' : ''}" data-sub="">全部 (${cards.length})</button>`;
        for (const sub of topic.subscenes) {
          const cnt = cards.filter(c => c.scene === sub.module).length;
          html += `<button class="subpill${STATE.browseSubscene === sub.module ? ' active' : ''}" data-sub="${escapeHtml(sub.module)}">${escapeHtml(sub.name_zh)} (${cnt})</button>`;
        }
        subWrap.innerHTML = html;
        subWrap.style.display = 'flex';
      } else {
        subWrap.innerHTML = '';
        subWrap.style.display = 'none';
      }
    }
    const all = STATE.cards.filter(c => c.topic === topicId);
    const list = STATE.browseSubscene && topic?.subscenes
      ? all.filter(c => c.scene === STATE.browseSubscene)
      : all;
    const pages = Math.max(1, Math.ceil(list.length / STATE.pageSize));
    if (STATE.browsePage >= pages) STATE.browsePage = pages - 1;
    if (STATE.browsePage < 0) STATE.browsePage = 0;
    const slice = list.slice(STATE.browsePage * STATE.pageSize, (STATE.browsePage + 1) * STATE.pageSize);

    const wrap = document.getElementById('cardList');
    wrap.innerHTML = '';
    slice.forEach(c => wrap.appendChild(makeWordCard(c)));

    const subTag = STATE.browseSubscene ? ` · ${escapeHtml(STATE.browseSubscene)}` : '';
    document.getElementById('pageInfo').textContent = `${STATE.browsePage + 1} / ${pages}  (共 ${list.length} 词${subTag})`;
    document.getElementById('prevPage').disabled = STATE.browsePage <= 0;
    document.getElementById('nextPage').disabled = STATE.browsePage >= pages - 1;
  }
  document.getElementById('prevPage').addEventListener('click', () => {
    if (STATE.browsePage > 0) { STATE.browsePage--; renderBrowse(STATE.currentTopic); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    STATE.browsePage++; renderBrowse(STATE.currentTopic);
  });
  document.getElementById('btnBrowseView').addEventListener('click', () => {
    show('browse', STATE.currentTopic);
  });

  // ============================================================
  // Browse 子场景切换事件 (代理)
  document.getElementById('browseSubscenes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sub]');
    if (!b) return;
    STATE.browseSubscene = b.dataset.sub || '';
    STATE.browsePage = 0;
    renderBrowse(STATE.currentTopic);
  });

  function makeWordCard(c) {
    const div = document.createElement('div');
    div.className = 'word-card';
    div.dataset.cardId = c.id;
    const state = STATE.progress.card_state[c.id]?.status || 'new';
    div.innerHTML = `
      <div class="en">${escapeHtml(c.en)}</div>
      <div class="zh">${escapeHtml(c.zh || '')}</div>
      <div class="ex">${escapeHtml(c.ex || '')}<span class="ex_zh">${escapeHtml(c.ex_zh || '')}</span></div>
      ${c.sc ? `<div class="sc">🎯 ${escapeHtml(c.sc)}</div>` : ''}
      ${c.tip ? `<div class="tip">💡 ${escapeHtml(c.tip)}</div>` : ''}
      <div class="row-bottom">
        <button class="pill" data-act="tts-word">🔊 词</button>
        <button class="pill" data-act="tts-ex">🔊 例句</button>
        <button class="pill" data-act="tts-slow">🏃 慢</button>
        <span style="flex:1;"></span>
        <button class="pill good" data-act="mark-known">熟 ✓</button>
        <button class="pill warn" data-act="mark-blur">模糊</button>
      </div>
    `;
    const knownBtn = div.querySelector('[data-act=mark-known]');
    const blurBtn = div.querySelector('[data-act=mark-blur]');
    if (state === 'known') knownBtn.classList.add('active');
    if (state === 'blur') blurBtn.classList.add('active');
    if (state === 'shadow') blurBtn.classList.add('active');
    return div;
  }

  // 词卡按钮事件委托: 绑定在 document 级, 覆盖所有出现词卡的视图
  // (原 bug: 只绑在浏览页 #cardList 上, 错题本/SRS 复习页的词卡按钮全部无效)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const cardEl = btn.closest('[data-card-id]');
    if (!cardEl) return;
    const id = parseInt(cardEl.dataset.cardId, 10);
    const c = STATE.cards.find(x => x.id === id);
    if (!c) return;
    const act = btn.dataset.act;
    if (act === 'tts-word') speak(c.en, false);
    if (act === 'tts-ex') speak(c.ex, false);
    if (act === 'tts-slow') speak(c.en, true);
    if (act === 'mark-known') setCardStatus(c, 'known', btn, cardEl.querySelector('[data-act=mark-blur]'));
    if (act === 'mark-blur') setCardStatus(c, 'shadow', btn, cardEl.querySelector('[data-act=mark-known]'));
  });

  function setCardStatus(c, status, btn, otherBtn) {
    recordResult(c.id, status === 'known', status === 'shadow' ? 'shadow' : status);
    btn.classList.add('active');
    if (otherBtn) otherBtn.classList.remove('active');
  }

  // ============================================================
  // TTS
  // ============================================================
  let _currentAudio = null;
  function speak(text, slow) {
    if (!text) return;
    const c = STATE.cards.find(x => x.en === text || x.ex === text);
    let prePath = null;
    if (c) {
      if (text === c.en) prePath = slow ? c.audio_word_slow : c.audio_word;
      if (text === c.ex) prePath = slow ? c.audio_example_slow : c.audio_example;
    }
    if (prePath) {
      if (_currentAudio) { try { _currentAudio.pause(); } catch (e) {} }
      const audio = new Audio(prePath);
      _currentAudio = audio;
      audio.playbackRate = slow ? 0.85 : STATE.settings.rate || 1.0;
      audio.play().catch(() => fallbackTTS(text, slow));
      return;
    }
    fallbackTTS(text, slow);
  }
  function fallbackTTS(text, slow) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = STATE.settings.locale || 'en-GB';
    u.rate = (slow ? 0.85 : STATE.settings.rate || 1.0);
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const m = voices.find(v => v.lang.startsWith(u.lang));
    if (m) u.voice = m;
    window.speechSynthesis.speak(u);
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.getVoices();
  }

  // ============================================================
  // SRS 算法 (SM-2 简化)
  // ============================================================
  const SRS_INTERVALS = [1, 2, 4, 7, 15, 30];
  function srsInterval(reps) {
    if (reps <= 0) return 1;
    return SRS_INTERVALS[Math.min(reps - 1, SRS_INTERVALS.length - 1)];
  }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function recordResult(cardId, correct, explicitStatus) {
    const t = today();
    const prev = STATE.progress.card_state[cardId] || {};
    const isNewCard = !STATE.progress.card_state[cardId];
    const wasShadow = prev.was_shadow === true || prev.status === 'shadow';
    let next;

    if (correct) {
      const newReps = (prev.reps || 0) + 1;
      const interval = srsInterval(newReps);
      if (wasShadow) {
        // 错题连对 2 次才移出
        const confirmCount = (prev.shadow_confirm || 0) + 1;
        if (confirmCount >= 2) {
          next = {
            status: 'known',
            last_seen: t,
            reps: newReps,
            next_due: addDays(t, interval),
            was_shadow: false,
            shadow_confirm: 0,
          };
        } else {
          next = {
            status: 'shadow',
            last_seen: t,
            reps: prev.reps || 0,
            next_due: addDays(t, 1),
            was_shadow: true,
            shadow_confirm: confirmCount,
          };
        }
      } else {
        next = {
          status: 'known',
          last_seen: t,
          reps: newReps,
          next_due: addDays(t, interval),
          was_shadow: false,
          shadow_confirm: 0,
        };
      }
    } else {
      // 答错 -> 入错题本
      next = {
        status: 'shadow',
        last_seen: t,
        reps: 0,
        next_due: addDays(t, 1),
        was_shadow: true,
        shadow_confirm: 0,
      };
    }
    if (explicitStatus === 'shadow' && correct) {
      // 用户主动标记模糊 -> shadow 但保留 reps
      next.status = 'shadow';
      next.was_shadow = true;
      next.reps = 0;
    }
    if (isNewCard) {
      // 首次学习这张卡: 消耗一个今日新词额度
      ensureNewQuota();
      STATE.progress.new_count = (STATE.progress.new_count || 0) + 1;
    }
    STATE.progress.card_state[cardId] = next;
    saveProgress();
    updateNavBadges();
    addXP(correct ? (next.status === 'known' && wasShadow ? 6 : (next.status === 'known' ? 5 : 3)) : 2);
  }

  function getDueCards() {
    // 真正的「今日复习」: 错题 + 已学但 SRS 到期的卡。
    // 新卡不算——新词走每日额度逐步引入 (见 getRemainingNewQuota)。
    const t = today();
    return STATE.cards.filter(c => {
      const s = STATE.progress.card_state[c.id];
      if (!s) return false;
      if (s.was_shadow) return true; // 错题必复习
      if (s.status === 'known' && (!s.next_due || s.next_due <= t)) return true;
      return false;
    });
  }
  function getNewCards(limit) {
    return STATE.cards.filter(c => !STATE.progress.card_state[c.id]).slice(0, limit || 8);
  }
  function getErrorCards(topicId) {
    return STATE.cards.filter(c => {
      const s = STATE.progress.card_state[c.id];
      if (!s || !s.was_shadow) return false;
      if (topicId && topicId !== '__all__' && c.topic !== topicId) return false;
      return true;
    });
  }
  function getErrorCount() { return getErrorCards().length; }
  function getDueCount() { return getDueCards().length; }

  // ---- 每日新词额度 ----
  // 目的: 3032 张卡不可能一天学完。每天最多引入 N 张新卡 (默认 10),
  // 用进度里的 new_date/new_count 记录当天已学数量, 跨天自动重置。
  const DAILY_NEW_DEFAULT = 10;
  function dailyNewGoal() {
    return (STATE.settings && STATE.settings.daily_new) || DAILY_NEW_DEFAULT;
  }
  function ensureNewQuota() {
    const t = today();
    const p = STATE.progress;
    if (p.new_date !== t) { p.new_date = t; p.new_count = 0; }
  }
  function getRemainingNewQuota() {
    ensureNewQuota();
    return Math.max(0, dailyNewGoal() - (STATE.progress.new_count || 0));
  }

  // ============================================================
  // Quizlet Match
  // ============================================================
  function renderMatch(topicId) {
    STATE.currentTopic = topicId;
    const topic = STATE.topics.find(t => t.topic_id === topicId);
    document.getElementById('matchTitle').innerHTML =
      `${escapeHtml(topic?.name_zh || '')} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">Match</span>`;
    startRound();
  }
  document.getElementById('matchRestart').addEventListener('click', startRound);
  document.getElementById('matchSpeakEn').addEventListener('click', () => {
    if (!STATE.matchRound) return;
    const mr = STATE.matchRound;
    mr.cards.forEach((c, i) => setTimeout(() => { if (STATE.matchRound === mr) speak(c.en, false); }, i * 700));
  });

  function startRound() {
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic);
    const n = Math.min(10, all.length);
    const picked = shuffle(all).slice(0, n);
    const en = picked.map(c => ({ key: c.id, side: 'en', text: c.en, card: c }));
    const zh = picked.map(c => ({ key: c.id, side: 'zh', text: c.zh, card: c }));
    const board = shuffle([...en, ...zh]);
    STATE.matchRound = {
      cards: picked,
      enBoard: en, zhBoard: zh, board,
      errors: 0, score: 0,
      startTime: performance.now(),
      timer: null,
      selected: null,
      matched: new Set(),
    };
    document.getElementById('matchRoundSize').textContent = n;
    document.getElementById('matchErrors').textContent = '0';
    document.getElementById('matchScore').textContent = '0';
    paintMatchBoard();
    startMatchTimer();
  }
  function startMatchTimer() {
    if (STATE.matchRound.timer) clearInterval(STATE.matchRound.timer);
    const t0 = STATE.matchRound.startTime;
    STATE.matchRound.timer = setInterval(() => {
      const dt = (performance.now() - t0) / 1000;
      document.getElementById('matchTimer').textContent = dt.toFixed(1) + 's';
    }, 100);
  }
  function stopMatchTimer() {
    if (STATE.matchRound?.timer) { clearInterval(STATE.matchRound.timer); STATE.matchRound.timer = null; }
  }
  function paintMatchBoard() {
    const board = document.getElementById('matchBoard');
    board.innerHTML = '';
    const r = STATE.matchRound;
    r.board.forEach((cell, idx) => {
      const div = document.createElement('div');
      div.className = 'match-card';
      if (r.matched.has(cell.key)) div.classList.add('matched');
      if (r.selected && r.selected.idx === idx) div.classList.add('selected');
      div.dataset.idx = idx;
      div.innerHTML = cell.side === 'en'
        ? `${escapeHtml(cell.text)}<small>tap to pick</small>`
        : `${escapeHtml(cell.text)}<small>tap to match</small>`;
      board.appendChild(div);
    });
  }
  document.getElementById('matchBoard').addEventListener('click', (e) => {
    const div = e.target.closest('.match-card');
    if (!div) return;
    const idx = parseInt(div.dataset.idx, 10);
    const r = STATE.matchRound;
    if (!r || r.matched.has(r.board[idx].key)) return;
    if (!r.selected) {
      r.selected = { idx, cell: r.board[idx] };
      paintMatchBoard();
      if (r.board[idx].side === 'en') speak(r.board[idx].text, false);
      return;
    }
    if (r.selected.idx === idx) return;
    const second = { idx, cell: r.board[idx] };
    if (r.selected.cell.side === second.cell.side) {
      r.selected = second;
      paintMatchBoard();
      if (second.cell.side === 'en') speak(second.cell.text, false);
      return;
    }
    if (r.selected.cell.key === second.cell.key) {
      // 配对成功
      r.matched.add(r.selected.cell.key);
      const c = r.cards.find(x => x.id === r.board[idx].key);
      if (c) {
        recordResult(c.id, true);
        setTimeout(() => { if (STATE.matchRound === r) speak(c.en + '. ' + c.ex, false); }, 60);
      }
      r.selected = null;
      paintMatchBoard();
      if (r.matched.size === r.cards.length) finishMatch();
    } else {
      // 配对失败 -> 错题
      r.errors++;
      document.getElementById('matchErrors').textContent = r.errors;
      const c1 = r.cards.find(x => x.id === r.selected.cell.key);
      const c2 = r.cards.find(x => x.id === r.board[idx].key);
      if (c1) recordResult(c1.id, false);
      if (c2) recordResult(c2.id, false);
      r.selected = null;
      paintMatchBoard();
      // 错动画
      const allCards = document.querySelectorAll('.match-card');
      allCards.forEach(el => el.classList.remove('wrong'));
      // 临时把 idx 注入到 selected 触发抖动
      r.selected = { idx };
      paintMatchBoard();
      r.selected = null;
      const cards = document.querySelectorAll('.match-card');
      cards.forEach(el => el.classList.remove('wrong'));
      // 找刚点过的两个 idx,加 wrong class
      const idx2 = idx;
      const idx1 = (() => {
        // 找上一个 r.selected
        return parseInt(div.previousElementSibling?.dataset?.idx || -1, 10);
      })();
      // 简单做法:给当前点击的 + r.selected 之前
      // 实际让 div 抖动通过 r.selected 残留:我们手动给 div 加 wrong
      div.classList.add('wrong');
      setTimeout(() => { if (STATE.matchRound === r) paintMatchBoard(); }, 400);
    }
  });
  function finishMatch() {
    stopMatchTimer();
    const r = STATE.matchRound;
    const dt = (performance.now() - r.startTime) / 1000;
    const base = Math.max(0, Math.round(100 - dt - r.errors * 5));
    r.score = base;
    document.getElementById('matchScore').textContent = base;
    addXP(base);
    bumpStreak();
    setTimeout(() => {
      if (STATE.matchRound !== r) return; // 已离开视图/换局, 不再弹窗重开
      alert(`本轮完成！\n用时 ${dt.toFixed(1)}s · 错误 ${r.errors} 次 · 得分 ${base}`);
      startRound();
    }, 200);
  }

  // ============================================================
  // Listen 听音匹配
  // ============================================================
  function renderListen(topicId) {
    STATE.currentTopic = topicId;
    const topic = STATE.topics.find(t => t.topic_id === topicId);
    document.getElementById('listenTitle').innerHTML =
      `${escapeHtml(topic?.name_zh || '')} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">Listen</span>`;
    startListenRound();
  }
  document.getElementById('listenRestart').addEventListener('click', startListenRound);
  document.getElementById('listenPlay').addEventListener('click', () => {
    if (!STATE.listenRound) return;
    speak(STATE.listenRound.current.en, false);
    document.getElementById('listenPlay').classList.add('playing');
    setTimeout(() => document.getElementById('listenPlay').classList.remove('playing'), 800);
  });
  function startListenRound() {
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic);
    const n = Math.min(8, all.length);
    const pool = shuffle(all).slice(0, n);
    STATE.listenRound = {
      queue: pool,
      cursor: 0,
      correct: 0,
      streak: 0,
      maxStreak: 0,
      answered: 0,
    };
    nextListen();
  }
  function nextListen() {
    const r = STATE.listenRound;
    if (!r) return;
    if (r.cursor >= r.queue.length) {
      // 结束
      alert(`本批完成! 答对 ${r.correct}/${r.answered} · 最长连击 ${r.maxStreak}`);
      startListenRound();
      return;
    }
    const current = r.queue[r.cursor];
    r.current = current;
    // 4 个候选:1 正确 + 3 同主题干扰
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic && c.id !== current.id);
    const distractors = shuffle(all).slice(0, 3);
    const options = shuffle([current, ...distractors]);
    document.getElementById('listenReveal').textContent = '';
    document.getElementById('listenCount').textContent = r.answered;
    document.getElementById('listenCorrect').textContent = r.correct;
    document.getElementById('listenStreak').textContent = r.streak;
    const board = document.getElementById('listenBoard');
    board.innerHTML = '';
    options.forEach(c => {
      const div = document.createElement('div');
      div.className = 'listen-option';
      div.dataset.id = c.id;
      div.innerHTML = escapeHtml(c.en);
      board.appendChild(div);
    });
    // 自动播放一次 (仅在当前局仍有效时播报; 离开视图后不再发声)
    setTimeout(() => { if (STATE.listenRound === r) speak(current.en, false); }, 200);
  }
  document.getElementById('listenBoard').addEventListener('click', (e) => {
    const opt = e.target.closest('.listen-option');
    if (!opt || !STATE.listenRound?.current) return;
    const r = STATE.listenRound;
    const id = parseInt(opt.dataset.id, 10);
    const correct = id === r.current.id;
    r.answered++;
    if (correct) {
      r.correct++;
      r.streak++;
      if (r.streak > r.maxStreak) r.maxStreak = r.streak;
      opt.classList.add('matched');
      recordResult(r.current.id, true);
      document.getElementById('listenReveal').textContent = `✓ ${r.current.en} = ${r.current.zh}`;
      setTimeout(() => {
        if (STATE.listenRound !== r) return;
        r.cursor++;
        nextListen();
      }, 700);
    } else {
      r.streak = 0;
      opt.classList.add('wrong');
      recordResult(r.current.id, false);
      // 标正确项
      document.querySelectorAll('.listen-option').forEach(el => {
        if (parseInt(el.dataset.id, 10) === r.current.id) el.classList.add('matched');
      });
      document.getElementById('listenReveal').textContent = `✗ ${r.current.en} = ${r.current.zh}`;
      setTimeout(() => {
        if (STATE.listenRound !== r) return;
        r.cursor++;
        nextListen();
      }, 1200);
    }
  });

  // ============================================================
  // Memory 连连看
  // ============================================================
  function renderMemory(topicId) {
    STATE.currentTopic = topicId;
    const topic = STATE.topics.find(t => t.topic_id === topicId);
    document.getElementById('memoryTitle').innerHTML =
      `${escapeHtml(topic?.name_zh || '')} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">Memory</span>`;
    startMemoryRound();
  }
  document.getElementById('memoryRestart').addEventListener('click', startMemoryRound);
  function startMemoryRound() {
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic);
    const n = Math.min(6, all.length); // 6 对 = 12 张
    const picked = shuffle(all).slice(0, n);
    // 每对 2 张:一张 en,一张 zh
    const tiles = [];
    picked.forEach(c => {
      tiles.push({ key: c.id, side: 'en', text: c.en, card: c });
      tiles.push({ key: c.id, side: 'zh', text: c.zh, card: c });
    });
    STATE.memoryRound = {
      tiles: shuffle(tiles),
      flipped: [],
      matched: new Set(),
      moves: 0,
      startTime: performance.now(),
      timer: null,
      total: picked.length,
    };
    document.getElementById('memoryTotal').textContent = n;
    document.getElementById('memoryMatched').textContent = '0';
    document.getElementById('memoryMoves').textContent = '0';
    paintMemoryBoard();
    startMemoryTimer();
  }
  function startMemoryTimer() {
    if (STATE.memoryRound.timer) clearInterval(STATE.memoryRound.timer);
    const t0 = STATE.memoryRound.startTime;
    STATE.memoryRound.timer = setInterval(() => {
      const dt = (performance.now() - t0) / 1000;
      document.getElementById('memoryTimer').textContent = dt.toFixed(1) + 's';
    }, 100);
  }
  function stopMemoryTimer() {
    if (STATE.memoryRound?.timer) { clearInterval(STATE.memoryRound.timer); STATE.memoryRound.timer = null; }
  }
  function paintMemoryBoard() {
    const board = document.getElementById('memoryBoard');
    board.innerHTML = '';
    const r = STATE.memoryRound;
    r.tiles.forEach((tile, idx) => {
      const div = document.createElement('div');
      div.className = 'memory-card';
      if (r.matched.has(tile.key)) div.classList.add('matched');
      const isFlipped = r.flipped.some(f => f.idx === idx);
      if (isFlipped) div.classList.add('flipped');
      div.dataset.idx = idx;
      const face = document.createElement('div');
      face.className = 'memory-face';
      if (r.matched.has(tile.key)) {
        face.textContent = '✓';
      } else if (isFlipped) {
        face.innerHTML = `<div><b>${escapeHtml(tile.text)}</b><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${tile.side}</div></div>`;
      } else {
        face.textContent = '?';
      }
      div.appendChild(face);
      board.appendChild(div);
    });
  }
  document.getElementById('memoryBoard').addEventListener('click', (e) => {
    const card = e.target.closest('.memory-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    const r = STATE.memoryRound;
    if (!r || r.matched.has(r.tiles[idx].key)) return;
    if (r.flipped.some(f => f.idx === idx)) return;
    if (r.flipped.length >= 2) return;
    r.flipped.push({ idx, tile: r.tiles[idx] });
    if (r.flipped.length === 2) {
      r.moves++;
      document.getElementById('memoryMoves').textContent = r.moves;
      const [a, b] = r.flipped;
      if (a.tile.key === b.tile.key && a.tile.side !== b.tile.side) {
        // 配对成功
        r.matched.add(a.tile.key);
        recordResult(a.tile.card.id, true);
        r.flipped = [];
        document.getElementById('memoryMatched').textContent = r.matched.size;
        if (r.matched.size === r.total) finishMemory();
      } else {
        // 错
        if (a.tile.key !== b.tile.key) {
          recordResult(a.tile.card.id, false);
          recordResult(b.tile.card.id, false);
        }
        paintMemoryBoard();
        setTimeout(() => { if (STATE.memoryRound !== r) return; r.flipped = []; paintMemoryBoard(); }, 700);
        return;
      }
    }
    paintMemoryBoard();
  });
  function finishMemory() {
    stopMemoryTimer();
    const r = STATE.memoryRound;
    const dt = (performance.now() - r.startTime) / 1000;
    const score = Math.max(0, Math.round(100 - r.moves * 3));
    addXP(score);
    bumpStreak();
    setTimeout(() => {
      if (STATE.memoryRound !== r) return; // 已离开视图/换局, 不再弹窗重开
      alert(`连连看完成！\n用时 ${dt.toFixed(1)}s · ${r.moves} 步 · 得分 ${score}`);
      startMemoryRound();
    }, 200);
  }

  // ============================================================
  // Gravity 消消乐
  // ============================================================
  function renderGravity(topicId) {
    STATE.currentTopic = topicId;
    const topic = STATE.topics.find(t => t.topic_id === topicId);
    document.getElementById('gravityTitle').innerHTML =
      `${escapeHtml(topic?.name_zh || '')} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">Gravity</span>`;
    startGravityRound();
  }
  document.getElementById('gravityRestart').addEventListener('click', startGravityRound);
  function startGravityRound() {
    // 防御: 清掉上一局的计时器, 避免重进后多个 interval 叠加 (表现为单词下落越来越快)
    if (STATE.gravityRound && STATE.gravityRound.timer) { clearInterval(STATE.gravityRound.timer); STATE.gravityRound.timer = null; }
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic);
    STATE.gravityRound = {
      queue: shuffle(all),
      cursor: 0,
      score: 0,
      life: 3,
      streak: 0,
      maxStreak: 0,
      falling: null,
      topPos: -40,
      fallSpeed: 0.6, // px per frame
      timer: null,
      active: false,
    };
    document.getElementById('gravityScore').textContent = '0';
    document.getElementById('gravityLife').textContent = '3';
    document.getElementById('gravityStreak').textContent = '0';
    nextGravity();
  }
  function nextGravity() {
    const r = STATE.gravityRound;
    if (!r) return;
    if (r.life <= 0) {
      alert(`游戏结束! 得分 ${r.score} · 最长连击 ${r.maxStreak}`);
      startGravityRound();
      return;
    }
    if (r.cursor >= r.queue.length) {
      r.cursor = 0;
      r.queue = shuffle(r.queue);
    }
    r.falling = r.queue[r.cursor];
    r.topPos = -40;
    r.active = true;
    document.getElementById('gravityFalling').style.top = '-40px';
    document.getElementById('gravityFalling').textContent = r.falling.en;
    document.getElementById('gravityFalling').style.opacity = '1';
    // 准备 4 个候选
    const all = STATE.cards.filter(c => c.topic === STATE.currentTopic && c.id !== r.falling.id);
    const distractors = shuffle(all).slice(0, 3);
    const options = shuffle([r.falling, ...distractors]);
    const optBox = document.getElementById('gravityOptions');
    optBox.innerHTML = '';
    options.forEach(c => {
      const b = document.createElement('button');
      b.className = 'big-cta';
      b.textContent = c.zh;
      b.style.fontSize = '14px';
      b.style.padding = '12px';
      b.dataset.id = c.id;
      optBox.appendChild(b);
    });
    // 自动读 (仅在当前局仍有效时播报; 离开视图后不再发声)
    setTimeout(() => { if (STATE.gravityRound === r) speak(r.falling.en, false); }, 200);
    if (!r.timer) {
      r.timer = setInterval(gravityTick, 30);
    }
  }
  function gravityTick() {
    const r = STATE.gravityRound;
    if (!r || !r.active) return;
    r.topPos += r.fallSpeed;
    const el = document.getElementById('gravityFalling');
    el.style.top = r.topPos + 'px';
    if (r.topPos > 240) {
      // 落到底未答 -> 错
      missGravity();
    }
  }
  function missGravity() {
    const r = STATE.gravityRound;
    r.life--;
    r.streak = 0;
    recordResult(r.falling.id, false);
    document.getElementById('gravityLife').textContent = r.life;
    document.getElementById('gravityStreak').textContent = '0';
    r.active = false;
    const el = document.getElementById('gravityFalling');
    el.style.opacity = '0.3';
    setTimeout(() => { if (STATE.gravityRound !== r) return; r.cursor++; nextGravity(); }, 400);
  }
  document.getElementById('gravityOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const r = STATE.gravityRound;
    if (!r || !r.active) return;
    const id = parseInt(btn.dataset.id, 10);
    const correct = id === r.falling.id;
    if (correct) {
      r.score += 10 + r.streak * 2;
      r.streak++;
      if (r.streak > r.maxStreak) r.maxStreak = r.streak;
      recordResult(r.falling.id, true);
      document.getElementById('gravityScore').textContent = r.score;
      document.getElementById('gravityStreak').textContent = r.streak;
      btn.style.background = 'var(--good)';
    } else {
      r.life--;
      r.streak = 0;
      recordResult(r.falling.id, false);
      document.getElementById('gravityLife').textContent = r.life;
      document.getElementById('gravityStreak').textContent = '0';
      btn.style.background = 'var(--bad)';
      // 标正确
      document.querySelectorAll('#gravityOptions button').forEach(b => {
        if (parseInt(b.dataset.id, 10) === r.falling.id) b.style.background = 'var(--good)';
      });
    }
    r.active = false;
    r.cursor++;
    setTimeout(() => { if (STATE.gravityRound === r) nextGravity(); }, 500);
  });

  // ============================================================
  // SRS 今日复习视图
  // ============================================================
  function renderSRS() {
    const due = getDueCards();
    const quota = getRemainingNewQuota();
    const news = quota > 0 ? getNewCards(quota) : [];
    document.getElementById('srsDueCount').textContent = `(${due.length})`;
    document.getElementById('srsNewCount').textContent = `(${news.length})`;

    document.getElementById('srsSummaryRow').innerHTML = `
      <span style="font-size:13px;">🔥 待复习 <b>${due.length}</b></span>
      <span style="font-size:13px;">🆕 今日新词 <b>${news.length}</b><span style="color:var(--text-muted);">/额度 ${quota > 0 ? dailyNewGoal() : 0}</span></span>
      <span style="font-size:13px;">📈 XP <b>${STATE.progress.xp}</b></span>
      <span style="font-size:13px;">⚡ 连续 <b>${STATE.progress.streak || 0}</b> 天</span>
    `;

    const dueList = document.getElementById('srsDueList');
    dueList.innerHTML = '';
    if (due.length === 0) {
      dueList.innerHTML = '<div style="grid-column:1/-1; color:var(--text-muted); text-align:center; padding:20px;">'
        + (quota <= 0 ? '🎉 今日任务全部完成，明天见！' : '🎉 今日无复习任务，去学点新词吧。')
        + '</div>';
    } else {
      due.forEach(c => dueList.appendChild(makeWordCard(c)));
    }

    const newList = document.getElementById('srsNewList');
    newList.innerHTML = '';
    if (news.length === 0) {
      newList.innerHTML = '<div style="grid-column:1/-1; color:var(--text-muted); text-align:center; padding:20px;">'
        + (quota <= 0
            ? '✅ 今日新词额度已用完（' + dailyNewGoal() + ' 张）。复习旧词巩固一下，明天再来学新词吧。'
            : '所有词都已经过了一遍。继续掌握已有词汇吧。')
        + '</div>';
    } else {
      news.forEach(c => newList.appendChild(makeWordCard(c)));
    }
  }

  // ============================================================
  // 错题本视图
  // ============================================================
  let errorFilterTopic = '__all__';
  function renderErrorBank() {
    // 渲染主题筛选
    const bar = document.getElementById('errorFilterBar');
    const topics = STATE.topics.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    bar.innerHTML = '<span class="pill ' + (errorFilterTopic === '__all__' ? 'active' : '') + '" data-topic-filter="__all__">全部</span>';
    topics.forEach(t => {
      const cnt = getErrorCards(t.topic_id).length;
      if (cnt > 0) {
        const sp = document.createElement('span');
        sp.className = 'pill' + (errorFilterTopic === t.topic_id ? ' active' : '');
        sp.dataset.topicFilter = t.topic_id;
        sp.textContent = `${t.icon || ''} ${t.name_zh} (${cnt})`;
        bar.appendChild(sp);
      }
    });
    bar.addEventListener('click', onFilterClick);
    function onFilterClick(e) {
      const el = e.target.closest('[data-topic-filter]');
      if (!el) return;
      errorFilterTopic = el.dataset.topicFilter;
      renderErrorBank();
    }

    const list = document.getElementById('errorList');
    const cards = getErrorCards(errorFilterTopic);
    list.innerHTML = '';
    const empty = document.getElementById('errorEmpty');
    if (cards.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      cards.forEach(c => list.appendChild(makeWordCard(c)));
    }
  }

  // ============================================================
  // 设置视图
  // ============================================================
  function renderSettings() {
    document.querySelectorAll('input[name=rate]').forEach(el => {
      el.checked = parseFloat(el.value) === (STATE.settings.rate || 1);
    });
    document.getElementById('localeSel').value = STATE.settings.locale || 'en-GB';

    const known = Object.values(STATE.progress.card_state).filter(s => s.status === 'known' && !s.was_shadow).length;
    const shadow = Object.values(STATE.progress.card_state).filter(s => s.was_shadow).length;
    const newc = Math.max(0, STATE.cards.length - known - shadow);
    document.getElementById('progressStats').innerHTML = `
      <span style="font-size:13px;">已掌握 <b style="color:var(--good)">${known}</b></span>
      <span style="font-size:13px;">错题 <b style="color:var(--bad)">${shadow}</b></span>
      <span style="font-size:13px;">未学 <b style="color:var(--text-muted)">${newc}</b></span>
      <div class="xp-bar"><div style="width:${Math.min(100, known / STATE.cards.length * 100).toFixed(1)}%"></div></div>
      <span style="font-size:12px; color: var(--text-muted);">XP ${STATE.progress.xp} · 连续 ${STATE.progress.streak || 0} 天</span>
    `;
  }
  document.querySelectorAll('input[name=rate]').forEach(el => el.addEventListener('change', () => {
    STATE.settings.rate = parseFloat(el.value);
    saveSettings();
  }));
  document.getElementById('localeSel').addEventListener('change', (e) => {
    STATE.settings.locale = e.target.value;
    saveSettings();
  });
  document.getElementById('btnResetProgress').addEventListener('click', () => {
    if (confirm('确认清空学习进度? 包括 XP、连续天数、状态标记。词表不会受影响。')) {
      STATE.progress = { card_state: {}, xp: 0, streak: 0, last_active: '' };
      saveProgress();
      renderSettings();
      updateNavBadges();
      alert('已重置。');
    }
  });

  // ============================================================
  // XP / 连胜 / 工具
  // ============================================================
  function bumpStreak() {
    const t = today();
    if (STATE.progress.last_active === t) return;
    if (STATE.progress.last_active && daysBetween(STATE.progress.last_active, t) === 1) {
      STATE.progress.streak = (STATE.progress.streak || 0) + 1;
    } else if (!STATE.progress.last_active) {
      STATE.progress.streak = 1;
    } else {
      STATE.progress.streak = 1;
    }
    STATE.progress.last_active = t;
    saveProgress();
    updateStreakBadge();
  }
  function addXP(n) {
    STATE.progress.xp = (STATE.progress.xp || 0) + n;
    saveProgress();
    document.getElementById('xpBadge').textContent = `XP ${STATE.progress.xp}`;
  }
  function updateStreakBadge() {
    document.getElementById('streakBadge').textContent = `⚡ ${STATE.progress.streak || 0} 天连续`;
  }
  function updateNavBadges() {
    const srsBadge = document.getElementById('srsBadge');
    const errBadge = document.getElementById('errBadge');
    const due = getDueCount();
    const err = getErrorCount();
    if (due > 0) {
      srsBadge.textContent = due > 99 ? '99+' : due;
      srsBadge.title = '今日待复习 ' + due + ' 张（SRS 到期 + 错题，不含新词）';
      srsBadge.style.display = 'inline-block';
    }
    else { srsBadge.style.display = 'none'; }
    if (err > 0) { errBadge.textContent = err; errBadge.style.display = 'inline-block'; }
    else { errBadge.style.display = 'none'; }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysBetween(a, b) {
    const A = new Date(a + 'T00:00:00');
    const B = new Date(b + 'T00:00:00');
    return Math.round((B - A) / 86400000);
  }

  // ============================================================
  // 录音跟读 (MediaRecorder) + 活动日志
  // ============================================================
  function bumpRecordCount(n) {
    const t = today();
    STATE.progress.rec_count = (STATE.progress.rec_count || 0) + (n || 1);
    // 活动日志: 每天记录动作数,供进度图表用
    STATE.progress.day_log[t] = (STATE.progress.day_log[t] || 0) + (n || 1);
    // 最近 14 天滚存 rec_history 简化
    let h = STATE.progress.rec_history || [];
    const last = h[h.length - 1];
    if (last && last.d === t) { last.n = (last.n || 0) + (n || 1); }
    else h.push({ d: t, n: n || 1 });
    if (h.length > 60) h = h.slice(-60);
    STATE.progress.rec_history = h;
    saveProgress();
  }

  const REC = { media: null, chunks: [], recording: false, list: [], idx: -1, mode: 'queue', current: null };

  function buildRecQueue() {
    const t = today();
    // 优先今日复习 + 错题, 不足时补新卡
    let list = getDueCards().slice();
    // 去重
    const seen = new Set(); let uniq = [];
    for (const c of list) { if (!seen.has(c.id)) { seen.add(c.id); uniq.push(c); } }
    list = uniq;
    if (list.length < 8) {
      for (const c of getNewCards(20)) { if (!seen.has(c.id)) { seen.add(c.id); list.push(c); } }
    }
    if (list.length < 8) {
      for (const c of STATE.cards) { if (!seen.has(c.id)) { seen.add(c.id); list.push(c); } }
    }
    return list.slice(0, 20);
  }
  function buildTopicRecQueue(topicId) {
    return STATE.cards.filter(c => c.topic === topicId);
  }

  function renderRecord() {
    const b = document.getElementById('recModeQueue');
    const t = document.getElementById('recModeTopic');
    if (REC.mode === 'topic') {
      b.classList.remove('active'); t.classList.add('active');
    } else {
      b.classList.add('active'); t.classList.remove('active');
    }
    REC.list = REC.mode === 'topic'
      ? buildTopicRecQueue(STATE.currentTopic)
      : buildRecQueue();
    REC.idx = -1;
    REC.current = null;
    stopRecording();
    showRecCard(0);
  }
  function showRecCard(dir) {
    if (!REC.list.length) {
      document.getElementById('recEn').textContent = '—';
      document.getElementById('recZh').textContent = '';
      document.getElementById('recEx').textContent = '没有可跟读的词。';
      document.getElementById('recProgress').textContent = '0 / 0';
      return;
    }
    if (dir === 1 && REC.idx < REC.list.length - 1) REC.idx++;
    if (dir === -1 && REC.idx > 0) REC.idx--;
    if (REC.idx < 0) REC.idx = 0;
    const c = REC.list[REC.idx];
    REC.current = c;
    document.getElementById('recEn').textContent = c.en;
    document.getElementById('recZh').textContent = c.zh || '';
    document.getElementById('recEx').textContent = c.ex || '';
    document.getElementById('recProgress').textContent = `${REC.idx + 1} / ${REC.list.length}`;
    const st = STATE.progress.card_state[c.id];
    const hint = st ? (st.status === 'known' ? '已掌握 · 下次复习 ' + (st.next_due || '—') : '错题/模糊 · 建议多读') : '新词';
    document.getElementById('recState').textContent = '⏺ 就绪 · ' + hint;
    stopRecording();
  }
  document.getElementById('recPrev').addEventListener('click', () => showRecCard(-1));
  document.getElementById('recNext').addEventListener('click', () => showRecCard(1));
  document.getElementById('recModeQueue').addEventListener('click', () => { REC.mode = 'queue'; renderRecord(); });
  document.getElementById('recModeTopic').addEventListener('click', () => { REC.mode = 'topic'; renderRecord(); });
  document.getElementById('recPlay').addEventListener('click', () => { const c = REC.current; if (c) speak(c.en, false); });
  document.getElementById('recPlaySlow').addEventListener('click', () => { const c = REC.current; if (c) speak(c.en, true); });
  document.getElementById('recSpeakEn').addEventListener('click', () => { const c = REC.current; if (c) speak(c.ex, false); });

  // 录音控制
  document.getElementById('recRecordBtn').addEventListener('click', async () => {
    if (REC.recording) { stopRecording(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('此浏览器不支持麦克风录音。请用 Chrome/Edge 或授予权限。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      REC.media = new MediaRecorder(stream);
      REC.chunks = [];
      REC.media.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
      REC.media.onstop = () => onRecStop();
      REC.media.start();
      REC.recording = true;
      const b = document.getElementById('recRecordBtn');
      b.textContent = '⏹ 停止';
      b.classList.add('recording');
      document.getElementById('recState').textContent = '🔴 录音中… 请跟读';
      document.querySelector('.rec-meter').classList.add('recording');
    } catch (err) {
      alert('无法访问麦克风: ' + err.message);
    }
  });
  function stopRecording() {
    if (REC.media && REC.recording) { REC.media.stop(); }
    REC.media = null; REC.chunks = [];
    REC.recording = false;
    const b = document.getElementById('recRecordBtn');
    if (b) { b.textContent = '⏺ 开始录音'; b.classList.remove('recording'); }
    const m = document.querySelector('.rec-meter');
    if (m) m.classList.remove('recording');
  }
  function onRecStop() {
    REC.recording = false;
    const b = document.getElementById('recRecordBtn');
    if (b) { b.textContent = '⏺ 开始录音'; b.classList.remove('recording'); }
    const m = document.querySelector('.rec-meter');
    if (m) m.classList.remove('recording');
    const blob = new Blob(REC.chunks, { type: 'audio/webm' });
    if (blob.size < 300) { showSelfRate(null); return; }
    const url = URL.createObjectURL(blob);
    bumpRecordCount(1);
    showSelfRate(url);
  }
  function showSelfRate(url) {
    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const c = REC.current;
    const hasWord = c && c.en;
    const hasEx = c && c.ex;
    const scoreBtns = (hasSR && (hasWord || hasEx))
      ? '<div class="score-row" style="margin-top:10px;">'
        + '<div style="font-size:12px; color: var(--text-soft); width:100%; margin-bottom:4px;">📊 真实发音评分（在线 · 需授权麦克风）</div>'
        + (hasWord ? '<button class="pill primary" data-score="word">📊 评分单词</button>' : '')
        + (hasEx ? '<button class="pill primary" data-score="ex">📊 评分例句</button>' : '')
        + '</div>'
      : (hasSR ? '' : '<div style="font-size:11px; color: var(--text-muted); margin-top:6px;">⚠ 当前浏览器不支持 Web Speech API，已仅显示自评</div>');
    const r = document.getElementById('recResult');
    r.innerHTML = (url
        ? `<audio controls src="${url}" style="width:100%; margin-bottom:10px; border-radius:8px;"></audio>`
        : '<div style="color:var(--text-muted); font-size:12px; margin-bottom:6px;">（未录制到有效音频）</div>')
      + '<div style="margin-bottom:6px; font-size:13px; color: var(--text-soft);">✋ 自我评估（离线，无需联网）</div>'
      + '<div class="selfrate">'
      + '<button class="pill good" data-rate="fluent">😊 流利</button>'
      + '<button class="pill warn" data-rate="hard">😅 费劲</button>'
      + '<button class="pill danger" data-rate="stuck">😖 卡壳</button>'
      + '</div>'
      + scoreBtns;
  }
  document.getElementById('recResult').addEventListener('click', (e) => {
    const bt = e.target.closest('[data-rate]');
    if (!bt) return;
    const c = REC.current;
    if (!c) return;
    const rate = bt.dataset.rate;
    const correct = rate === 'fluent';
    recordResult(c.id, correct, correct ? null : 'shadow');
    addXP(correct ? 4 : 1);
    updateNavBadges();
    bt.closest('.selfrate').innerHTML = correct
      ? '<span style="color:var(--good); font-weight:600;">✅ 已计入掌握</span>'
      : '<span style="color:var(--warn); font-weight:600;">📝 已加入复习</span>';
    document.getElementById('recState').textContent = '⏺ 就绪';
  });

  // ============================================================
  // 真实发音评分 (Web Speech API SpeechRecognition)
  // ============================================================
  // 1) 编辑距离 (Levenshtein) - 用于单词级模糊匹配
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const v0 = new Array(b.length + 1);
    const v1 = new Array(b.length + 1);
    for (let i = 0; i <= b.length; i++) v0[i] = i;
    for (let i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let k = 0; k <= b.length; k++) v0[k] = v1[k];
    }
    return v1[b.length];
  }
  // 2) 标准化 + 分词
  function _normTokenize(s) {
    return (s || '').toLowerCase()
      .replace(/[.,!?;:"'`()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
  }
  // 3) 比对 target vs transcript
  //    - 命中：target 词在 transcript 中出现
  //    - 模糊命中：编辑距离 ≤1 的近似词，给 0.5 权重
  //    - 丢分：完全没找到
  //    - 多余：transcript 有但 target 没有的词（不扣分）
  function scorePronunciation(target, transcript) {
    const tgt = _normTokenize(target);
    const got = _normTokenize(transcript);
    if (!tgt.length) return { score: 0, perWord: [], raw: { tgt, got } };
    const used = new Set();
    const perWord = tgt.map((w) => {
      // 1) 精确匹配
      for (let i = 0; i < got.length; i++) {
        if (used.has(i)) continue;
        if (got[i] === w) { used.add(i); return { w, kind: 'hit', weight: 1 }; }
      }
      // 2) 模糊匹配 (levenshtein ≤ 1 且长度 ≥ 2)
      if (w.length >= 2) {
        for (let i = 0; i < got.length; i++) {
          if (used.has(i)) continue;
          if (Math.abs(got[i].length - w.length) > 1) continue;
          if (levenshtein(w, got[i]) <= 1) { used.add(i); return { w, kind: 'hit', weight: 0.7, got: got[i] }; }
        }
      }
      return { w, kind: 'miss', weight: 0 };
    });
    const score = Math.round(perWord.reduce((s, x) => s + x.weight, 0) / tgt.length * 100);
    return { score, perWord, raw: { tgt, got } };
  }
  // 4) 把评分结果渲染成 HTML
  function renderScoreResult(kind, target, result, best, attempts) {
    const level = result.score >= 80 ? 's-good' : (result.score >= 50 ? 's-mid' : 's-bad');
    const icon = result.score >= 80 ? '🌟' : (result.score >= 50 ? '👍' : '💪');
    const words = result.perWord.map((x) => {
      const cls = x.kind === 'miss' ? 'miss' : 'hit';
      const title = x.got ? ` title="你说: ${escapeHtml(x.got)}"` : '';
      return `<span class="w ${cls}"${title}>${escapeHtml(x.w)}</span>`;
    }).join('');
    const tr = result.raw.got.join(' ');
    const hisTxt = (best != null && attempts > 1)
      ? `<div class="score-history">历史最佳 ${best} 分 · 已尝试 ${attempts} 次</div>`
      : (attempts > 1 ? `<div class="score-history">已尝试 ${attempts} 次</div>` : '');
    return `<div style="margin-top:14px;">`
      + `<div style="font-size:12px; color:var(--text-soft);">${icon} ${kind === 'word' ? '单词' : '例句'} 真实评分</div>`
      + `<span class="score-badge ${level}">${result.score} 分</span>`
      + `<div class="scored-target">${words}</div>`
      + `<div class="score-tr">你识别到: <i>${escapeHtml(tr || '(无)')}</i></div>`
      + hisTxt
      + `</div>`;
  }
  // 5) 启动 SpeechRecognition
  const REC_SCORE = { recognizer: null, listening: false, lastBlob: null };
  function startAutoScore(kind) {
    const c = REC.current;
    if (!c) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('当前浏览器不支持 Web Speech API。'); return; }
    if (REC_SCORE.listening) { stopAutoScore(); return; }
    const target = (kind === 'ex' ? c.ex : c.en) || '';
    if (!target) { alert('没有可评分的文本'); return; }
    const r = new SR();
    r.lang = 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalTranscript = '';
    let interim = '';
    const box = document.getElementById('recResult');
    // 插一个 listening 提示
    const tip = document.createElement('div');
    tip.id = 'recScoreLive';
    tip.className = 'listening';
    tip.innerHTML = `🎙 正在聆听… 请朗读:<br><b style="font-size:15px;">"${escapeHtml(target)}"</b><br><span id="recScoreLiveText" style="font-size:12px; color:#475569;"></span>`;
    box.appendChild(tip);
    r.onresult = (ev) => {
      interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const tr = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTranscript += tr;
        else interim += tr;
      }
      const live = document.getElementById('recScoreLiveText');
      if (live) live.textContent = `… ${(finalTranscript + interim).trim() || '等待语音…'}`;
    };
    r.onerror = (ev) => {
      console.warn('SR error', ev.error);
      const tip = document.getElementById('recScoreLive');
      if (tip) tip.innerHTML = `❌ 识别失败: ${ev.error}（可能未授予麦克风权限）`;
      REC_SCORE.listening = false;
      REC_SCORE.recognizer = null;
    };
    r.onend = () => {
      REC_SCORE.listening = false;
      REC_SCORE.recognizer = null;
      const tip = document.getElementById('recScoreLive');
      if (tip) tip.remove();
      const transcript = (finalTranscript + interim).trim();
      if (!transcript) {
        const e = document.createElement('div');
        e.className = 'listening';
        e.style.background = '#fee2e2'; e.style.color = '#991b1b';
        e.textContent = '⚠ 没听到声音。请重试并检查麦克风权限。';
        box.appendChild(e);
        return;
      }
      const result = scorePronunciation(target, transcript);
      // 保存到 progress
      const cid = c.id;
      const cur = (STATE.progress.rec_scores && STATE.progress.rec_scores[cid]) || { best: 0, attempts: 0, history: [] };
      cur.attempts += 1;
      cur.last = result.score;
      cur.best = Math.max(cur.best || 0, result.score);
      cur.history = (cur.history || []).concat([result.score]).slice(-5);
      if (!STATE.progress.rec_scores) STATE.progress.rec_scores = {};
      STATE.progress.rec_scores[cid] = cur;
      saveProgress();
      // 渲染
      const html = renderScoreResult(kind, target, result, cur.best, cur.attempts);
      box.insertAdjacentHTML('beforeend', html);
      // 评分 >= 80 自动视为"流利", 进 SRS
      if (result.score >= 80) {
        recordResult(cid, true);
        addXP(6);
        updateNavBadges();
      } else if (result.score < 50) {
        recordResult(cid, false, 'shadow');
        addXP(2);
        updateNavBadges();
      }
    };
    try {
      r.start();
      REC_SCORE.listening = true;
      REC_SCORE.recognizer = r;
    } catch (e) {
      alert('启动识别失败: ' + e.message);
    }
  }
  function stopAutoScore() {
    if (REC_SCORE.recognizer) { try { REC_SCORE.recognizer.stop(); } catch (e) {} }
    REC_SCORE.recognizer = null;
    REC_SCORE.listening = false;
  }
  // 6) 接管 [data-score] 点击
  document.getElementById('recResult').addEventListener('click', (e) => {
    const bt = e.target.closest('[data-score]');
    if (!bt) return;
    const kind = bt.dataset.score;
    startAutoScore(kind);
  });

  // ============================================================
  // 进度可视化 (Canvas)
  // ============================================================
  function renderProgress() {
    renderKPI();
    drawMasteryChart();
    renderSRSLadder();
    drawActivityChart();
    renderAdvice();
  }
  function renderKPI() {
    const total = STATE.cards.length;
    const cs = STATE.progress.card_state;
    let known = 0, shadow = 0;
    for (const k in cs) {
      if (cs[k].status === 'known') known++;
      if (cs[k].status === 'shadow' || cs[k].was_shadow) shadow++;
    }
    const due = getDueCount();
    const err = getErrorCount();
    const kpi = [
      { label: '总词卡', value: total, sub: STATE.topics.length + ' 个主题' },
      { label: '已掌握', value: known, sub: Math.round(known / total * 100) + '%', accent: 'var(--good)' },
      { label: '待巩固', value: shadow, sub: '模糊 / 错题' },
      { label: '今日复习', value: due, sub: 'SRS 到期 + 错题' },
      { label: '错题本', value: err, sub: '连对 2 次移出' },
      { label: '连续天数', value: STATE.progress.streak || 0, sub: '天' },
      { label: '累计 XP', value: STATE.progress.xp || 0, sub: '积分' },
      { label: '跟读次数', value: STATE.progress.rec_count || 0, sub: '录音练习', accent: 'var(--accent-strong)' },
    ];
    // 平均发音分
    const rs = STATE.progress.rec_scores || {};
    const scoreVals = [];
    for (const k in rs) if (rs[k] && typeof rs[k].last === 'number') scoreVals.push(rs[k].last);
    const avgScore = scoreVals.length ? Math.round(scoreVals.reduce((a,b)=>a+b,0) / scoreVals.length) : null;
    if (avgScore != null) {
      kpi.push({ label: '发音均分', value: avgScore, sub: `${scoreVals.length} 次评分`, accent: avgScore >= 80 ? 'var(--good)' : (avgScore >= 50 ? 'var(--warn)' : 'var(--danger)') });
    }
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = '';
    kpi.forEach(k => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.innerHTML = `<div class="kpi-label">${escapeHtml(k.label)}</div>`
        + `<div class="kpi-value" style="${k.accent ? 'color:' + k.accent + ';' : ''}">${escapeHtml(String(k.value))}</div>`
        + `<div class="kpi-sub">${escapeHtml(k.sub)}</div>`;
      grid.appendChild(card);
    });
  }
  function drawMasteryChart() {
    const cv = document.getElementById('masteryChart');
    if (!cv || !cv.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 640;
    const H = cv.clientHeight || 200;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padL = 6, padR = 6, padT = 12, padB = 42;
    const cs = STATE.progress.card_state;
    const topics = STATE.topics.slice().sort((a,b) => (a.order||0)-(b.order||0));
    if (!topics.length) return;
    const plotW = W - padL - padR;
    const chW = plotW / topics.length;
    const maxBarH = H - padT - padB;
    const barW = Math.max(8, Math.min(chW * 0.6, 46));
    const colors = topics.map(t => t.color || '#94a3b8');

    topics.forEach((t, i) => {
      const cards = STATE.cards.filter(c => c.topic === t.topic_id);
      const known = cards.filter(c => cs[c.id]?.status === 'known').length;
      const ratio = cards.length ? known / cards.length : 0;
      const barH = ratio > 0 ? Math.max(4, ratio * maxBarH) : 2;
      const cx = padL + i * chW + chW / 2;
      const x = padL + i * chW + (chW - barW) / 2;
      const y = padT + (maxBarH - barH);
      // bg track
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x, padT, barW, maxBarH);
      // fill
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, barW, barH);
      // % on top of bar
      if (known > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(Math.round(ratio * 100) + '%', cx, y - 2);
      }
      // x label (auto-truncate so it never overlaps)
      const maxChars = chW >= 80 ? 5 : (chW >= 52 ? 4 : 3);
      const nm = t.name_zh || t.topic_id;
      const label = nm.length > maxChars ? nm.slice(0, maxChars) : nm;
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, cx, H - 24);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${known}/${cards.length}`, cx, H - 10);
    });
  }
  function renderSRSLadder() {
    const INTERVALS = [1, 2, 4, 7, 15, 30, '30+'];
    const cs = STATE.progress.card_state;
    const buckets = new Array(INTERVALS.length).fill(0);
    for (const c of STATE.cards) {
      const s = cs[c.id];
      if (!s) continue;
      if (s.status !== 'known') continue;
      const reps = s.reps || 0;
      const idx = Math.min(Math.max(reps - 1, 0), INTERVALS.length - 1);
      buckets[idx]++;
    }
    const totalKnown = buckets.reduce((a,b)=>a+b, 0);
    const wrap = document.getElementById('srsLadder');
    wrap.innerHTML = '';
    // 未学 (totalKnown=0 时可显示)
    const unlearned = STATE.cards.length - totalKnown;
    const items = [...INTERVALS.map((lab,i)=>({lab, cnt: buckets[i]})), {lab:'未学', cnt: unlearned}];
    items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'ladder-item';
      d.innerHTML = `<div class="ladder-count">${it.cnt}</div><div class="ladder-label">${escapeHtml(String(it.lab))}</div>`;
      wrap.appendChild(d);
    });
  }
  function drawActivityChart() {
    const cv = document.getElementById('activityChart');
    if (!cv || !cv.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 640, H = cv.clientHeight || 90;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const days = [];
    const dl = STATE.progress.day_log || {};
    const t0 = new Date(); t0.setHours(0,0,0,0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(t0); d.setDate(t0.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      days.push({ key, n: dl[key] || 0 });
    }
    const maxV = Math.max(1, ...days.map(x => x.n));
    const bw = (W - 8) / days.length;
    for (let i = 0; i < days.length; i++) {
      const x = 4 + i * bw;
      const h = Math.max(3, (days[i].n / maxV) * (H - 10));
      ctx.fillStyle = days[i].n ? '#0f766e' : '#e2e8f0';
      ctx.fillRect(x, H - 3 - h, bw - 2, h);
    }
  }
  function renderAdvice() {
    const box = document.getElementById('adviceBox');
    const cs = STATE.progress.card_state;
    const known = Object.values(cs).filter(s => s.status === 'known').length;
    const err = getErrorCount();
    let html = '';
    if (known === 0) {
      html = '📚 刚开始。建议先玩一轮「碰碰乐」熟悉配对，再进「跟读」练发音。';
    } else {
      html += `✅ 已掌握 ${known} 张（${Math.round(known/STATE.cards.length*100)}%）。`;
      if (err > 0) html += ` <b>${err}</b> 张在错题本里，优先复习它们。`;
      const due = getDueCount();
      if (due > 0) html += ` 今日还有 <b>${due}</b> 张待复习。`;
      const rec = STATE.progress.rec_count || 0;
      if (rec < 10) html += ' 你的弱项是口语，建议每天至少跟读 5 次。';
      else html += ` 🎙 已跟读 ${rec} 次，继续保持开口练习。`;
    }
    box.innerHTML = html;
  }


  // ============================================================
  // 启动
  // ============================================================
  updateStreakBadge();
  document.getElementById('xpBadge').textContent = 'XP ' + (STATE.progress.xp || 0);
  updateNavBadges();
  applyHash();
})();

// ============================================================
// PWA: 注册 Service Worker (仅当运行在 HTTP/HTTPS 下才生效)
// file:// 双击打开时静默跳过, 不影响普通使用
// ============================================================
if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(
      (reg) => console.log('[PWA] SW registered, scope:', reg.scope),
      (err) => console.warn('[PWA] SW register failed:', err)
    );
  });
}
</script>

</body>
</html>
"""


def _read_env_file(path):
    """读取 .env 风格的 key=value 文件"""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _build_sync_block(cfg, env):
    """构造注入到 HTML 内的 <script> 块:Supabase SDK + lib/*.js + stage5 init"""
    sb = cfg.get("supabase", {}) if isinstance(cfg, dict) else {}
    enabled = bool(sb.get("enabled"))
    url = sb.get("url") or env.get("SUPABASE_URL") or ""
    key = sb.get("anon_key") or env.get("SUPABASE_ANON_KEY") or ""

    # 仍未配置 → 占位(让前端降级本地模式)
    if not enabled or not url or not key or url.startswith("https://YOUR"):
        url, key = "", ""

    lib_dir = os.path.join(HERE, "lib")
    def _read(name):
        p = os.path.join(lib_dir, name)
        if not os.path.exists(p):
            return "/* missing " + name + " */"
        with open(p, encoding="utf-8") as f:
            return f.read()

    db_js      = _read("db.js")
    sync_js    = _read("sync.js")
    auth_js    = _read("auth-ui.js")
    install_js = _read("install-prompt.js")

    # Supabase SDK CDN (仅在启用且有 URL 时)
    sdk_tag = ""
    if url and key:
        sdk_tag = (
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">'
            '</script>'
        )

    # 注入到前端 window.SupabaseCfg
    cfg_json = json.dumps({
        "url": url,
        "anon_key": key
    }, ensure_ascii=False)

    # 完整 stage5 init 块
    init_block = (
        '<script>window.__STAGE5_INIT__ = async function () {\n'
        '  try {\n'
        '    // 0) 给 supabase SDK 一个 tick\n'
        '    await new Promise(function (r) { setTimeout(r, 0); });\n'
        '    // 1) 触发 IndexedDB 打开\n'
        '    if (window.LVDB) { try { await window.LVDB.getAll("meta"); } catch (e) { console.warn("[stage5] IDB open fail", e); } }\n'
        '    // 2) 初始化同步\n'
        '    if (window.Sync) {\n'
        '      window.Sync.init(' + cfg_json + ');\n'
        '      try { await window.Sync.restoreSession(); } catch (e) { console.warn("[stage5] restoreSession", e); }\n'
        '    }\n'
        '    // 3) UI\n'
        '    if (window.AuthUI) window.AuthUI.init();\n'
        '    if (window.InstallPrompt) window.InstallPrompt.init();\n'
        '  } catch (e) { console.error("[stage5] init crashed", e); }\n'
        '};<' + '/script>'
    )

    parts = [sdk_tag]
    parts.append('<script>\n' + db_js + '\n<' + '/script>')
    parts.append('<script>\n' + sync_js + '\n<' + '/script>')
    parts.append('<script>\n' + auth_js + '\n<' + '/script>')
    parts.append('<script>\n' + install_js + '\n<' + '/script>')
    parts.append(init_block)
    return "\n".join(p for p in parts if p)


def build(data_dir: str, out_path: str, config_path: str = None) -> None:
    with open(os.path.join(data_dir, "topics.json"), encoding="utf-8") as f:
        topics = json.load(f)
    with open(os.path.join(data_dir, "cards.json"), encoding="utf-8") as f:
        cards = json.load(f)

    # 读取构建配置
    cfg_path = config_path or os.path.join(HERE, "build-config.json")
    cfg = {}
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception as e:
            print(f"[warn] 解析 {cfg_path} 失败: {e}")
    env = _read_env_file(os.path.join(HERE, ".env.local"))

    # 音频策略: embed=false 时不嵌入 mp3 路径, speak() 自动走浏览器 TTS 兜底
    if not cfg.get("audio", {}).get("embed", True):
        _audio_keys = ("audio_word", "audio_example", "audio_word_slow", "audio_example_slow")
        for _c in cards:
            for _k in _audio_keys:
                _c.pop(_k, None)
        print("[OK] 音频路径已剥离, 发音走浏览器 TTS")

    app_data = {"topics": topics, "cards": cards}
    app_data_json = json.dumps(app_data, ensure_ascii=False, separators=(",", ":"))
    sync_block = _build_sync_block(cfg, env)

    out_html = HTML_TEMPLATE.replace("__APP_DATA_JSON__", app_data_json)
    out_html = out_html.replace("__SYNC_SCRIPTS__", sync_block)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out_html)
    print(f"[OK] 已生成 {out_path}")
    print(f"[OK] 主题数 {len(topics)}, 卡片数 {len(cards)}")
    print(f"[OK] 输出大小 {os.path.getsize(out_path) / 1024:.1f} KB")
    if cfg.get("supabase", {}).get("enabled") and env.get("SUPABASE_URL") or (cfg.get("supabase", {}).get("url") and "YOUR-" not in cfg.get("supabase", {}).get("url", "")):
        print("[OK] 云同步已启用 (Supabase)")
    else:
        print("[info] 云同步未配置 (本地模式:数据存 IndexedDB)")

    # 生成纯净部署目录 dist/(仅核心静态文件, 供 Cloudflare Pages 部署)
    dist_dir = os.path.join(HERE, "dist")
    shutil.rmtree(dist_dir, ignore_errors=True)
    os.makedirs(os.path.join(dist_dir, "icons"), exist_ok=True)
    shutil.copy2(out_path, os.path.join(dist_dir, "index.html"))
    for _name in ("manifest.webmanifest", "sw.js"):
        _src = os.path.join(HERE, _name)
        if os.path.exists(_src):
            shutil.copy2(_src, os.path.join(dist_dir, _name))
    _icons_src = os.path.join(HERE, "icons")
    if os.path.isdir(_icons_src):
        for _f in os.listdir(_icons_src):
            _fp = os.path.join(_icons_src, _f)
            if os.path.isfile(_fp):
                shutil.copy2(_fp, os.path.join(dist_dir, "icons", _f))
    print(f"[OK] 部署目录 dist/ 已就绪 (index.html + manifest + sw.js + icons)")


def main():
    p = argparse.ArgumentParser(description="life-vocab-app 构建脚本:把 JSON 数据嵌入到 index.html")
    p.add_argument("--data-dir", default=os.path.join(HERE, "data"))
    p.add_argument("--out", default=os.path.join(HERE, "index.html"))
    args = p.parse_args()
    build(args.data_dir, args.out)


if __name__ == "__main__":
    main()