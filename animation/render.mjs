// Render the loop to MP4: steps scene.seek(t) frame by frame in headless
// Chromium and pipes PNG screenshots into ffmpeg.
//   node render.mjs [out.mp4] [--fps 30] [--loops 1]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const fps = +opt("fps", 30);
const loops = +opt("loops", 1);
const out = path.resolve(args[0] || "out/marwood-karakterler.mp4");
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(pathToFileURL(path.resolve("index.html")).href);
await page.waitForFunction(() => document.body.dataset.ready === "1");
const duration = await page.evaluate(() => window.scene.duration);
const frames = Math.round(duration * fps) * loops;

const ffmpeg = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "16",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
], { stdio: ["pipe", "inherit", "inherit"] });

const started = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.scene.seek(t), i / fps);
  const png = await page.screenshot({ type: "png" });
  if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (i % fps === 0) process.stdout.write(`\r${i}/${frames} frames`);
}
ffmpeg.stdin.end();
await new Promise((r, j) => ffmpeg.on("close", (code) => (code ? j(new Error(`ffmpeg ${code}`)) : r())));
await browser.close();
console.log(`\r${frames} frames → ${out} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
