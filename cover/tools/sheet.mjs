// Contact sheet of SVG files: node tools/sheet.mjs out.png file1.svg file2.svg …
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const [out, ...files] = process.argv.slice(2);
const cells = files.map((f) => `<div style="display:inline-block;width:180px;height:200px;margin:4px;border:1px solid #ddd;text-align:center;font:11px sans-serif;vertical-align:top"><img src="data:image/svg+xml;base64,${fs.readFileSync(f).toString("base64")}" style="max-width:170px;max-height:170px"><br>${path.basename(f)}</div>`).join("");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1180, height: 600 } });
await p.setContent(`<body style="margin:0">${cells}</body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
