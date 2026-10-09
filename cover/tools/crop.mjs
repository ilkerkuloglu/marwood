// Render a region of an SVG (in its own user units) at high resolution.
//   node tools/crop.mjs in.svg out.png x0 y0 x1 y1 [pxWidth]
import { chromium } from "playwright-core";
import fs from "node:fs";
const [inp, out, ...n] = process.argv.slice(2);
const [x0, y0, x1, y1, pw = 1200] = n.map(Number);
const ph = Math.round(pw * (y1 - y0) / (x1 - x0));
const svg = fs.readFileSync(inp, "utf8").replace(/<\?xml[^>]*>/, "")
  .replace(/<svg\b[^>]*>/, (t) => t.replace(/\s(width|height|viewBox)="[^"]*"/g, "").replace("<svg", `<svg width="${pw}" height="${ph}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}"`));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: pw, height: ph } });
await p.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
await p.screenshot({ path: out });
await b.close();
