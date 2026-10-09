// Render product SVGs to PNG for silhouette tracing: node rasterize.mjs dir scale name...
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const [dir, scale, ...names] = process.argv.slice(2);
const k = +scale;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const n of names) {
  const svg = fs.readFileSync(path.join(dir, `${n}.svg`), "utf8");
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const w = Math.ceil(vb[2] * k), h = Math.ceil(vb[3] * k);
  await page.setViewportSize({ width: w, height: h });
  // thicken strokes a little so thin parts survive thresholding
  const big = svg.replace(/width="[^"]*" height="[^"]*"/, `width="${w}" height="${h}"`).replace(/stroke-width="[^"]*"/g, 'stroke-width="0.6"');
  await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${big}</body>`);
  await page.screenshot({ path: path.join(dir, `${n}.png`), clip: { x: 0, y: 0, width: w, height: h } });
  fs.writeFileSync(path.join(dir, `${n}.json`), JSON.stringify({ viewBox: vb, scale: k }));
}
await browser.close();
