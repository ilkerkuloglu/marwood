// Screenshot a local HTML file: node tools/shot.mjs page.html out.png [width height] [evalJS]
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
const [file, out, w = "1920", h = "1080", js] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1) });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(pathToFileURL(path.resolve(file)).href);
await page.waitForLoadState("networkidle");
if (js) await page.evaluate(js);
await page.waitForTimeout(100);
await page.screenshot({ path: out });
await browser.close();
