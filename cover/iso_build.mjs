// Isometric DÖŞEME cover: a stacked building of seating "floors" in Zeynep's
// isometric language (thin walls, heavy slab edges, tiled floors), each floor
// one catalog category with its swatch colour, furnished with the catalog's
// own isometric product drawings and the characters.
//   node iso_build.mjs   → out/kapak_doseme_iso.{svg,png}
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { chromium } from "playwright-core";
import { SWATCH } from "./swatches.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
const W = 595.276, H = 841.89, B = 8.504, ML = 56.693, MT = 49.606;
const INK = "#000", PAPER = "#fff";

// ── iso projection (world in cm, screen in pt) ─────────────────────────────
const S = 0.5;                  // pt per cm on the cover
const C = Math.cos(Math.PI / 6);
let OX = 262, OY = 480;         // screen position of world origin
const P = (x, y, z = 0) => [OX + (x - y) * C * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (arr) => arr.map((p) => p.map((v) => +v.toFixed(2)).join(",")).join(" ");
const poly = (arr, attrs) => `<polygon points="${pts(arr)}" ${attrs}/>`;
const line = (a, b, attrs) => `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" ${attrs}/>`;

// ── text → outlines ────────────────────────────────────────────────────────
const FONT = Object.fromEntries(["Bold:700Bold", "SemiBold:600SemiBold", "Medium:500Medium", "Regular:400Regular"].map((s) => {
  const [k, f] = s.split(":");
  return [k, opentype.loadSync(path.join(HERE, "fonts", `Montserrat_${f}.ttf`))];
}));
function textPath(str, { font = "Regular", size, x = 0, y = 0, tracking = 0, align = "left" }) {
  const f = FONT[font], k = size / f.unitsPerEm;
  const gs = f.stringToGlyphs(str);
  const adv = gs.map((g, i) => (g.advanceWidth + (i < gs.length - 1 ? f.getKerningValue(g, gs[i + 1]) : 0)) * k +
    (i < gs.length - 1 ? tracking / 1000 * size : 0));
  const width = adv.reduce((a, b) => a + b, 0);
  let cx = align === "right" ? x - width : align === "center" ? x - width / 2 : x, d = "";
  gs.forEach((g, i) => { d += g.getPath(cx, y, size).toPathData(2); cx += adv[i]; });
  return { d, width };
}
const text = (str, o) => `<path d="${textPath(str, o).d}" fill="${o.fill || INK}"/>`;

// ── assets ─────────────────────────────────────────────────────────────────
let ASSET_UID = 0;
function loadAsset(file) {
  const src = fs.readFileSync(path.join(HERE, "assets", file), "utf8");
  const vb = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const defs = (src.match(/<defs>([\s\S]*?)<\/defs>/) || [, ""])[1];
  const glyph = {};
  for (const m of defs.matchAll(/<g id="([^"]+)">\s*<path d="([^"]*)"\s*\/?>(?:<\/path>)?\s*<\/g>/g)) glyph[m[1]] = m[2];
  // drop the glyph defs (inlined below) but keep clip paths of the posed figures,
  // renamed so an asset can be placed more than once
  const uid = ++ASSET_UID;
  let body = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/<defs>([\s\S]*?)<\/defs>/g, (m, inner) => inner.includes("<clipPath") ? m : "")
    .replace(/(id="|url\(#)(cut\d+)/g, `$1$2_${uid}`);
  body = body.replace(/<use\b([^>]*?)\/?>(<\/use>)?/g, (m, attrs) => {
    const id = (attrs.match(/href="#([^"]+)"/) || [])[1];
    if (!glyph[id]) return "";
    const x = parseFloat((attrs.match(/\sx="([^"]+)"/) || [, "0"])[1]);
    const y = parseFloat((attrs.match(/\sy="([^"]+)"/) || [, "0"])[1]);
    const rest = attrs.replace(/\s(xlink:href|href|x|y)="[^"]*"/g, "")
      .replace(/transform="matrix\(([^)]+)\)"/, (t, mm) => `transform="matrix(${mm}) translate(${x} ${y})"`);
    return `<path d="${glyph[id]}"${rest}/>`;
  });
  return { vb, body };
}

// The catalog draws its products at different scales (most at 0.55 pt/cm, some
// much smaller or larger), so every product gets its own scale, derived from
// its dimension label in the isometric files: k = drawing height /
// (H + iso depth of the footprint). `foot` (cm) is how far the footprint centre
// sits above the drawing's lowest point: (L + D) / 4, or Ø · 0.354 for rounds.
const box = (L, D, H, k) => ({ k, foot: (L + D) / 4, H });
const round = (d, H, k) => ({ k, foot: d * 0.354, H });
const PRODUCTS = {
  DOSEME_1_Glory_Mng_Grey_Black_: box(75, 72, 120, 0.55),     // seat ≈ 50
  DOSEME_9_Jun_Seminar_Grey_Black_: box(61, 59, 93, 0.55),    // seat ≈ 47
  DOSEME_83_Lumo: box(80, 82, 82, 0.55),
  DOSEME_117_Joker_Lng: box(80, 73, 72, 0.327),
  DOSEME_146_Punto_P_70: box(70, 68, 38, 0.55),
  DOSEME_164_Origo_R_60H45: round(60, 45, 0.405),
  DOSEME_165_Origo_R_80H45: round(80, 45, 0.41),
  DOSEME_175_Pile_Pouf__50H_44: round(50, 44, 0.65),
  PANEL_506_Pile__70H45: round(70, 45, 0.66),
  DOSEME_242_Avion: round(40, 168, 0.585),
  DOSEME_239_Cliff_Small: box(65, 45, 140, 0.55),
  DOSEME_240_Cliff_Middle: box(155, 42, 142, 0.475),
  DOSEME_241_Cliff_Height: box(100, 42, 180, 0.545),
  PANEL_269_Loft_T: box(240, 120, 77, 0.30),
  DOSEME_71_Solar_Sofa: box(150, 90, 80, 0.39),          // seat ≈ 42
  DOSEME_238_Gowall_Tv: box(168, 34, 184, 0.55),
};
// Characters: `ucm` = real cm per drawing unit (calibrated on standing height,
// or sitting height ≈ 88 cm for seated figures), `seat` = the seat point in the
// drawing's own coordinates, `squash` = [y0, y1, f] shortens the shins of the
// frontal metro poses (seen from the front their legs read much too long).
const CHARS = {
  "narsist_stand.svg": { ucm: 175 / 1585 },
  "narsist_point.svg": { ucm: 175 / 1585 },
  "aktivist_write.svg": { ucm: 158 / 748, seat: [3579.6, 10490.3] },
  "src_kafein_sit.svg": { ucm: 0.117, seat: [18552, 7568], squash: [7640, 8150, 0.45] },
  "src_asosyal_sit.svg": { ucm: 0.102, seat: [20570, 7585], squash: [7700, 8150, 0.7] },
  "src_adhd_reach.svg": { ucm: 0.084 },
  "asosyal_sit.svg": { ucm: 0.102, seat: [20570, 7585], squash: [7700, 8150, 0.7] },
  "adhd_reach.svg": { ucm: 0.084 },
  "cat_sit.svg": { ucm: 52 / 622 },
  "sakar_run.svg": { ucm: 160 / 1174 },
  "sakar_spill.svg": { ucm: 160 / 1174 },
  "plant.svg": { ucm: 125 / 168.5 },
};

let CLIP = 0;
/**
 * Put an asset in the world at `at` (cm). Products stand with their footprint
 * centre on the point, at their own catalog scale. Characters stand with their
 * bottom-centre on it, or with their seat point when `sit` is set (then `at`
 * is the seat, e.g. [x, y, 47] for a chair). `flip` mirrors (swaps the iso axes).
 */
function asset(file, { at, flip = false, stroke, depth, sit = false, scale = 1 }) {
  const a = loadAsset(file);
  const [vx, vy, vw, vh] = a.vb;
  const id = file.replace(/^products\//, "").replace(/\.svg$/, "");
  const prod = PRODUCTS[id], ch = CHARS[file];
  if (!prod && !ch) throw new Error(`no scale for ${file}`);
  const k = (prod ? S / prod.k : ch.ucm * S) * scale;
  const [X, Y] = P(...at);
  let body = a.body, ox = vx + vw / 2, oy = vy + vh, dy = 0;
  if (prod) {
    body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${((stroke ?? 0.7) / k).toFixed(3)}"`)
      .replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${INK}"`);
    dy = prod.foot * S;
  } else {
    if (ch.squash) {
      // three bands: as is / squashed / moved up, so the outlines stay joined
      const [y0, y1, f] = ch.squash, big = 1e5, n = ++CLIP;
      const band = (id, ya, yb) => `<clipPath id="${id}"><rect x="${vx - big}" y="${ya}" width="${2 * big}" height="${yb - ya}"/></clipPath>`;
      body = `<defs>${band(`sq${n}a`, vy - big, y0 + 2)}${band(`sq${n}b`, y0 - 2 / f, y1 + 2 / f)}${band(`sq${n}c`, y1 - 2, vy + big)}</defs>` +
        `<g clip-path="url(#sq${n}a)">${body}</g>` +
        `<g transform="translate(0 ${y0}) scale(1 ${f}) translate(0 ${-y0})"><g clip-path="url(#sq${n}b)">${body}</g></g>` +
        `<g transform="translate(0 ${-(y1 - y0) * (1 - f)})"><g clip-path="url(#sq${n}c)">${body}</g></g>`;
      if (!sit) oy -= (y1 - y0) * (1 - f);
    }
    if (sit) [ox, oy] = ch.seat;
  }
  const fx = flip ? -1 : 1;
  const tx = X - ox * k * fx, ty = Y + dy - oy * k;
  return {
    depth: depth ?? (at[0] + at[1] + at[2] * 0.01),
    svg: `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${(k * fx).toFixed(5)},${k.toFixed(5)})">${body}</g>`,
  };
}

// ── architecture in Zeynep's style ─────────────────────────────────────────
const THIN = 0.45, MID = 0.9, HEAVY = 1.6;
const ST = (w, extra = "") => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" ${extra}`;
// slab: white top + the two faces turned to the viewer, in category colours.
// front = runs along x on the y = y1 face, right = runs along y on the x = x1 face
function slab([x0, y0, x1, y1], z, t, { front, right }) {
  let s = poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], `fill="${PAPER}" ${ST(MID)}`);
  for (const [a, b, col] of front) s += poly([P(a, y1, z), P(b, y1, z), P(b, y1, z - t), P(a, y1, z - t)], `fill="${col}" ${ST(MID)}`);
  for (const [a, b, col] of right) s += poly([P(x1, a, z), P(x1, b, z), P(x1, b, z - t), P(x1, a, z - t)], `fill="${col}" ${ST(MID)}`);
  return s;
}
function tiles([x0, y0, x1, y1], z, step = 50) {
  let s = "";
  for (let x = x0 + step; x < x1 - 1; x += step) s += line(P(x, y0, z), P(x, y1, z), `stroke="${INK}" stroke-width="0.22"`);
  for (let y = y0 + step; y < y1 - 1; y += step) s += line(P(x0, y, z), P(x1, y, z), `stroke="${INK}" stroke-width="0.22"`);
  return s;
}
// wall planes: "back" is y = c (u runs along x), "left" is x = c (u runs along y)
const wallPt = (wall, c, u, v) => wall === "back" ? P(u, c, v) : P(c, u, v);
const quad = (wall, c, u0, v0, w, h) => [wallPt(wall, c, u0, v0), wallPt(wall, c, u0 + w, v0), wallPt(wall, c, u0 + w, v0 + h), wallPt(wall, c, u0, v0 + h)];
function wall(wall_, c, u0, u1, z, h) {
  return poly(quad(wall_, c, u0, z, u1 - u0, h), `fill="${PAPER}" ${ST(THIN)}`);
}
function windowOn(wall_, c, u0, z0, w, h, panes = 3) {
  let s = poly(quad(wall_, c, u0, z0, w, h), `fill="${PAPER}" ${ST(HEAVY, 'stroke-linejoin="miter"')}`);
  for (let i = 1; i < panes; i++) s += line(wallPt(wall_, c, u0 + (w * i) / panes, z0), wallPt(wall_, c, u0 + (w * i) / panes, z0 + h), `stroke="${INK}" stroke-width="${THIN}"`);
  s += line(wallPt(wall_, c, u0, z0 + h * 0.58), wallPt(wall_, c, u0 + w, z0 + h * 0.58), `stroke="${INK}" stroke-width="${THIN}"`);
  return s;
}
// the corporate motif (two circles + pill at −32°) drawn in a wall plane, with
// the cover's proportions (circle 19.8, gap 4.2, pill 50 → 100.9 wide). On a
// left wall +u runs to screen-left, so u is mirrored to keep it readable.
function motifOn(wall_, c, cu, cv, size, color) {
  const k = size / 100.9, r = 9.9 * k, sgn = wall_ === "left" ? -1 : 1;
  const at = (du, v) => wallPt(wall_, c, cu + sgn * du, v);
  const circ = (du) => {
    const q = [];
    for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; q.push(at(du + Math.cos(a) * r, cv + Math.sin(a) * r)); }
    return poly(q, `fill="${color}"`);
  };
  const ang = 32 * Math.PI / 180, half = 25 * k - r, pc = 24 * k;
  const pill = [];
  for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + (i / 14) * Math.PI; pill.push([half + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 + (i / 14) * Math.PI; pill.push([-half + Math.cos(a) * r, Math.sin(a) * r]); }
  return circ(-40.55 * k) + circ(-16.55 * k) +
    poly(pill.map(([u, v]) => at(pc + u * Math.cos(ang) - v * Math.sin(ang), cv + u * Math.sin(ang) + v * Math.cos(ang))), `fill="${color}"`);
}
function posterOn(wall_, c, u0, z0, w, h, color) {
  return poly(quad(wall_, c, u0, z0, w, h), `fill="${PAPER}" ${ST(MID)}`) + motifOn(wall_, c, u0 + w / 2, z0 + h / 2, w * 0.78, color);
}
// wall screen full of video calls: Narsist's ten meetings at once
function meetingScreen(wall_, c, u0, z0, w, h, cols = 5, rows = 2) {
  let s = poly(quad(wall_, c, u0, z0, w, h), `fill="${INK}" ${ST(HEAVY)}`);
  const pad = 6, gu = (w - pad * (cols + 1)) / cols, gv = (h - pad * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const u = u0 + pad + i * (gu + pad), v = z0 + pad + j * (gv + pad);
    s += poly(quad(wall_, c, u, v, gu, gv), `fill="${PAPER}"`);
    // a tiny head and shoulders in each call
    const head = [], body = [];
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; head.push(wallPt(wall_, c, u + gu / 2 + Math.cos(a) * gu * 0.13, v + gv * 0.6 + Math.sin(a) * gu * 0.13)); }
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; body.push(wallPt(wall_, c, u + gu / 2 + Math.cos(a) * gu * 0.27, v + Math.sin(a) * gv * 0.38)); }
    s += poly(head, `fill="${INK}"`) + poly(body, `fill="${INK}"`);
  }
  return s;
}
// solid stair blocks descending along +y (black risers, white treads)
function stairsY(x0, x1, yTop, yBottom, zTop, zBottom, steps) {
  const run = (yBottom - yTop) / steps, rise = (zTop - zBottom) / steps;
  let s = "";
  for (let i = 0; i < steps; i++) {
    const ya = yTop + i * run, yb = ya + run, zt = zTop - i * rise, zb = zt - rise;
    s += poly([P(x0, ya, zt), P(x1, ya, zt), P(x1, yb, zt), P(x0, yb, zt)], `fill="${PAPER}" ${ST(MID)}`);
    s += poly([P(x0, yb, zt), P(x1, yb, zt), P(x1, yb, zb), P(x0, yb, zb)], `fill="${INK}" ${ST(MID)}`);
    s += poly([P(x1, ya, zt), P(x1, yb, zt), P(x1, yb, zb), P(x1, ya, zb)], `fill="${INK}" ${ST(MID)}`);
  }
  return s;
}
// ladder in a y = const plane pair, leaning from (xb, z = zb) up to (xt, zt)
function ladder(xb, zb, xt, zt, y0, width = 48, rung = 32) {
  const bar = (a, b, w) => line(a, b, `stroke="${INK}" stroke-width="${w + 1.3}" stroke-linecap="round"`) +
    line(a, b, `stroke="${PAPER}" stroke-width="${w}" stroke-linecap="round"`);
  const len = Math.hypot(xt - xb, zt - zb), n = Math.floor(len / rung);
  let s = bar(P(xb, y0, zb), P(xt, y0, zt), 2.2);
  for (let i = 1; i < n; i++) {
    const f = i / n, x = xb + (xt - xb) * f, z = zb + (zt - zb) * f;
    s += bar(P(x, y0 - 6, z), P(x, y0 + width + 6, z), 1.6);
  }
  s += bar(P(xb, y0 + width, zb), P(xt, y0 + width, zt), 2.2);
  return s;
}
// ADHD's idea board: sticky notes and the threads between them
function ideaBoard(wall_, c, u0, z0, w, h) {
  let s = poly(quad(wall_, c, u0, z0, w, h), `fill="${PAPER}" ${ST(MID)}`);
  // a loose grid of sticky notes, a few threads between them
  const cols = 5, rows = 7, n = Math.min(w / cols, h / rows) * 0.62, cells = [];
  const palette = [SWATCH.salmon, PAPER, SWATCH.gold, PAPER, INK, PAPER, SWATCH.salmon, PAPER, SWATCH.indigo, PAPER];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (rnd() < 0.28) continue;
    const u = u0 + (i + 0.5) * w / cols + (rnd() - 0.5) * 14, v = z0 + (j + 0.5) * h / rows + (rnd() - 0.5) * 12;
    cells.push([u, v, palette[Math.floor(rnd() * palette.length)]]);
  }
  for (let k = 0; k + 3 < cells.length; k += 4) {
    const a = cells[k], b = cells[k + 3];
    s += line(wallPt(wall_, c, a[0], a[1]), wallPt(wall_, c, b[0], b[1]), `stroke="${INK}" stroke-width="${THIN}"`);
  }
  for (const [u, v, f] of cells) {
    s += poly(quad(wall_, c, u - n / 2, v - n / 2, n, n), `fill="${f}" ${ST(0.5)}`);
    if (f === PAPER) for (const q of [0.66, 0.42]) s += line(wallPt(wall_, c, u - n * 0.32, v - n / 2 + n * q), wallPt(wall_, c, u + n * 0.3, v - n / 2 + n * q), `stroke="${INK}" stroke-width="0.35"`);
  }
  return s;
}
// Kafein's colour chips: the catalog swatches as a Pantone-style chart
function swatchChart(wall_, c, u0, z0, w, h) {
  let s = poly(quad(wall_, c, u0, z0, w, h), `fill="${PAPER}" ${ST(MID)}`);
  const cols = 3, rows = 2, pad = w * 0.08, cw = (w - pad * (cols + 1)) / cols, ch = (h - pad * (rows + 1)) / rows;
  const sw = [SWATCH.indigo, SWATCH.plum, SWATCH.salmon, SWATCH.gold, SWATCH.orange, SWATCH.brick];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = u0 + pad + i * (cw + pad), v = z0 + h - pad - (j + 1) * ch - j * pad;
    s += poly(quad(wall_, c, u, v, cw, ch), `fill="${PAPER}" ${ST(0.5)}`);
    s += poly(quad(wall_, c, u, v + ch * 0.34, cw, ch * 0.66), `fill="${sw[j * cols + i]}" ${ST(0.5)}`);
    s += line(wallPt(wall_, c, u + cw * 0.15, v + ch * 0.17), wallPt(wall_, c, u + cw * 0.7, v + ch * 0.17), `stroke="${INK}" stroke-width="0.4"`);
  }
  return s;
}
// solid stair blocks climbing toward the back (−y), arriving at (yTop, zTop)
function stairsUp(x0, x1, yTop, yBottom, zTop, steps) {
  const run = (yBottom - yTop) / steps, rise = zTop / steps;
  let s = "";
  for (let i = 0; i < steps; i++) {   // back (highest) step first
    const ya = yTop + i * run, yb = ya + run, zt = zTop - i * rise, zb = zt - rise;
    s += poly([P(x0, ya, zt), P(x1, ya, zt), P(x1, yb, zt), P(x0, yb, zt)], `fill="${PAPER}" ${ST(MID)}`);
    s += poly([P(x0, yb, zt), P(x1, yb, zt), P(x1, yb, zb), P(x0, yb, zb)], `fill="${INK}" ${ST(MID)}`);
    s += poly([P(x1, ya, zt), P(x1, yb, zt), P(x1, yb, zb), P(x1, ya, zb)], `fill="${INK}" ${ST(MID)}`);
  }
  return s;
}
// floating stair blocks along the back wall, climbing toward +x
function stairsX(x0, x1, y0, y1, zTop, steps) {
  const run = (x1 - x0) / steps, rise = zTop / steps;
  let s = "";
  for (let i = 0; i < steps; i++) {
    const xa = x0 + i * run, xb = xa + run, zt = (i + 1) * rise, zb = zt - rise;
    s += poly([P(xa, y0, zt), P(xb, y0, zt), P(xb, y1, zt), P(xa, y1, zt)], `fill="${PAPER}" ${ST(MID)}`);
    s += poly([P(xa, y1, zt), P(xb, y1, zt), P(xb, y1, zb), P(xa, y1, zb)], `fill="${INK}" ${ST(MID)}`);
    s += poly([P(xb, y0, zt), P(xb, y1, zt), P(xb, y1, zb), P(xb, y0, zb)], `fill="${INK}" ${ST(MID)}`);
  }
  return s;
}
// iso-skewed label on a slab face: "front" (y = const) or "right" (x = const)
function faceLabel(face, str, x, y, z, size, color = PAPER) {
  const [X, Y] = P(x, y, z);
  const { d } = textPath(str, { font: "SemiBold", size, tracking: 80 });
  const m = face === "front" ? `${C.toFixed(4)},0.5,0,1` : `${C.toFixed(4)},-0.5,0,1`;
  return `<path d="${d}" fill="${color}" transform="matrix(${m},${X.toFixed(2)},${Y.toFixed(2)})"/>`;
}

