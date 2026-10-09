// One full-resolution frame: node shot.mjs t out.png
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [t, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(pathToFileURL(path.join(HERE, "index.html")).href);
await page.waitForFunction(() => document.body.dataset.ready === "1");
for (const tt of t.split(",")) {
  await page.evaluate((x) => window.scene.seek(x), +tt);
  await page.screenshot({ path: out.replace(".png", `_${tt}.png`) });
}
await browser.close();
