#!/usr/bin/env python3
"""从 pm-english/cards.md 抽取 158 张商务卡,转换为 life-vocab-app 卡片格式,
导出 _business.json 用于合并入 data/cards.json。
"""
import re
import json
import os
import sys

SRC = r"C:\Users\Administrator\WorkBuddy\2026-09-03-17-05-46\pm-english\cards.md"
DST = r"C:\Users\Administrator\WorkBuddy\2026-09-07-10-49-08\life-vocab-app\data\_business.json"


# 模块英文短代码 (便于内部使用, 不影响 UI 显示)
MODULE_TO_CODE = {
    'M1': 'meeting',
    'M2': 'schedule',
    'M3': 'data',
    'M4': 'risks',
    'M5': 'resources',
    'M6': 'mill',
    'M7': 'commissioning',
    'M8': 'payments',
    'M9': 'scope',
    'M10': 'spareparts',
    'M11': 'cost',
    'M12': 'stakeholders',
}


def parse_cards_md(text: str):
    """扫描 cards.md 抽取每张卡的 (id, en, zh, ex, sc, tip, module)。"""
    cards = []
    # 模块标题: ## M1 · 会议开场与收尾（Meeting Management）
    module_pattern = re.compile(r'^## (M\d+)\s+·\s+([^（]+)(?:（([^）]+)）)?', re.MULTILINE)
    # 卡片标题: ### 001 · kick-off meeting　`D1`
    # 也兼容: ### 009 · time-box　`D3`
    card_pattern = re.compile(
        r'^###\s+(\d+)\s+·\s+([^\s`]+)(?:\s+`([^`]+)`)?', re.MULTILINE
    )
    # 字段: - **中文释义**：xxx
    field_pattern = re.compile(r'^- \*\*([^*]+)\*\*[：:]\s*(.*)$', re.MULTILINE)

    module_map = {}
    for m in module_pattern.finditer(text):
        code = m.group(1)
        module_map[m.start()] = code

    for m in card_pattern.finditer(text):
        cid = int(m.group(1))
        en = m.group(2)
        day = m.group(3) or ''

        # 找当前位置之前的最近 module 标题
        module_code = None
        for ms, mc in sorted(module_map.items(), reverse=True):
            if ms < m.start():
                module_code = mc
                break
        if not module_code:
            continue

        # 切片: 卡片段到下一张 ### 或 ## 为止
        end = len(text)
        nxt_card = card_pattern.search(text, m.end())
        nxt_mod = module_pattern.search(text, m.end())
        for n in (nxt_card, nxt_mod):
            if n and n.start() < end:
                end = n.start()
        block = text[m.end():end]

        # 解析字段
        fields = {}
        for f in field_pattern.finditer(block):
            key = f.group(1).strip()
            val = f.group(2).strip()
            fields[key] = val

        zh = fields.get('中文释义', '')
        ex = fields.get('英文例句', '')
        sc = fields.get('汇报场景', '')
        tip = fields.get('沟通要点', '')

        if not en or not zh:
            continue

        cards.append({
            'id': cid,
            'en': en,
            'zh': zh,
            'ex': ex,
            'ex_zh': '',  # 原 cards.md 没有, 留空
            'sc': sc,
            'tip': tip,
            'module': module_code,
            'day': day,
        })

    return cards


def to_life_vocab_card(c, start_id: int) -> dict:
    """映射到 life-vocab-app 卡片格式。"""
    en = c['en']
    # 例句的 TTS 文本 = 原文 ex (避免再次塞 en 短语)
    # 短词要补例句上下文才能听清, ex 不为空就用 ex 作为 TTS 文本
    return {
        'id': start_id + (c['id'] - 1),
        'topic': 'business',
        'scene': c['module'],  # meeting/schedule/... 用于二级分组
        'en': en,
        'zh': c['zh'],
        'ex': c['ex'],
        'ex_zh': c.get('ex_zh', ''),
        'sc': c.get('sc', ''),
        'tip': c.get('tip', ''),
        'ipa': '',
        'difficulty': 'B',  # Business
        'audio_word': '',
        'audio_example': '',
        'audio_word_slow': '',
        'audio_example_slow': '',
    }


def main():
    if not os.path.isfile(SRC):
        print(f'!! 找不到: {SRC}', file=sys.stderr)
        sys.exit(1)

    with open(SRC, encoding='utf-8') as f:
        text = f.read()

    raw = parse_cards_md(text)
    print(f'解析商务卡: {len(raw)} 张')
    if len(raw) != 158:
        print(f'  !! 期望 158, 实际 {len(raw)}')
        # 打印前 3 看格式
        for i, c in enumerate(raw[:3]):
            print(f'    [{i}]', c['id'], c['en'], '| zh:', c['zh'][:30])

    # 计算起始 id: 当前 life-vocab-app 中 id 最大值 + 1
    LV = r"C:\Users\Administrator\WorkBuddy\2026-09-07-10-49-08\life-vocab-app\data\cards.json"
    with open(LV, encoding='utf-8') as f:
        existing = json.load(f)
    start_id = max(c['id'] for c in existing) + 1
    print(f'当前生命词汇最大 id: {start_id - 1}, 商务卡从 {start_id} 开始')

    out_cards = [to_life_vocab_card(c, start_id) for c in raw]

    # 统计模块分布
    from collections import Counter
    cnt = Counter(c['scene'] for c in out_cards)
    print('模块分布:')
    for k in sorted(cnt):
        print(f'  {k}: {cnt[k]}')

    with open(DST, 'w', encoding='utf-8') as f:
        json.dump(out_cards, f, ensure_ascii=False, indent=2)
    print(f'OK 写出 {DST} ({len(out_cards)} 张)')


if __name__ == '__main__':
    main()
