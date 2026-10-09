"""Give stroke-only product drawings a white silhouette fill.

For each product SVG: render it large, close small gaps, fill enclosed areas,
trace the outline with potrace and write <out>/<name>.svg with the white
silhouette under the original strokes (all in the product's own units).
  python3 tools/silhouette.py <png dir> <out dir> name1 name2 ...
The PNGs come from tools/rasterize.mjs (same name, plus a .json with the
viewBox and the pixel scale).
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

png_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
disk = lambda r: np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r
for name in sys.argv[3:]:
    meta = json.loads((png_dir / f"{name}.json").read_text())
    k = meta["scale"]
    vx, vy, vw, vh = meta["viewBox"]
    ink = np.array(Image.open(png_dir / f"{name}.png").convert("L")) < 200
    R = max(2, int(round(1.2 * k)))           # close gaps of ~2.4 product units
    closed = ndimage.binary_closing(ink, disk(R), iterations=1)
    closed = ndimage.binary_dilation(closed, disk(1))
    sil = ndimage.binary_fill_holes(closed)
    with tempfile.NamedTemporaryFile(suffix=".pbm") as f:
        Image.fromarray((~sil).astype(np.uint8) * 255).convert("1").save(f.name)
        svg = subprocess.run(["potrace", "-s", "--flat", "-t", "10", "-a", "1.0", "-o", "-", f.name],
                             check=True, capture_output=True, text=True).stdout
    d = " ".join(re.findall(r'<path d="([^"]+)"', svg))
    h_px = sil.shape[0]
    tr = f"translate({vx},{vy}) scale({1/k}) translate(0,{h_px}) scale(0.1,-0.1)"
    src = (png_dir / f"{name}.svg").read_text()
    body = re.search(r"(<g transform=[\s\S]*</g>)\s*</svg>", src).group(1)
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx} {vy} {vw} {vh}" width="{vw}" height="{vh}">'
           f'<g class="sil"><path d="{d}" transform="{tr}" fill="#fff"/></g>{body}</svg>\n')
    (out_dir / f"{name}.svg").write_text(out)
    print(name, "ok")
