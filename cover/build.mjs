// Marwood 2026 catalog covers (DÖŞEME / PANEL).
// Builds A4 + 3 mm bleed covers from the vector character assets, with text
// set in Montserrat and converted to outlines, following the catalog rules
// (margins, swatches, motif). Writes:
//   out/kapak_<id>.svg         full cover (background, art, text, logo)
//   out/kapak_<id>_gorsel.svg  art only, transparent, same page geometry
//   out/kapak_<id>.png         preview
//   node build.mjs [id]
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { chromium } from "playwright-core";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });

// ── catalog constants (see the InDesign handoff notes) ─────────────────────
const W = 595.276, H = 841.89, B = 8.504;
const ML = 56.693, MT = 49.606;
const COL = { x0: ML, x1: W - ML };
import { SWATCH } from "./swatches.mjs";

// ── fonts → outlined text ──────────────────────────────────────────────────
const FONT = Object.fromEntries(["Bold:700Bold", "SemiBold:600SemiBold", "Medium:500Medium", "Regular:400Regular",
  "MediumItalic:500Medium_Italic"].map((s) => {
  const [k, f] = s.split(":");
  return [k, opentype.loadSync(path.join(HERE, "fonts", `Montserrat_${f}.ttf`))];
}));

/** Outline a line of text. tracking in 1/1000 em (InDesign units). */
function text(str, { font = "Regular", size, x, y, tracking = 0, fill = "#000", align = "left" }) {
  const f = FONT[font];
  const scale = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(str);
  const advances = glyphs.map((g, i) => {
    const kern = i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) : 0;
    return (g.advanceWidth + kern) * scale + (i < glyphs.length - 1 ? tracking / 1000 * size : 0);
  });
  const width = advances.reduce((a, b) => a + b, 0);
  let cx = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  let d = "";
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += advances[i];
  });
  return { svg: `<path d="${d}" fill="${fill}"/>`, width };
}

