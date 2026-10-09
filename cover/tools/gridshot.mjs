// Render a region of an SVG with a labelled coordinate grid.
//   node gridshot.mjs in.svg out.png x0 y0 x1 y1 step [pxWidth]
import { chromium } from "playwright-core";
import fs from "node:fs";
const [inp, out, ...n] = process.argv.slice(2);
const [x0, y0, x1, y1, step, pw = 1600] = n.map(Number);
let svg = fs.readFileSync(inp, "utf8");
const w = x1 - x0, h = y1 - y0, ph = Math.round(pw * h / w);
let grid = "";
const fs_ = w / 90;
for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step)
  grid += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#f0f" stroke-width="${w / 1600}" opacity=".6"/><text x="${x + w / 400}" y="${y0 + fs_}" font-size="${fs_}" fill="#f0f">${x}</text>`;
for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step)
  grid += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#0af" stroke-width="${w / 1600}" opacity=".6"/><text x="${x0 + w / 400}" y="${y - w / 400}" font-size="${fs_}" fill="#0af">${y}</text>`;
svg = svg.replace(/<svg\b[^>]*>/, (tag) => tag
    .replace(/\s(width|height|viewBox|x|y|enable-background)="[^"]*"/g, "")
    .replace(/<svg/, `<svg width="${pw}" height="${ph}" viewBox="${x0} ${y0} ${w} ${h}"`))
  .replace(/<\/svg>\s*$/, `${grid}</svg>`);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: pw, height: ph } });
await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${svg}</body>`);
await page.screenshot({ path: out });
await browser.close();
