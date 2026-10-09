// Render the spot to MP4 (1080×1920, 30 fps) by seeking the scene frame by
// frame in headless Chromium and piping PNGs into ffmpeg.
//   node render.mjs [out.mp4] [--fps 30]
//   node render.mjs --stills 0,1.5,3 out/stills.png   (contact sheet of moments)
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const fps = +opt("fps", 30);
const stills = opt("stills", null);
const scale = +opt("scale", 1);
const out = path.resolve(args[0] || path.join(HERE, "out/marwood_hatti.mp4"));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("[console]", m.text()); });
await page.goto(pathToFileURL(path.join(HERE, "index.html")).href);
await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 60000 });

if (stills) {
  const times = stills.split(",").map(Number);
  const tmp = [];
  for (const t of times) {
    await page.evaluate((t) => window.scene.seek(t), t);
    const f = path.join(path.dirname(out), `_still_${t}.png`);
    await page.screenshot({ path: f });
    tmp.push(f);
  }
  const cols = Math.min(times.length, 6);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...tmp.flatMap((f) => ["-i", f]),
    "-filter_complex", `${tmp.map((_, i) => `[${i}]scale=350:622,pad=360:640:5:9:white[s${i}]`).join(";")};${tmp.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${tmp.length}:layout=${tmp.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 640}`).join("|")}:fill=white`, out]);
  console.log(out);
  await browser.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.scene.duration);
const frames = Math.round(duration * fps);
const ffmpeg = spawn("ffmpeg", [
  "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "15", "-profile:v", "high",
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
