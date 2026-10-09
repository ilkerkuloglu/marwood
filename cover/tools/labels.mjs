// Dump every product group of the isometric catalog SVG with its bbox (pt)
// and the dimension label that follows it.
//   node tools/labels.mjs tumu.svg out.json
import { chromium } from "playwright-core";
import fs from "node:fs";
const [src, out] = process.argv.slice(2);
const svg = fs.readFileSync(src, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body>${svg}</body>`);
const res = await page.evaluate(() => {
  const root = document.querySelector("svg");
  const inv = root.getScreenCTM().inverse();
  return [...root.querySelectorAll("g[id]")].filter((g) => /^(DOSEME|PANEL)_/.test(g.id)).map((g) => {
    const m = inv.multiply(g.getScreenCTM()), bb = g.getBBox();
    const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y + bb.height], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let n = g.nextElementSibling, label = [];
    while (n && label.length < 2 && !(n.tagName === "g" && /^(DOSEME|PANEL)_/.test(n.id))) {
      if (n.tagName === "text") label.push(n.textContent.trim());
      n = n.nextElementSibling;
    }
    return { id: g.id, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), label };
  });
});
await browser.close();
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(res.length, "groups");