// ── assets ─────────────────────────────────────────────────────────────────
function loadAsset(name) {
  const src = fs.readFileSync(path.join(HERE, "assets", `${name}.svg`), "utf8");
  const vb = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const defs = (src.match(/<defs>([\s\S]*?)<\/defs>/) || [, ""])[1];
  const glyph = {};
  for (const m of defs.matchAll(/<g id="([^"]+)">\s*<path d="([^"]*)"\s*\/?>(?:<\/path>)?\s*<\/g>/g)) glyph[m[1]] = m[2];
  // glyph <use> → plain <path> with the use's x/y folded into its transform
  const body = src.match(/<g>([\s\S]*)<\/g>\s*<\/svg>/)[1].replace(/<use\b([^>]*?)\/?>(<\/use>)?/g, (m, attrs) => {
    const id = (attrs.match(/href="#([^"]+)"/) || [])[1];
    if (!glyph[id]) return "";
    const x = parseFloat((attrs.match(/\sx="([^"]+)"/) || [, "0"])[1]);
    const y = parseFloat((attrs.match(/\sy="([^"]+)"/) || [, "0"])[1]);
    const rest = attrs.replace(/\s(xlink:href|href|x|y)="[^"]*"/g, "")
      .replace(/transform="matrix\(([^)]+)\)"/, (t, mm) => `transform="matrix(${mm}) translate(${x} ${y})"`);
    return `<path d="${glyph[id]}"${rest}/>`;
  });
  return { vb, defs: "", body };
}

/**
 * White "sticker" border: every shape again in white, grown by `off` pt.
 * Strokes are in each element's local units, so divide by its scale.
 */
function halo(body, assetScale, off) {
  return body.replace(/<(path|use|rect|circle|ellipse|line|polyline|polygon)\b([^>]*?)\/?>(<\/\1>)?/g, (m, tag, attrs) => {
    const mt = attrs.match(/transform="matrix\(([^)]+)\)"/);
    const [a, b] = mt ? mt[1].split(/[\s,]+/).map(Number) : [1, 0];
    const k = Math.hypot(a, b) * assetScale;
    const sw0 = parseFloat((attrs.match(/stroke-width="([^"]+)"/) || [, "0"])[1]) || 0;
    const hasStroke = /stroke="(?!none)/.test(attrs);
    const sw = (hasStroke ? sw0 : 0) + (2 * off) / k;
    const clean = attrs.replace(/\s(fill|stroke|stroke-width|stroke-linejoin|stroke-linecap|stroke-miterlimit|opacity)="[^"]*"/g, "");
    const fill = /fill="none"/.test(attrs) ? "none" : "#fff";
    return `<${tag}${clean} fill="${fill}" stroke="#fff" stroke-width="${+sw.toFixed(4)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
}

let defsOut = new Map();
/** Place an asset: h = target height (pt); anchor point (x, y) is bottom-left unless given. */
function place(name, { x, y, h, w, anchor = "bl", halo: off = 0 }) {
  const a = loadAsset(name);
  const [vx, vy, vw, vh] = a.vb;
  const s = h ? h / vh : w / vw;
  const pw = vw * s, ph = vh * s;
  const left = anchor.includes("c") ? x - pw / 2 : anchor.includes("r") ? x - pw : x;
  const top = anchor.startsWith("t") ? y : y - ph;
  if (a.defs) defsOut.set(name, a.defs);
  const tr = `translate(${+(left - vx * s).toFixed(3)},${+(top - vy * s).toFixed(3)}) scale(${+s.toFixed(6)})`;
  const back = off ? `<g>${halo(a.body, s, off)}</g>` : "";
  return { svg: `<g id="${name}" transform="${tr}">${back}<g>${a.body}</g></g>`, box: [left, top, left + pw, top + ph] };
}

// corporate motif: two circles + a pill rotated −32°, right-aligned at (x, y)
function motif(x, y, color, scale = 1) {
  const d = 19.8 * scale, g = 4.2 * scale, L = 50 * scale;
  const r = d / 2;
  // pill bounding box after rotation
  const ang = -32 * Math.PI / 180;
  const pw = Math.abs(L * Math.cos(ang)) + Math.abs(d * Math.sin(ang));
  const x2 = x - pw / 2, x1 = x - pw - g - r, x0 = x1 - d - g;
  return `<g fill="${color}"><circle cx="${x0}" cy="${y}" r="${r}"/><circle cx="${x1}" cy="${y}" r="${r}"/>` +
    `<rect x="${x2 - L / 2}" y="${y - r}" width="${L}" height="${d}" rx="${r}" transform="rotate(-32 ${x2} ${y})"/></g>`;
}

function sparkle(x, y, s, color, kind = "star") {
  if (kind === "plus") return `<path d="M${x - s},${y}H${x + s}M${x},${y - s}V${y + s}" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>`;
  if (kind === "dot") return `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="${color}" stroke-width="1.2"/>`;
  const k = s * 0.18;
  return `<path d="M${x},${y - s} Q${x + k},${y - k} ${x + s},${y} Q${x + k},${y + k} ${x},${y + s} Q${x - k},${y + k} ${x - s},${y} Q${x - k},${y - k} ${x},${y - s}Z" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>`;
}

// ── covers ─────────────────────────────────────────────────────────────────
const COVERS = {
  doseme: {
    bg: SWATCH.salmon, ink: SWATCH.black, sub: SWATCH.paper,
    title: "Seating", subtitle: "Döşeme",
    cats: ["Chairs", "Sofas & Armchairs", "Poufs", "Accessories"],
    motifColor: SWATCH.indigo,
    art: [
      ["kafein_sofa", { x: 300, y: 440, h: 226 }],
      ["narsist_stand", { x: 74, y: 528, h: 232 }],
      ["aktivist_pouf", { x: 172, y: 540, h: 204 }],
      ["adhd_jun", { x: 404, y: 668, h: 190 }],
      ["asosyal_bench", { x: 50, y: 762, h: 160 }],
      ["sakar_stool", { x: 250, y: 764, h: 240 }],
      ["cat_fly", { x: 452, y: 748, h: 50 }],
    ],
    sparkles: [[176, 262, 7, "star"], [548, 470, 5, "plus"], [372, 466, 3, "dot"], [222, 590, 4, "plus"], [520, 700, 6, "star"], [40, 500, 3, "dot"]],
  },
  panel: {
    bg: SWATCH.indigo, ink: SWATCH.paper, sub: SWATCH.paper,
    title: "Panel", subtitle: "Panel Mobilya",
    cats: ["Workstations", "Executive Desks", "Meeting Tables", "Storage", "Pedestals", "Sideboards", "Receptions", "Café & Bar", "Coffee Tables"],
    motifColor: SWATCH.salmon,
    art: [
      ["asosyal_desk", { x: 46, y: 446, h: 196 }],
      ["narsist_desk", { x: 330, y: 446, h: 200 }],
      ["sakar_handstand", { x: 58, y: 756, h: 258 }],
      ["adhd_stand", { x: 178, y: 758, h: 230 }],
      ["kafein_table", { x: 266, y: 760, h: 272 }],
      ["aktivist_plant", { x: 420, y: 760, h: 238 }],
    ],
    sparkles: [[286, 268, 7, "star"], [552, 250, 5, "plus"], [292, 470, 3, "dot"], [160, 500, 4, "plus"], [402, 500, 6, "star"], [36, 560, 3, "dot"]],
  },
};

function buildCover(id, { withText = true } = {}) {
  const c = COVERS[id];
  defsOut = new Map();
  const parts = [];
  if (withText) parts.push(`<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}" fill="${c.bg}"/>`);
  for (const [x, y, s, k] of c.sparkles) parts.push(sparkle(x, y, s, withText ? SWATCH.paper : SWATCH.black, k));
  for (const [name, opt] of c.art) parts.push(place(name, { halo: 3.4, ...opt }).svg);
  if (withText) {
    const t = [];
    t.push(text("CATALOG’26 · KATALOG’26", { font: "SemiBold", size: 6.5, x: ML, y: MT + 5, tracking: 100, fill: c.ink }).svg);
    t.push(motif(COL.x1, MT + 2, c.motifColor, 0.8));
    t.push(text(c.title, { font: "Bold", size: 50, x: ML - 2.5, y: 132, fill: c.ink }).svg);
    t.push(text(c.subtitle, { font: "Medium", size: 13, x: ML, y: 154, fill: c.ink }).svg);
    // category list, wrapped to the text column
    let line = "", y = 176;
    const lines = [];
    for (const cat of c.cats) {
      const next = line ? `${line}  ·  ${cat}` : cat;
      if (text(next, { size: 8.5, x: 0, y: 0 }).width > COL.x1 - COL.x0 - 120 && line) { lines.push(line); line = cat; } else line = next;
    }
    lines.push(line);
    for (const l of lines) { t.push(text(l, { size: 8.5, x: ML, y, fill: c.ink }).svg); y += 12.5; }
    // logo bottom-left inside the margin
    const logo = place("logo_line", { x: ML, y: H - MT, h: 15 });
    t.push(logo.svg.replace(/fill="#000"/g, `fill="${c.ink}"`).replace(/stroke="#000"/g, `stroke="${c.ink}"`));
    t.push(text("It’s all about collaboration!", { font: "Medium", size: 8.5, x: COL.x1, y: H - MT - 3, fill: c.ink, align: "right" }).svg);
    parts.push(`<g id="text">${t.join("")}</g>`);
  }
  const defs = [...defsOut.values()].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${(W + 2 * B).toFixed(3)}pt" height="${(H + 2 * B).toFixed(3)}pt" viewBox="${-B} ${-B} ${(W + 2 * B).toFixed(3)} ${(H + 2 * B).toFixed(3)}">\n` +
    (defs ? `<defs>${defs}</defs>\n` : "") + parts.join("\n") + `\n</svg>\n`;
}

const ids = process.argv[2] ? [process.argv[2]] : Object.keys(COVERS);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 612, height: 859 }, deviceScaleFactor: 2 });
for (const id of ids) {
  const full = buildCover(id);
  fs.writeFileSync(path.join(OUT, `kapak_${id}.svg`), full);
  fs.writeFileSync(path.join(OUT, `kapak_${id}_gorsel.svg`), buildCover(id, { withText: false }));
  await page.setContent(`<!doctype html><body style="margin:0">${full.replace(/<\?xml[^>]*>/, "").replace(/width="[^"]*pt" height="[^"]*pt"/, 'width="612" height="859"')}</body>`);
  await page.screenshot({ path: path.join(OUT, `kapak_${id}.png`) });
  console.log(id, "→", `out/kapak_${id}.svg`);
}
await browser.close();
