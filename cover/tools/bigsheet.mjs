// Large contact sheet: node tools/bigsheet.mjs out.png cell file1.svg …
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const [out, cell, ...files] = process.argv.slice(2);
const c = +cell;
const cells = files.map((f) => `<div style="display:inline-block;width:${c}px;height:${c + 20}px;margin:4px;border:1px solid #ddd;text-align:center;font:12px sans-serif;vertical-align:top"><img src="data:image/svg+xml;base64,${fs.readFileSync(f).toString("base64")}" style="width:${c - 10}px;height:${c - 10}px;object-fit:contain"><br>${path.basename(f)}</div>`).join("");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1200, height: 600 } });
await p.setContent(`<body style="margin:0">${cells}</body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
