#!/usr/bin/env python3
"""Generate the default LINE rich menu PNG from the documented 2x3 spec."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 2500
HEIGHT = 1686
COLUMN_WIDTHS = (833, 834, 833)
ROW_HEIGHTS = (843, 843)
CELLS = (
    ("今週", "サマリー"),
    ("支出", "今週の支出"),
    ("収入", "今週の収入"),
    ("内訳", "カテゴリ別"),
    ("推移", "週別推移"),
    ("使い方", "案内"),
)

PAPER = (247, 237, 226)
PANEL = (255, 253, 248)
SPARROW = (139, 94, 60)
LEAF = (166, 178, 139)
TEXT = (61, 44, 34)
MUTED = (118, 95, 79)
BORDER = (201, 184, 168)


def cell_origin(column: int, row: int) -> tuple[int, int]:
    return (sum(COLUMN_WIDTHS[:column]), sum(ROW_HEIGHTS[:row]))


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_centered(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    y_offset: int = 0,
) -> None:
    left, top, right, bottom = box
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    x = left + (right - left - text_width) // 2 - text_bbox[0]
    y = top + (bottom - top - text_height) // 2 - text_bbox[1] + y_offset
    draw.text((x, y), text, font=font, fill=fill)


def generate(output: Path) -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    title_font = load_font(96)
    caption_font = load_font(42)

    for index, (label, caption) in enumerate(CELLS):
        column = index % 3
        row = index // 3
        x, y = cell_origin(column, row)
        width = COLUMN_WIDTHS[column]
        height = ROW_HEIGHTS[row]
        inset = 28
        draw.rounded_rectangle(
            (x + inset, y + inset, x + width - inset, y + height - inset),
            radius=36,
            fill=PANEL,
            outline=LEAF if index == 0 else BORDER,
            width=8,
        )
        box = (x, y, x + width, y + height)
        draw_centered(draw, box, label, title_font, SPARROW, y_offset=-36)
        draw_centered(draw, box, caption, caption_font, MUTED, y_offset=86)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default="docs/line/rich-menu-readonly-summary.png",
        type=Path,
    )
    args = parser.parse_args()
    generate(args.output)


if __name__ == "__main__":
    main()
