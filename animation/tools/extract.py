"""Trace each character figure out of the Canva PDF card images.

Input: the embedded card PNGs (from `pdfimages -png`). Output:
assets/figures.js, which sets window.FIGURES = { name: { w, h, sil, ink } }.
Paths are in native card-pixel coordinates (origin = card top-left), so rig
coordinates measured on the card images map 1:1.

  sil  white silhouette of the figure (everything not connected to the
       outside background), drawn under the ink so moving parts can pass
       behind the body
  ink  the black line work
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "assets" / "figures.js"
SCALE = 4
CARDS = {"adhd": 1, "aktivist": 3, "asosyal": 5, "kafein": 7, "narsist": 9, "sakar": 11}
X0, X1, MARGIN = 25, 310, 25


def trace(mask, box):
    """potrace a boolean mask (True = filled) and return one path in card px."""
    with tempfile.NamedTemporaryFile(suffix=".pbm") as f:
        Image.fromarray((~mask).astype(np.uint8) * 255).convert("1").save(f.name)
        svg = subprocess.run(
            ["potrace", "-s", "--flat", "-t", "6", "-a", "1.0", "-O", "0.4", "-o", "-", f.name],
            check=True, capture_output=True, text=True).stdout
    d = " ".join(re.findall(r'<path d="([^"]+)"', svg))
    h4 = mask.shape[0]
    # potrace: translate(0,h4) scale(.1,-.1) in 4x px; fold in crop offset + 1/SCALE
    return d, f"translate({box[0]},{box[1]}) scale({1/SCALE}) translate(0,{h4}) scale(0.1,-0.1)"


figs = {}
for name, idx in CARDS.items():
    gray = Image.open(SRC / f"i-{idx:03d}.png").convert("L")
    w, h = gray.size
    box = (X0, MARGIN, X1, h - MARGIN)
    crop = gray.crop(box)
    big = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.BICUBIC)
    ink = np.array(big) < 140
    # drop ink touching the crop edge (bits of the card's rounded border)
    img = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).copy()  # copy: floodfill is a no-op on array-backed images
    W, H = img.size
    edge = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    for p in edge:
        if img.getpixel(p) == 0:
            ImageDraw.floodfill(img, p, 255)
    ink = np.array(img) == 0
    # silhouette: everything not reachable from outside. Close the line work
    # first so small gaps between strokes (hair, arm/torso) don't leak.
    disk = lambda r: (np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r)
    R = 7 * SCALE
    closed = ndimage.binary_dilation(ink, disk(R))
    outside = ~ndimage.binary_fill_holes(closed)
    sil = ~ndimage.binary_dilation(outside, disk(R)) | ink
    ink_d, tr = trace(ink, box)
    sil_d, _ = trace(sil, box)
    ys, xs = np.nonzero(ink)
    bbox = [round(box[0] + xs.min() / SCALE, 1), round(box[1] + ys.min() / SCALE, 1),
            round(box[0] + (xs.max() + 1) / SCALE, 1), round(box[1] + (ys.max() + 1) / SCALE, 1)]
    figs[name] = {"w": w, "h": h, "bbox": bbox, "transform": tr, "ink": ink_d, "sil": sil_d}
    print(name, w, h, bbox, f"ink {len(ink_d)//1000}k sil {len(sil_d)//1000}k")

# card titles (same raster, right of the figure) and the cover's Marwood logo
TITLE_BOX = {"adhd": (315, 100, 595, 180), "aktivist": (345, 95, 755, 197), "asosyal": (333, 125, 754, 208),
             "kafein": (334, 108, 1130, 210), "narsist": (345, 86, 730, 188), "sakar": (333, 121, 1046, 204)}


def trace_box(path, box):
    gray = Image.open(path).convert("L").crop(box)
    big = gray.resize((gray.width * SCALE, gray.height * SCALE), Image.BICUBIC)
    ink = np.array(big) < 140
    d, tr = trace(ink, box)
    ys, xs = np.nonzero(ink)
    bbox = [round(box[0] + xs.min() / SCALE, 1), round(box[1] + ys.min() / SCALE, 1),
            round(box[0] + (xs.max() + 1) / SCALE, 1), round(box[1] + (ys.max() + 1) / SCALE, 1)]
    return {"bbox": bbox, "d": d, "transform": tr}


titles = {n: trace_box(SRC / f"i-{CARDS[n]:03d}.png", b) for n, b in TITLE_BOX.items()}
logo = trace_box(SRC / "i-000.png", (740, 190, 1660, 527))
print("titles + logo traced")

OUT.write_text("window.FIGURES = " + json.dumps(figs) + ";\n"
               "window.TITLES = " + json.dumps(titles) + ";\n"
               "window.LOGO = " + json.dumps(logo) + ";\n")
