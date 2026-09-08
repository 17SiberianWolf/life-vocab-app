#!/usr/bin/env python3
"""生成 PWA 图标: 192×192 与 512×512 PNG。"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "icons")
os.makedirs(OUT, exist_ok=True)

# 主题色 (商务绿, 与 topics.json 中 business color 一致)
ACCENT = (15, 118, 110)     # #0f766e
ACCENT2 = (245, 158, 11)    # #f59e0b (橙 - 生活)


def make_icon(size: int):
    """绘制带渐变 + 📚 字形的图标"""
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)

    # 圆角矩形背景 (BG = 渐变模拟: 双色叠加)
    radius = size // 6
    # 浅底
    d.rounded_rectangle((0, 0, size - 1, size - 1),
                        radius=radius, fill=(236, 254, 255, 255))
    # 顶部一条 accent 色块
    d.rounded_rectangle((0, 0, size - 1, size // 4),
                        radius=radius, fill=ACCENT)

    # 中央书本形状 (简笔) - 三条横线 + 矩形
    bx0 = size * 0.22
    bx1 = size * 0.78
    by0 = size * 0.36
    by1 = size * 0.78
    d.rounded_rectangle((bx0, by0, bx1, by1),
                        radius=size // 24, fill=(255, 255, 255, 255),
                        outline=ACCENT, width=max(2, size // 64))
    # 中线 (书本脊)
    mid = (bx0 + bx1) / 2
    d.line((mid, by0 + size * 0.04, mid, by1 - size * 0.04),
           fill=ACCENT, width=max(2, size // 80))
    # 三条横线
    line_w = (bx1 - bx0) * 0.32
    for i, frac in enumerate([0.25, 0.45, 0.65]):
        ly = by0 + (by1 - by0) * frac
        x0 = mid + size * 0.03
        x1 = x0 + line_w
        d.line((x0, ly, x1, ly), fill=ACCENT, width=max(2, size // 64))
        # 左侧镜像
        x0r = mid - size * 0.03 - line_w
        x1r = mid - size * 0.03
        d.line((x0r, ly, x1r, ly), fill=ACCENT, width=max(2, size // 64))

    # 顶部 accent 区中加 emoji 文本 📚 (用默认字体不可控, 用多色文字放 fallback; 简化)
    # 直接画个圆球装饰
    cx = size * 0.18
    cy = size * 0.12
    rad = size * 0.07
    d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad),
              fill=ACCENT2)

    img.save(os.path.join(OUT, f"icon-{size}.png"), optimize=True)


def make_maskable(size: int):
    """maskable 图标: 主体在中心 40% 安全区,背景铺满所有圆形裁剪"""
    img = Image.new("RGBA", (size, size), ACCENT)
    d = ImageDraw.Draw(img)
    # 书本居中
    bx0 = size * 0.32
    bx1 = size * 0.68
    by0 = size * 0.40
    by1 = size * 0.72
    d.rounded_rectangle((bx0, by0, bx1, by1),
                        radius=size // 24, fill=(255, 255, 255, 255),
                        outline=(255, 255, 255, 255), width=max(2, size // 64))
    mid = (bx0 + bx1) / 2
    d.line((mid, by0 + size * 0.04, mid, by1 - size * 0.04),
           fill=ACCENT, width=max(2, size // 80))
    line_w = (bx1 - bx0) * 0.30
    for frac in [0.25, 0.45, 0.65]:
        ly = by0 + (by1 - by0) * frac
        x0 = mid + size * 0.02
        x1 = x0 + line_w
        d.line((x0, ly, x1, ly), fill=ACCENT, width=max(2, size // 64))
        x0r = mid - size * 0.02 - line_w
        x1r = mid - size * 0.02
        d.line((x0r, ly, x1r, ly), fill=ACCENT, width=max(2, size // 64))

    img.save(os.path.join(OUT, f"icon-maskable-{size}.png"), optimize=True)


def main():
    for s in (192, 512):
        make_icon(s)
        make_maskable(s)
    print("OK 生成图标:")
    for f in sorted(os.listdir(OUT)):
        print(f"  {f}  ({os.path.getsize(os.path.join(OUT, f))} bytes)")


if __name__ == "__main__":
    main()
