"""Remove the subpaths lying fully inside a rectangle (e.g. a "Marwood" tag)
from an asset SVG whose paths use absolute M/L/C/Z commands. White fills are
kept so the surface under the label stays paper.
    python3 tools/cutlabel.py in.svg out.svg x0 y0 x1 y1 [x0 y0 x1 y1 ...]
"""
import re
import sys

src, out, *nums = sys.argv[1:]
rects = [tuple(map(float, nums[i:i + 4])) for i in range(0, len(nums), 4)]
svg = open(src).read()
removed = 0


def inside(sub):
    xy = list(map(float, re.findall(r"-?\d+\.?\d*(?:e-?\d+)?", sub)))
    xs, ys = xy[0::2], xy[1::2]
    return any(min(xs) >= x0 and max(xs) <= x1 and min(ys) >= y0 and max(ys) <= y1 for x0, y0, x1, y1 in rects)


def fix(m):
    global removed
    tag = m.group(0)
    if 'fill="#fff"' in tag:
        return tag
    d = re.search(r' d="([^"]*)"', tag).group(1)
    subs = [s for s in re.split(r"(?=M)", d) if s.strip()]
    keep = [s for s in subs if not inside(s)]
    removed += len(subs) - len(keep)
    if not keep:
        return ""
    return tag.replace(d, "".join(keep))


svg = re.sub(r"<path\b[^>]*>(?:</path>)?", fix, svg)
open(out, "w").write(svg)
print(f"{out}: removed {removed} subpaths")
