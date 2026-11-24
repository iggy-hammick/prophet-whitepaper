"""Turn the hero title into an SVG of outlined Min Sans Bold lettering.

Lays the title out the way the browser did (HarfBuzz shaping, so kerning
matches), with the CSS line-height of 0.893em, and crops the viewBox the way
`text-box: trim-both cap alphabetic` did: from the cap height of the first
line to the baseline of the last. x = 0 is the text's left origin.

Usage: python make_title_svg.py FONT OUT.svg
"""
import sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

font_path, out_path = sys.argv[1], sys.argv[2]
LINES = [("TEAM", None), ("DYNAMICS", None), ("INDEX  2027", 7)]  # (text, index where blue starts)
LINE_HEIGHT = 0.893
WHITE, BLUE = "#FFFFFF", "#3D63DC"

tt = TTFont(font_path)
upem = tt["head"].unitsPerEm
cap = tt["OS/2"].sCapHeight
glyphs = tt.getGlyphSet()
order = tt.getGlyphOrder()
blob = hb.Blob.from_file_path(font_path)
hbfont = hb.Font(hb.Face(blob))

pitch = LINE_HEIGHT * upem
paths = {WHITE: [], BLUE: []}
widths = []
for row, (text, blue_from) in enumerate(LINES):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    x = 0
    base = row * pitch  # baseline, in SVG y-down units relative to the first baseline
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        colour = BLUE if blue_from is not None and info.cluster >= blue_from else WHITE
        pen = SVGPathPen(glyphs)
        # font units are y-up; flip into SVG's y-down, sitting on this line's baseline
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, base - pos.y_offset)))
        d = pen.getCommands()
        if d:
            paths[colour].append(d)
        x += pos.x_advance
    widths.append(x)

width = max(widths)
top = -cap
height = cap + (len(LINES) - 1) * pitch
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top:g} {width:g} {height:g}" '
    f'width="{width / upem * 140:.2f}" height="{height / upem * 140:.2f}">'
    f'<path fill="{WHITE}" d="{" ".join(paths[WHITE])}"/>'
    f'<path fill="{BLUE}" d="{" ".join(paths[BLUE])}"/>'
    "</svg>\n"
)
open(out_path, "w").write(svg)
print(f"upem {upem}, cap {cap}, viewBox width {width} height {height:g}")
print(f"at 140px: {width / upem * 140:.1f} x {height / upem * 140:.1f}px, height/em = {height / upem:.4f}")
