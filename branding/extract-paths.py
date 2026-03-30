#!/usr/bin/env python3
"""Extract SVG path data for RAPID title glyphs from Noto Serif Bold.

Outputs branding/glyph-paths.json with Y-flipped path data suitable for
direct use in SVG <path> elements.

Fonts use Y-up coordinates; SVG uses Y-down. This script flips the Y axis
by negating Y values and translating by the font's ascender height so that
glyphs render right-side-up in SVG.
"""

import json
import os
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT_PATH = "/usr/share/fonts/noto/NotoSerif-Bold.ttf"
OUTPUT_PATH = Path(__file__).parent / "glyph-paths.json"
GLYPHS = ["R", "A", "P", "I", "D"]


def extract_glyph_paths():
    font = TTFont(FONT_PATH)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]

    upm = font["head"].unitsPerEm
    ascender = os2.sTypoAscender

    result = {
        "upm": upm,
        "ascender": ascender,
        "glyphs": {},
    }

    for char in GLYPHS:
        codepoint = ord(char)
        glyph_name = cmap[codepoint]

        # Record the glyph drawing commands
        recording_pen = RecordingPen()
        glyph_set[glyph_name].draw(recording_pen)

        # Replay into SVGPathPen with Y-flip transform
        # Transform: negate Y, then translate by ascender to shift into positive Y space
        # Matrix: (sx, shy, shx, sy, tx, ty) = (1, 0, 0, -1, 0, ascender)
        svg_pen = SVGPathPen(glyph_set)
        transform_pen = TransformPen(svg_pen, (1, 0, 0, -1, 0, ascender))
        recording_pen.replay(transform_pen)

        path_data = svg_pen.getCommands()
        advance_width = hmtx[glyph_name][0]

        result["glyphs"][char] = {
            "path": path_data,
            "advance": advance_width,
        }

    font.close()
    return result


def main():
    data = extract_glyph_paths()

    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Extracted {len(data['glyphs'])} glyphs to {OUTPUT_PATH}")
    for char, info in data["glyphs"].items():
        print(f"  {char}: advance={info['advance']}, path length={len(info['path'])} chars")


if __name__ == "__main__":
    main()
