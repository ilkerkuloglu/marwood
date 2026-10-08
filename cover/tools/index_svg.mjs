// Index every drawable element of a (cairo-exported) SVG with its bounding
// box in root user space, so pieces can be picked out by region.
//   node index_svg.mjs in.svg out.json
import { chromium } from "playwright-core";
import fs from "node:fs";
const [inp, out] = process.argv.slice(2);
const svg = fs.readFileSync(inp, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const items = await page.evaluate(() => {
  const root = document.querySelector("svg");
  const rootInv = root.getScreenCTM().inverse();
  const out = [];
  const leaves = root.querySelectorAll("path, use, rect, circle, ellipse, line, polyline, polygon, image");
  let i = 0;
  for (const el of leaves) {
    if (el.closest("defs") || el.closest("clipPath") || el.closest("mask")) continue;
    let bb;
    try { bb = el.getBBox(); } catch { continue; }
    const m = rootInv.multiply(el.getScreenCTM());
    const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const cs = getComputedStyle(el);
    const sw = cs.stroke !== "none" ? parseFloat(cs.strokeWidth) * Math.hypot(m.a, m.b) / 2 : 0;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    el.setAttribute("data-idx", i);
    out.push({
      i: i++, tag: el.tagName,
      bbox: [Math.min(...xs) - sw, Math.min(...ys) - sw, Math.max(...xs) + sw, Math.max(...ys) + sw].map((v) => +v.toFixed(2)),
      ctm: [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(5)),
      fill: cs.fill, stroke: cs.stroke,
    });
  }
  return out;
});
fs.writeFileSync(out, JSON.stringify(items));
console.log(inp, items.length, "elements");
await browser.close();
