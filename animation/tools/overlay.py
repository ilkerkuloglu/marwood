"""Debug: draw each character's rig (hide polygon, redrawn lines, pivot,
eyes) over the original card raster, zoomed. Usage:
  python3 tools/overlay.py <pdf img dir> <out dir> [zoom]
"""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
Z = int(sys.argv[3]) if len(sys.argv) > 3 else 5
CARDS = {"adhd": 1, "aktivist": 3, "asosyal": 5, "kafein": 7, "narsist": 9, "sakar": 11}
here = Path(__file__).resolve().parent.parent
chars = json.loads(subprocess.run(
    ["node", "-e", "global.window={};require('./chars.js');console.log(JSON.stringify(window.CHARS))"],
    cwd=here, capture_output=True, text=True, check=True).stdout)

def path_points(d):
    # good enough for M/L/Q/C paths: sample control + end points
    nums = list(map(float, re.findall(r"-?\d+\.?\d*", d)))
    return list(zip(nums[0::2], nums[1::2]))

for c in chars:
    im = Image.open(SRC / f"i-{CARDS[c['id']]:03d}.png").convert("RGB")
    xs = [p[0] for p in c["hide"]] + [c["arm"]["pivot"][0]]
    ys = [p[1] for p in c["hide"]] + [c["arm"]["pivot"][1]]
    box = (int(min(xs)) - 12, int(min(ys)) - 25, int(max(xs)) + 25, int(max(ys)) + 12)
    crop = im.crop(box).resize(((box[2] - box[0]) * Z, (box[3] - box[1]) * Z), Image.NEAREST)
    d = ImageDraw.Draw(crop, "RGBA")
    T = lambda p: ((p[0] - box[0]) * Z, (p[1] - box[1]) * Z)
    d.polygon([T(p) for p in c["hide"]], fill=(255, 0, 0, 70), outline=(255, 0, 0, 255))
    for ln in c["lines"]:
        pts = path_points(ln)
        d.line([T(p) for p in pts], fill=(0, 160, 255, 255), width=2)
        for p in pts:
            x, y = T(p); d.ellipse((x - 3, y - 3, x + 3, y + 3), outline=(0, 160, 255, 255))
    x, y = T(c["arm"]["pivot"]); d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(0, 200, 0, 255))
    crop.save(OUT / f"ov_{c['id']}.png")
    print(c["id"], box, crop.size)
