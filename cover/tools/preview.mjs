// Render asset SVGs side by side on a tinted background: node preview.mjs out.png a.svg b.svg ...
import { chromium } from "playwright-core";
import fs from "node:fs";
const [out, ...files] = process.argv.slice(2);
const cells = files.map((f) => `<div style="display:inline-block;margin:8px;vertical-align:top;text-align:center;font:12px sans-serif">
  <div style="background:#f4a582;padding:6px">${fs.readFileSync(f, "utf8").replace(/width="[^"]*" height="[^"]*"/, 'height="380"')}</div>${f.split("/").pop()}</div>`).join("");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1800, height: 600 } });
await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${cells}</body>`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