// ── the building ───────────────────────────────────────────────────────────
// One cutaway house in Zeynep's language: heavy black slabs, thin walls with
// black section caps, tiled floors. A double-height lounge whose back wall
// carries the Marwood motif as windows, a glass meeting box on a mezzanine,
// a Cliff nook under it, and black block stairs up from the entrance.
const GX = 640, GY = 480, WALL = 540, TW = 18;      // plate, wall height, wall thickness
const MZ = { x0: 300, y1: 210, z: 300, t: 30 };     // mezzanine over x 300..640, y 0..210
const BOX_H = 230;                                    // glass meeting box height
const PR = (n) => `products/${n}.svg`;
const fill = (c, w = MID) => `fill="${c}" ${ST(w)}`;

function rug([x0, y0, x1, y1], z, color, r = 30) {
  const q = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * Math.PI / 2; q.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); } };
  arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, Math.PI / 2); arc(x0 + r, y0 + r, Math.PI); arc(x1 - r, y0 + r, Math.PI * 1.5);
  return poly(q, fill(color, MID));
}
// the motif as windows in the back wall (y = c): two round windows and a pill
function motifWindows(c, cu, cv, width) {
  const k = width / 100.9, r = 9.9 * k, ang = 32 * Math.PI / 180;
  const at = (u, v) => P(cu + u, c, cv + v);
  const ring = (du) => { const q = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; q.push(at(du + Math.cos(a) * r, Math.sin(a) * r)); } return q; };
  const pill = []; const half = 25 * k - r, pc = 24 * k;
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI; pill.push([half + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + (i / 16) * Math.PI; pill.push([-half + Math.cos(a) * r, Math.sin(a) * r]); }
  const rot = ([u, v]) => [pc + u * Math.cos(ang) - v * Math.sin(ang), u * Math.sin(ang) + v * Math.cos(ang)];
  let s = "";
  for (const du of [-40.55 * k, -16.55 * k]) {
    s += poly(ring(du), fill(PAPER, HEAVY + 0.6));
    s += line(at(du - r, 0), at(du + r, 0), `stroke="${INK}" stroke-width="${THIN}"`) + line(at(du, -r), at(du, r), `stroke="${INK}" stroke-width="${THIN}"`);
  }
  s += poly(pill.map(rot).map(([u, v]) => at(u, v)), fill(PAPER, HEAVY + 0.6));
  for (const t of [-0.5, 0, 0.5]) { const [u0, v0] = rot([t * half * 1.3, -r]), [u1, v1] = rot([t * half * 1.3, r]); s += line(at(u0, v0), at(u1, v1), `stroke="${INK}" stroke-width="${THIN}"`); }
  return s;
}
// glass panel in a wall plane: thin frame, mullions, Zeynep's double reflection strokes
function glass(wall_, c, u0, u1, z0, h, panes, glints = []) {
  let s = "";
  const W_ = (u1 - u0) / panes;
  s += line(wallPt(wall_, c, u0, z0 + h), wallPt(wall_, c, u1, z0 + h), `stroke="${INK}" stroke-width="${MID}"`);
  for (let i = 0; i <= panes; i++) s += line(wallPt(wall_, c, u0 + i * W_, z0), wallPt(wall_, c, u0 + i * W_, z0 + h), `stroke="${INK}" stroke-width="${i === 0 || i === panes ? MID : THIN}"`);
  for (const i of glints) {
    const ua = u0 + i * W_;
    for (const [o, l] of [[0.18, 0.42], [0.3, 0.22]]) s += line(wallPt(wall_, c, ua + W_ * o, z0 + h * 0.86), wallPt(wall_, c, ua + W_ * (o + l * 0.55), z0 + h * (0.86 - l)), `stroke="${INK}" stroke-width="${THIN}" stroke-linecap="round"`);
  }
  return s;
}
function pendant(x, y, zTop, zLamp, r = 22) {
  const [X, Y] = P(x, y, zLamp), [, Yt] = P(x, y, zTop);
  const w = r * S * 1.25;
  return line([X, Yt], [X, Y - r * S * 0.5], `stroke="${INK}" stroke-width="${THIN}"`) +
    `<path d="M${(X - w).toFixed(2)},${Y.toFixed(2)} A${w.toFixed(2)},${(w * 0.95).toFixed(2)} 0 0 1 ${(X + w).toFixed(2)},${Y.toFixed(2)} Z" fill="${INK}"/>` +
    `<ellipse cx="${X.toFixed(2)}" cy="${Y.toFixed(2)}" rx="${w.toFixed(2)}" ry="${(w * 0.28).toFixed(2)}" fill="${PAPER}" ${ST(MID)}/>`;
}
function column(x, y, z0, z1, r = 12) {
  const a = P(x - r, y + r, z0), b = P(x + r, y + r, z0), c = P(x + r, y - r, z0);
  const at = P(x - r, y + r, z1), bt = P(x + r, y + r, z1), ct = P(x + r, y - r, z1);
  return poly([a, b, bt, at], fill(PAPER)) + poly([b, c, ct, bt], fill(PAPER));
}
// Sakar's spill: coffee lands on the floor as the Marwood motif (u along −y
// reads left→right on screen, v along −x reads upward)
function floorMotif(cx, cy, z, width, color) {
  const k = width / 100.9, r = 9.9 * k, ang = 32 * Math.PI / 180;
  const at = (u, v) => P(cx - v, cy - u, z);
  const ring = (du, rr = r) => { const q = []; for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; q.push(at(du + Math.cos(a) * rr, Math.sin(a) * rr)); } return q; };
  const pill = []; const half = 25 * k - r, pc = 24 * k;
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI; pill.push([half + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + (i / 16) * Math.PI; pill.push([-half + Math.cos(a) * r, Math.sin(a) * r]); }
  const rot = ([u, v]) => [pc + u * Math.cos(ang) - v * Math.sin(ang), u * Math.sin(ang) + v * Math.cos(ang)];
  let s = poly(ring(-40.55 * k), fill(color, 0.7)) + poly(ring(-16.55 * k), fill(color, 0.7)) + poly(pill.map(rot).map(([u, v]) => at(u, v)), fill(color, 0.7));
  for (const [du, dv, rr] of [[-58, 14, 2.2], [-50, -16, 1.6], [62, 26, 2], [30, -22, 1.4]]) s += poly(ring(du * k, rr * k).map((p, i) => p), fill(color, 0.5)).replace(/points="[^"]*"/, (m) => m) ;
  return s;
}
// a folded paper plane flying toward screen-right, drawn flat on screen
function paperPlane(X, Y, size, tilt = -18) {
  const a = tilt * Math.PI / 180, R = ([x, y]) => [X + (x * Math.cos(a) - y * Math.sin(a)) * size, Y + (x * Math.sin(a) + y * Math.cos(a)) * size];
  const wing = [[1, 0], [-0.9, -0.45], [-0.45, 0.02]].map(R), keel = [[1, 0], [-0.45, 0.02], [-0.7, 0.32]].map(R);
  return poly(wing, fill(PAPER, 0.6)) + poly(keel, fill(SWATCH.salmon, 0.6));
}
// a yellow raincoat hanging from the coat stand's hook
function coat(X, Y, w) {
  const h = w * 1.9;
  const d = `M${X - w * 0.18},${Y} C${X - w * 0.5},${Y + h * 0.05} ${X - w * 0.5},${Y + h * 0.25} ${X - w * 0.46},${Y + h * 0.4} L${X - w * 0.58},${Y + h} L${X + w * 0.58},${Y + h} L${X + w * 0.46},${Y + h * 0.4} C${X + w * 0.5},${Y + h * 0.25} ${X + w * 0.5},${Y + h * 0.05} ${X + w * 0.18},${Y} Z`;
  return `<path d="${d}" fill="${SWATCH.gold}" ${ST(0.7)}/>` +
    `<path d="M${X - w * 0.18},${Y} L${X},${Y + h * 0.3} L${X + w * 0.18},${Y} M${X},${Y + h * 0.3} L${X},${Y + h * 0.98} M${X - w * 0.46},${Y + h * 0.52} L${X + w * 0.46},${Y + h * 0.52}" fill="none" ${ST(0.6)}/>`;
}
const sortDraw = (items) => items.sort((a, b) => a.depth - b.depth).map((g) => g.svg).join("\n");

