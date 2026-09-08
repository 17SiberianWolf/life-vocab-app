# -*- coding: utf-8 -*-
"""
life-vocab-app 离线听力音频预生成脚本

读取
  data/cards.json + data/topics.json

产出
  audio/word/{topic}/{id}.mp3        词发音（常速）
  audio/example/{topic}/{id}.mp3     例句发音（常速）
  audio/slow/{topic}/{id}_w.mp3      词发音 0.85 倍速（带 _w 后缀）
  audio/slow/{topic}/{id}_e.mp3      例句发音 0.85 倍速（带 _e 后缀）
  data/cards_with_audio.json         回填 audio 路径后的主数据(可选,首轮生成于 data/)

TTS 引擎
  edge-tts 免费神经语音，默认 en-GB-RyanNeural（贴合欧陆商务习惯）
  与 pm-english 项目的音色保持一致

用法
  pip install edge-tts
  python gen_audio.py                       # 全部
  python gen_audio.py --topic kitchen       # 仅厨房
  python gen_audio.py --limit 10            # 全部主题,每个主题前 10 张
  python gen_audio.py --rate +0%            # 调整语速(默认 +0%)
  python gen_audio.py --rewrite             # 强制覆盖已存在的 mp3
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
AUDIO = os.path.join(HERE, "audio")

DEFAULT_VOICE = "en-GB-RyanNeural"
ALT_VOICES = ("en-US-GuyNeural", "en-US-JennyNeural")


def clean(t: str) -> str:
    """去除多余空白"""
    return re.sub(r"\s+", " ", str(t or "")).strip()


def load_cards() -> list:
    with open(os.path.join(DATA, "cards.json"), encoding="utf-8") as f:
        return json.load(f)


def load_topics() -> list:
    with open(os.path.join(DATA, "topics.json"), encoding="utf-8") as f:
        return json.load(f)


async def synth_one(
    text: str,
    path: str,
    voice: str,
    rate: str = "+0%",
    retries: int = 3,
) -> bool:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not text:
        return False
    for attempt in range(retries):
        try:
            c = edge_tts.Communicate(text, voice, rate=rate)
            await c.save(path)
            return os.path.isfile(path) and os.path.getsize(path) > 0
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                print(f"  FAIL  {path}  <-- {e}", flush=True)
                return False
            await asyncio.sleep(1.5 * (attempt + 1))
    return False


async def run(
    cards: list,
    topics: list,
    voice: str,
    limit: int | None,
    rewrite: bool,
    rate_slow: str,
) -> dict:
    """返回统计信息"""
    by_topic = {}
    for t in topics:
        by_topic[t["topic_id"]] = t
    topic_ids = [t["topic_id"] for t in topics]

    selected = []
    for tid in topic_ids:
        topic_cards = [c for c in cards if c["topic"] == tid]
        if limit:
            topic_cards = topic_cards[:limit]
        selected.extend(topic_cards)

    print(f"\n[计划] voice={voice}  rate_slow={rate_slow}")
    print(f"[计划] 共 {len(selected)} 张卡 (主题数 {len(topic_ids)}, limit={limit})")
    print(f"[计划] 主题分布: " + ", ".join(
        f"{t['topic_id']}={sum(1 for c in selected if c['topic'] == t['topic_id'])}" for t in topics
    ))
    print()

    counters = {
        "word_ok": 0,
        "word_skip": 0,
        "word_fail": 0,
        "ex_ok": 0,
        "ex_skip": 0,
        "ex_fail": 0,
        "slow_ok": 0,
        "slow_skip": 0,
        "slow_fail": 0,
    }

    started = time.time()
    for c in selected:
        cid = c["id"]
        topic = c["topic"]
        en = clean(c.get("en") or c.get("tts_text", ""))
        ex = clean(c.get("ex") or c.get("example_tts", ""))

        # 路径
        word_path = os.path.join(AUDIO, "word", topic, f"{cid}.mp3")
        ex_path = os.path.join(AUDIO, "example", topic, f"{cid}.mp3")
        slow_word_path = os.path.join(AUDIO, "slow", topic, f"{cid}_w.mp3")
        slow_ex_path = os.path.join(AUDIO, "slow", topic, f"{cid}_e.mp3")

        # 常速 -- 词
        if not rewrite and os.path.isfile(word_path) and os.path.getsize(word_path) > 0:
            counters["word_skip"] += 1
        else:
            ok = await synth_one(en, word_path, voice=voice)
            counters["word_ok" if ok else "word_fail"] += 1
        # 常速 -- 例句
        if not rewrite and os.path.isfile(ex_path) and os.path.getsize(ex_path) > 0:
            counters["ex_skip"] += 1
        else:
            ok = await synth_one(ex, ex_path, voice=voice)
            counters["ex_ok" if ok else "ex_fail"] += 1
        # 慢速 -- 词
        if not rewrite and os.path.isfile(slow_word_path) and os.path.getsize(slow_word_path) > 0:
            counters["slow_skip"] += 1
        else:
            ok = await synth_one(en, slow_word_path, voice=voice, rate=rate_slow)
            counters["slow_ok" if ok else "slow_fail"] += 1
        # 慢速 -- 例句
        if not rewrite and os.path.isfile(slow_ex_path) and os.path.getsize(slow_ex_path) > 0:
            counters["slow_skip"] += 1
        else:
            ok = await synth_one(ex, slow_ex_path, voice=voice, rate=rate_slow)
            counters["slow_ok" if ok else "slow_fail"] += 1

        # 回填路径
        c["audio_word"] = os.path.relpath(word_path, HERE).replace("\\", "/")
        c["audio_example"] = os.path.relpath(ex_path, HERE).replace("\\", "/")
        c["audio_word_slow"] = os.path.relpath(slow_word_path, HERE).replace("\\", "/")
        c["audio_example_slow"] = os.path.relpath(slow_ex_path, HERE).replace("\\", "/")

        # 进度行 (每张一行)
        print(
            f"  #{cid:>3}  {topic:<8} {en[:30]:<30} -> ok={counters['word_ok']+counters['ex_ok']+counters['slow_ok']}",
            flush=True,
        )

    # 写回 cards.json (回填 audio 路径)
    with open(os.path.join(DATA, "cards.json"), "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
    print(f"\n[回填] 已写回 {os.path.join(DATA, 'cards.json')}")

    cost = time.time() - started
    print(f"\n[完成] 耗时 {cost:.1f}s")
    print(f"[统计] word: ok={counters['word_ok']} skip={counters['word_skip']} fail={counters['word_fail']}")
    print(f"[统计] ex  : ok={counters['ex_ok']} skip={counters['ex_skip']} fail={counters['ex_fail']}")
    print(f"[统计] slow: ok={counters['slow_ok']} skip={counters['slow_skip']} fail={counters['slow_fail']}")

    return counters


def parse_args():
    p = argparse.ArgumentParser(description="life-vocab-app 离线音频批量生成")
    p.add_argument("--voice", default=DEFAULT_VOICE, help=f"TTS 音色,默认 {DEFAULT_VOICE}")
    p.add_argument("--rate-slow", default="-15%", help="慢速档 rate 参数,默认 -15%")
    p.add_argument("--limit", type=int, default=None, help="每个主题生成前 N 张,默认不限")
    p.add_argument("--topic", default=None, help="仅生成指定主题,默认全部")
    p.add_argument("--rewrite", action="store_true", help="覆盖已存在的 mp3")
    return p.parse_args()


def main():
    args = parse_args()
    cards = load_cards()
    topics = load_topics()
    if args.topic:
        topics = [t for t in topics if t["topic_id"] == args.topic]
        if not topics:
            sys.exit(f"[错误] 未找到 topic={args.topic}")
    counters = asyncio.run(
        run(
            cards=cards,
            topics=topics,
            voice=args.voice,
            limit=args.limit,
            rewrite=args.rewrite,
            rate_slow=args.rate_slow,
        )
    )
    fails = counters["word_fail"] + counters["ex_fail"] + counters["slow_fail"]
    sys.exit(0 if fails == 0 else 2)


if __name__ == "__main__":
    main()
