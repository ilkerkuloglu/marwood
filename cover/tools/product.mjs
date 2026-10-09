// Pull product drawings (named groups) out of the isometric catalog SVG.
//   node tools/product.mjs tumu.svg outDir id1 id2 ...   (ids may be prefixes)
// Writes <outDir>/<id>.svg with a tight viewBox and prints bbox + label text.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const [src, outDir, ...ids] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const svg = fs.readFileSync(src, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body>${svg}</body>`);
const res = await page.evaluate((ids) => {
  const root = document.querySelector("svg");
  const inv = root.getScreenCTM().inverse();
  const all = [...root.querySelectorAll("g[id]")];
  const out = [];
  for (const want of ids) {
    const g = all.find((e) => e.id === want) || all.find((e) => e.id.startsWith(want));
    if (!g) { out.push({ want, missing: true }); continue; }
    const m = inv.multiply(g.getScreenCTM());
    const bb = g.getBBox();
    const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y + bb.height], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    // the label is the first two <text> nodes after the group
    let n = g.nextElementSibling, label = [];
    while (n && label.length < 2) { if (n.tagName === "text") label.push(n.textContent.trim()); n = n.nextElementSibling; }
    const inner = [...g.children].map((c) => c.outerHTML).join("");
    out.push({ id: g.id, box, label, inner, ctm: [m.a, m.b, m.c, m.d, m.e, m.f] });
  }
  return out;
}, ids);
await browser.close();
for (const r of res) {
  if (r.missing) { console.log("missing", r.want); continue; }
  const [x0, y0, x1, y1] = r.box, pad = 1;
  const vb = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map((v) => +v.toFixed(2));
  fs.writeFileSync(path.join(outDir, `${r.id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" width="${vb[2]}" height="${vb[3]}"><g transform="matrix(${r.ctm.join(" ")})">${r.inner}</g></svg>\n`);
  console.log(r.id.padEnd(40), "w", (x1 - x0).toFixed(1), "h", (y1 - y0).toFixed(1), "|", r.label.join(" | "));
}
