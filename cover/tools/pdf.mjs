// SVG cover → print PDF with exact CMYK swatch values.
// svg2pdf.js draws the SVG as vector PDF (RGB); every colour operator is then
// rewritten to the catalog's CMYK swatch it came from, black to K100 only.
// The page keeps the bleed and gets TrimBox/BleedBox for InDesign placing.
//   node tools/pdf.mjs in.svg out.pdf
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { SWATCH_CMYK } from "../swatches.mjs";

const require = createRequire(import.meta.url);
const [inp, out] = process.argv.slice(2);
const svg = fs.readFileSync(inp, "utf8").replace(/<\?xml[^>]*>/, "");
const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const bleed = -vx;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body>${svg}</body>`);
await page.addScriptTag({ path: require.resolve("jspdf/dist/jspdf.umd.min.js") });
await page.addScriptTag({ path: require.resolve("svg2pdf.js/dist/svg2pdf.umd.min.js") });
const pdf = await page.evaluate(async ({ vw, vh }) => {
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: [vw, vh], orientation: vh > vw ? "p" : "l", compress: false });
  await doc.svg(document.querySelector("svg"), { x: 0, y: 0, width: vw, height: vh });
  return doc.output();
}, { vw, vh });
await browser.close();

// colour operators → CMYK
const swatches = Object.entries(SWATCH_CMYK).map(([hex, cmyk]) => ({
  rgb: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), cmyk: cmyk.map((v) => v / 100),
}));
const nearest = (rgb) => {
  let best = null, bd = Infinity;
  for (const s of swatches) {
    const d = s.rgb.reduce((acc, v, i) => acc + (v - rgb[i]) ** 2, 0);
    if (d < bd) { bd = d; best = s; }
  }
  if (bd > 0.002) throw new Error(`colour ${rgb} is not a catalog swatch`);
  return best.cmyk.map((v) => +v.toFixed(3)).join(" ");
};
let n = 0;
const NUM = String.raw`(\d+\.?\d*|\.\d+)`;
let body = pdf
  .replace(new RegExp(String.raw`^${NUM} ${NUM} ${NUM} (rg|RG)$`, "gm"), (m, r, g, b, op) => {
    n++; return `${nearest([+r, +g, +b])} ${op === "rg" ? "k" : "K"}`;
  })
  .replace(new RegExp(String.raw`^${NUM} (g|G)$`, "gm"), (m, v, op) => {
    n++; return `${nearest([+v, +v, +v])} ${op === "g" ? "k" : "K"}`;
  });
// trim/bleed boxes (PDF y axis is bottom-up, symmetric bleed so same numbers)
body = body.replace(/\/MediaBox \[([^\]]+)\]/g, (m) =>
  `${m}\n/TrimBox [${bleed} ${bleed} ${(vw - bleed).toFixed(3)} ${(vh - bleed).toFixed(3)}]\n/BleedBox [0 0 ${vw.toFixed(3)} ${vh.toFixed(3)}]`);
// offsets changed: rebuild the xref table so the file stays valid
const objRe = /(\d+) 0 obj/g;
const offsets = [];
const bytes = Buffer.from(body, "latin1");
const s = bytes.toString("latin1");
let m;
while ((m = objRe.exec(s))) offsets[+m[1]] = m.index;
const xrefAt = s.lastIndexOf("xref");
const head = s.slice(0, xrefAt);
const trailer = s.slice(s.indexOf("trailer", xrefAt));
let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
const fixedTrailer = trailer.replace(/startxref\s+\d+/, `startxref\n${head.length}`);
fs.writeFileSync(out, Buffer.from(head + xref + fixedTrailer, "latin1"));
console.log(path.basename(out), `${n} colour ops → CMYK`);