function scene() {
  const out = [];
  // ground plate + walls
  out.push(slab([0, 0, GX, GY], 0, 40, { front: [[0, GX, INK]], right: [[0, GY, INK]] }));
  out.push(tiles([0, 0, GX, GY], 0));
  out.push(wall("left", 0, 0, GY, 0, WALL), wall("back", 0, 0, GX, 0, WALL));
  // black section caps on the cut walls
  out.push(poly([P(-TW, 0, WALL), P(0, 0, WALL), P(0, GY, WALL), P(-TW, GY, WALL)], fill(INK)));
  out.push(poly([P(0, -TW, WALL), P(GX, -TW, WALL), P(GX, 0, WALL), P(0, 0, WALL)], fill(INK)));
  out.push(poly([P(-TW, GY, 0), P(0, GY, 0), P(0, GY, WALL), P(-TW, GY, WALL)], fill(INK)));
  out.push(poly([P(GX, -TW, 0), P(GX, 0, 0), P(GX, 0, WALL), P(GX, -TW, WALL)], fill(INK)));

  // LOUNGE (sofas & armchairs), back left, double height
  out.push(motifWindows(0, 114, 412, 206));
  out.push(swatchChart("left", 0, 70, 150, 105, 86));
  out.push(rug([105, 72, 290, 245], 0, SWATCH.plum));
  // CREATIVE CORNER (poufs), front left: ADHD's idea wall
  out.push(ideaBoard("left", 0, 222, 40, 246, 430));
  out.push(rug([110, 300, 290, 455], 0, SWATCH.salmon));
  // CLIFF NOOK (accessories), under the mezzanine
  out.push(rug([330, 95, 615, 205], 0, SWATCH.gold));

  const ground = [
    // lounge: sofa on the left wall facing the table, armchair facing it from the back
    { depth: 60, svg: stairsX(30, MZ.x0, 0, 60, MZ.z, 12) },
    asset(PR("DOSEME_71_Solar_Sofa"), { at: [55, 148, 0] }),
    asset("src_kafein_sit.svg", { at: [62, 142, 42], sit: true, depth: 210 }),
    asset(PR("DOSEME_117_Joker_Lng"), { at: [185, 102, 0], flip: true }),
    asset(PR("DOSEME_146_Punto_P_70"), { at: [178, 182, 0] }),
    asset("cat_sit.svg", { at: [170, 178, 38], depth: 362 }),
    // creative corner: three stacked Pile poufs to reach the top of the idea wall
    ...[0, 44, 88].map((z, i) => asset(PR("DOSEME_175_Pile_Pouf__50H_44"), { at: [55, 350, z], depth: 400 + i })),
    asset("adhd_reach.svg", { at: [55, 350, 132], flip: true, depth: 404 }),
    asset(PR("PANEL_506_Pile__70H45"), { at: [205, 380, 0] }),
    asset(PR("DOSEME_164_Origo_R_60H45"), { at: [255, 320, 0] }),
    asset(PR("DOSEME_165_Origo_R_80H45"), { at: [150, 445, 0] }),
    // Cliff nook
    asset(PR("DOSEME_241_Cliff_Height"), { at: [440, 120, 0] }),
    asset(PR("DOSEME_240_Cliff_Middle"), { at: [565, 125, 0] }),
    asset(PR("DOSEME_165_Origo_R_80H45"), { at: [505, 180, 0] }),
    asset("asosyal_sit.svg", { at: [505, 182, 45], sit: true, depth: 690 }),
  ];
  out.push(sortDraw(ground));
  out.push(pendant(178, 182, WALL, 250));

  // mezzanine + glass meeting box (CHAIRS)
  out.push(slab([MZ.x0, 0, GX, MZ.y1], MZ.z, MZ.t, { front: [[MZ.x0, GX, INK]], right: [[0, MZ.y1, INK]] }));
  out.push(tiles([MZ.x0, 0, GX, MZ.y1], MZ.z));
  out.push(rug([MZ.x0 + 25, 25, GX - 25, MZ.y1 - 15], MZ.z, SWATCH.indigo, 20));
  out.push(meetingScreen("back", 0, MZ.x0 + 50, MZ.z + 105, 250, 105));
  out.push(glass("left", MZ.x0, 70, MZ.y1, MZ.z, BOX_H, 2, [1]));
  const meet = [
    asset(PR("PANEL_269_Loft_T"), { at: [480, 125, MZ.z], flip: true }),
    asset(PR("DOSEME_9_Jun_Seminar_Grey_Black_"), { at: [425, 40, MZ.z], flip: true }),
    asset(PR("DOSEME_1_Glory_Mng_Grey_Black_"), { at: [535, 42, MZ.z], flip: true }),
    asset("aktivist_write.svg", { at: [535, 46, MZ.z + 50], sit: true, flip: true, depth: 585 }),
    asset(PR("DOSEME_9_Jun_Seminar_Grey_Black_"), { at: [330, 125, MZ.z] }),
    asset("narsist_point.svg", { at: [566, 196, MZ.z], depth: 790 }),
  ];
  out.push(sortDraw(meet));
  out.push(glass("back", MZ.y1, MZ.x0, GX, MZ.z, BOX_H, 3, [0]));

  // entrance: stairs up to the meeting box, coat stand, Sakar
  const [ax, ay] = P(612, 395, 150);
  const front = [
    { depth: 600, svg: floorMotif(372, 392, 0, 135, SWATCH.brown) },
    asset(PR("DOSEME_242_Avion"), { at: [612, 395, 0] }),
    { depth: 1008, svg: coat(ax + 5, ay, 22) },
    asset("plant.svg", { at: [348, 168, 0] }),
    asset("sakar_spill.svg", { at: [455, 372, 0] }),
  ];
  out.push(sortDraw(front));
  // ideas fly from ADHD's wall to the meeting box
  const path = [P(30, 300, 330), P(120, 180, 420), P(260, 120, 430)];
  out.push(`<path d="M${path[0].join(",")} Q${path[1].join(",")} ${path[2].join(",")}" fill="none" stroke="${INK}" stroke-width="0.5" stroke-dasharray="2 2.5"/>`);
  out.push(paperPlane(...P(150, 190, 410), 7, -14), paperPlane(...P(262, 122, 432), 7.5, 6));
  return out.join("\n");
}

