#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
词库扩充工具
============
把 data/expansion/ 下的「批次文件」合并进 data/cards.json 与 data/topics.json。

批次文件格式 (data/expansion/batch_*.json):
{
  "topic": "office",
  "difficulty": 2,            // 可选, 该批默认难度
  "tags": ["work"],           // 可选, 追加到每张卡的 tags
  "items": [
    ["schedule", "安排;排定", "Let's schedule a meeting.", "我们把会议安排一下。", "会议安排"],
    ["agenda",  "议程",      "The first item on the agenda is budget.", "议程第一项是预算。", "会议", "可选 tip"]
  ]
}

item 字段: [en, zh, ex, ex_zh, sc] 或 [en, zh, ex, ex_zh, sc, scene] 或 [en, zh, ex, ex_zh, sc, scene, tip]
- item[5] = scene (str, subscene 筛选)
- item[6] = tip (str, 记忆提示)
- 也可在批次根声明 "scene_default" 统一指定

用法:
  python expand_vocab.py            # 合并所有批次并写入
  python expand_vocab.py --dry      # 只检查不写入
  python expand_vocab.py --stats    # 只看当前统计
"""

import json
import os
import shutil
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
EXPANSION = os.path.join(DATA, "expansion")
BACKUP = os.path.join(DATA, "backup")


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _backup(name):
    os.makedirs(BACKUP, exist_ok=True)
    src = os.path.join(DATA, name)
    if not os.path.exists(src):
        return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(src, os.path.join(BACKUP, f"{name.replace('.json', '')}_{ts}.json"))


def _audio_paths(topic, cid):
    return {
        "audio_word": f"audio/word/{topic}/{cid}.mp3",
        "audio_example": f"audio/example/{topic}/{cid}.mp3",
        "audio_word_slow": f"audio/slow/{topic}/{cid}_w.mp3",
        "audio_example_slow": f"audio/slow/{topic}/{cid}_e.mp3",
    }


def main():
    dry = "--dry" in sys.argv
    stats_only = "--stats" in sys.argv

    cards = _load(os.path.join(DATA, "cards.json"))
    topics = _load(os.path.join(DATA, "topics.json"))

    # 1) 新主题: 存在则跳过
    new_topics_path = os.path.join(EXPANSION, "topics_new.json")
    if os.path.exists(new_topics_path):
        existing_ids = {t["topic_id"] for t in topics}
        for nt in _load(new_topics_path):
            if nt["topic_id"] not in existing_ids:
                topics.append(nt)
                existing_ids.add(nt["topic_id"])
                print(f"[+] 新增主题: {nt['topic_id']} ({nt['name_zh']})")

    if stats_only:
        _print_stats(topics, cards)
        return

    # 2) 逐批次合并
    batch_files = sorted(
        f for f in os.listdir(EXPANSION)
        if f.startswith("batch_") and f.endswith(".json")
    )
    if not batch_files:
        print("[!] data/expansion/ 下没有 batch_*.json 文件")
        return

    topic_ids = {t["topic_id"] for t in topics}
    seen = {(c.get("topic"), str(c.get("en", "")).strip().lower()) for c in cards}
    next_id = max((c.get("id") or 0) for c in cards) + 1

    added, skipped = 0, 0
    per_topic = {}

    for bf in batch_files:
        batch = _load(os.path.join(EXPANSION, bf))
        tid = batch.get("topic")
        if tid not in topic_ids:
            print(f"[!] {bf}: 主题 {tid} 不存在, 跳过")
            continue
        default_diff = batch.get("difficulty", 2)
        default_scene = batch.get("scene_default", "")
        extra_tags = list(batch.get("tags") or [])

        for item in batch.get("items", []):
            if len(item) < 4:
                print(f"[!] {bf}: 条目字段不足 -> {item}")
                continue
            en = str(item[0]).strip()
            zh = str(item[1]).strip()
            ex = str(item[2]).strip()
            ex_zh = str(item[3]).strip()
            sc = str(item[4]).strip() if len(item) > 4 else ""
            tip = ""
            diff = default_diff
            scene = default_scene
            # 6th: scene (str)
            if len(item) > 5:
                scene = str(item[5]).strip() or default_scene
            # 7th: tip (str)
            if len(item) > 6:
                tip = str(item[6]).strip()

            key = (tid, en.lower())
            if not en or key in seen:
                skipped += 1
                continue
            seen.add(key)

            tags = list(dict.fromkeys(extra_tags + [tid]))
            card = {
                "id": next_id,
                "m": None,
                "topic": tid,
                "en": en,
                "zh": zh,
                "ex": ex,
                "ex_zh": ex_zh,
                "sc": sc,
                "scene": scene,
                "tip": tip,
                "difficulty": diff,
                "tags": tags,
            }
            card.update(_audio_paths(tid, next_id))
            cards.append(card)
            next_id += 1
            added += 1
            per_topic[tid] = per_topic.get(tid, 0) + 1

        print(f"[ok] {bf}: 主题 {tid}")

    # 3) 回写 card_count
    counts = {}
    for c in cards:
        counts[c["topic"]] = counts.get(c["topic"], 0) + 1
    for t in topics:
        t["card_count"] = counts.get(t["topic_id"], 0)

    print(f"\n新增 {added} 张卡, 跳过(重复/异常) {skipped} 条")
    for k, v in sorted(per_topic.items(), key=lambda x: -x[1]):
        print(f"  - {k}: +{v}")

    if dry:
        print("\n[dry-run] 未写入文件")
        return

    _backup("cards.json")
    _backup("topics.json")
    _save(os.path.join(DATA, "cards.json"), cards)
    _save(os.path.join(DATA, "topics.json"), topics)
    print(f"\n[OK] 已写入 data/cards.json ({len(cards)} 张) 与 data/topics.json ({len(topics)} 主题)")
    print("[OK] 原文件已备份到 data/backup/")


def _print_stats(topics, cards):
    counts = {}
    for c in cards:
        counts[c["topic"]] = counts.get(c["topic"], 0) + 1
    print(f"总卡片: {len(cards)}")
    for t in sorted(topics, key=lambda x: x.get("order", 0)):
        tid = t["topic_id"]
        print(f"  {tid:12s} {t['name_zh']:10s} {counts.get(tid, 0):5d} 张")


if __name__ == "__main__":
    main()