function build() {
  const parts = [];
  parts.push(`<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}" fill="${PAPER}"/>`);
  parts.push(`<g id="scene">${scene()}</g>`);
  const t = [];
  t.push(text("CATALOG’26 · KATALOG’26", { font: "SemiBold", size: 6.6, x: ML, y: MT + 5, tracking: 100 }));
  t.push(text("Seating", { font: "Bold", size: 50, x: ML - 2.5, y: 132 }));
  t.push(text("Döşeme", { font: "Medium", size: 13, x: ML, y: 154 }));
  t.push(text("Chairs  ·  Sofas & Armchairs  ·  Poufs  ·  Accessories", { size: 8.5, x: ML, y: 176, fill: SWATCH.grey }));
  parts.push(`<g id="text">${t.join("")}</g>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(W + 2 * B).toFixed(3)}pt" height="${(H + 2 * B).toFixed(3)}pt" viewBox="${-B} ${-B} ${(W + 2 * B).toFixed(3)} ${(H + 2 * B).toFixed(3)}">\n${parts.join("\n")}\n</svg>\n`;
}

const svg = build();
fs.writeFileSync(path.join(OUT, "kapak_doseme_iso.svg"), svg);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 612, height: 859 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><body style="margin:0">${svg.replace(/<\?xml[^>]*>/, "").replace(/width="[^"]*pt" height="[^"]*pt"/, 'width="612" height="859"')}</body>`);
await page.screenshot({ path: path.join(OUT, "kapak_doseme_iso.png") });
await browser.close();
console.log("out/kapak_doseme_iso.svg");
