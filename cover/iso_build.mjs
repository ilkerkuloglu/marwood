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
const S = 0.40;                 // pt per cm on the cover
const PRODUCT_NATIVE = 0.55;    // pt per cm of the catalog's isometric drawings
const C = Math.cos(Math.PI / 6);
let OX = 350, OY = 425;         // screen position of world origin
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
function loadAsset(file) {
  const src = fs.readFileSync(path.join(HERE, "assets", file), "utf8");
  const vb = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const defs = (src.match(/<defs>([\s\S]*?)<\/defs>/) || [, ""])[1];
  const glyph = {};
  for (const m of defs.matchAll(/<g id="([^"]+)">\s*<path d="([^"]*)"\s*\/?>(?:<\/path>)?\s*<\/g>/g)) glyph[m[1]] = m[2];
  let body = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<defs>[\s\S]*?<\/defs>/, "");
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

/**
 * Put an asset in the world. Its bottom-centre (or `anchor` fraction of the
 * bbox) lands on the projected world point. Products keep the catalog scale;
 * characters are sized by `h` (pt). `flip` mirrors (swaps the iso axes).
 */
function asset(file, { at, h, hcm, scale, ax = 0.5, ay = 1, flip = false, stroke, depth }) {
  if (hcm) h = hcm * S;
  const a = loadAsset(file);
  const [vx, vy, vw, vh] = a.vb;
  const isProduct = file.startsWith("products/");
  const k = scale ?? (isProduct ? S / PRODUCT_NATIVE : h / vh);
  const [X, Y] = P(...at);
  let body = a.body;
  if (isProduct) body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${((stroke ?? 0.7) / k).toFixed(3)}"`)
    .replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${INK}"`);
  const fx = flip ? -1 : 1;
  const tx = X - (vx + ax * vw) * k * fx, ty = Y - (vy + ay * vh) * k;
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
  const cols = 4, rows = 3, n = w / (cols + 1) * 0.72, cells = [];
  const fills = [SWATCH.salmon, PAPER, SWATCH.gold, PAPER, PAPER, SWATCH.salmon, PAPER, INK, SWATCH.gold, PAPER, SWATCH.salmon, PAPER];
  const jit = [[2, -3], [-3, 2], [1, 4], [-2, -1], [3, 1], [-1, -4], [2, 3], [-3, 0], [0, 2], [4, -2], [-2, 3], [1, -1]];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    cells.push([u0 + (i + 1) * w / (cols + 1) + jit[k][0], z0 + (j + 0.5) * h / rows + jit[k][1], fills[k]]);
  }
  for (const [a, b] of [[0, 5], [5, 2], [5, 10], [8, 9], [3, 6]])
    s += line(wallPt(wall_, c, cells[a][0], cells[a][1]), wallPt(wall_, c, cells[b][0], cells[b][1]), `stroke="${INK}" stroke-width="${THIN}"`);
  for (const [u, v, f] of cells) {
    s += poly(quad(wall_, c, u - n / 2, v - n / 2, n, n), `fill="${f}" ${ST(0.5)}`);
    if (f === PAPER) for (const q of [0.62, 0.38]) s += line(wallPt(wall_, c, u - n * 0.32, v - n / 2 + n * q), wallPt(wall_, c, u + n * 0.32, v - n / 2 + n * q), `stroke="${INK}" stroke-width="0.35"`);
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
// iso-skewed label on a slab face: "front" (y = const) or "right" (x = const)
function faceLabel(face, str, x, y, z, size, color = PAPER) {
  const [X, Y] = P(x, y, z);
  const { d } = textPath(str, { font: "SemiBold", size, tracking: 80 });
  const m = face === "front" ? `${C.toFixed(4)},0.5,0,1` : `${C.toFixed(4)},-0.5,0,1`;
  return `<path d="${d}" fill="${color}" transform="matrix(${m},${X.toFixed(2)},${Y.toFixed(2)})"/>`;
}

// ── rooms ──────────────────────────────────────────────────────────────────
// Each room floats on its own slab (Zeynep's floating floors). Items are given
// in room-local cm and offset by the room origin.
const T_SLAB = 36, WALL_H = 230;
function room(R) {
  const [ox, oy, oz] = R.o;
  const L = (x, y, z = 0) => [ox + x, oy + y, oz + z];
  const [w, d] = R.size;
  const parts = [];
  parts.push(slab([ox, oy, ox + w, oy + d], oz, T_SLAB, {
    front: R.front.map(([a, b, col]) => [ox + a, ox + b, col]),
    right: R.right.map(([a, b, col]) => [oy + a, oy + b, col]),
  }));
  parts.push(tiles([ox, oy, ox + w, oy + d], oz));
  if (R.walls?.left) parts.push(wall("left", ox, oy + R.walls.left[0], oy + R.walls.left[1], oz, WALL_H));
  if (R.walls?.back) parts.push(wall("back", oy, ox + R.walls.back[0], ox + R.walls.back[1], oz, WALL_H));
  for (const f of R.decor || []) parts.push(f({ ox, oy, oz }));
  for (const [face, str, u] of R.labels) {
    parts.push(face === "front" ? faceLabel("front", str, ox + u, oy + d, oz - T_SLAB / 2 - 3.2 / S, 8)
      : faceLabel("right", str, ox + w, oy + d - u, oz - T_SLAB / 2 - 3.2 / S, 8));
  }
  const items = R.items.map(([file, x, y, z, o = {}]) => asset(file, { ...o, at: L(x, y, z), depth: o.depth ?? (x + y + (o.dz ?? 0)) }));
  parts.push(...items.sort((a, b) => a.depth - b.depth).map((g) => g.svg));
  return parts.join("\n");
}

const PR = (n) => `products/${n}.svg`;
function scene() {
  const Z1 = 440, Z2 = 220;
  // R1 top right: CHAIRS — the meeting room
  const R1 = {
    o: [0, 0, Z1], size: [360, 300],
    front: [[0, 360, SWATCH.indigo]], right: [[0, 300, SWATCH.indigo]],
    walls: { left: [0, 300], back: [0, 360] },
    labels: [["front", "CHAIRS", 14]],
    decor: [
      ({ ox, oy, oz }) => meetingScreen("left", ox, oy + 30, oz + 95, 210, 105),
      ({ ox, oy, oz }) => windowOn("back", oy, ox + 170, oz + 85, 150, 105, 3),
    ],
    items: [
      ["narsist_stand.svg", 40, 210, 0, { hcm: 178 }],
      [PR("PANEL_269_Loft_T"), 205, 150, 0],
      [PR("DOSEME_9_Jun_Seminar_Grey_Black_"), 150, 90, 0, { flip: true }],
      [PR("DOSEME_9_Jun_Seminar_Grey_Black_"), 280, 120, 0, { flip: true }],
      [PR("DOSEME_1_Glory_Mng_Grey_Black_"), 180, 250, 0, { flip: true }],
      ["aktivist_write.svg", 190, 248, 2, { hcm: 150, dz: 2 }],
      [PR("DOSEME_9_Jun_Seminar_Grey_Black_"), 300, 230, 0],
    ],
  };
  // R2 middle left: POUFS — the break room
  const R2 = {
    o: [-26, 436, Z2], size: [360, 300],
    front: [[0, 360, SWATCH.salmon]], right: [[0, 300, SWATCH.salmon]],
    walls: { left: [0, 300], back: [0, 200] },
    labels: [["front", "POUFS", 14]],
    decor: [
      ({ ox, oy, oz }) => ideaBoard("left", ox, oy + 45, oz + 80, 150, 110),
      ({ ox, oy, oz }) => windowOn("back", oy, ox + 40, oz + 85, 120, 105, 2),
    ],
    items: [
      [PR("DOSEME_175_Pile_Pouf__50H_44"), 75, 75, 0],
      ["cat_sleep.svg", 73, 71, 44, { hcm: 52, dz: 10 }],
      ["sakar_handstand.svg", 205, 95, 0, { hcm: 251 }],
      [PR("DOSEME_165_Origo_R_80H45"), 60, 200, 0],
      ["adhd_coffee.svg", 135, 245, 0, { hcm: 150 }],
      [PR("PANEL_506_Pile__70H45"), 245, 205, 0],
      [PR("DOSEME_164_Origo_R_60H45"), 320, 250, 0],
    ],
  };
  // R3 bottom right: SOFAS & ARMCHAIRS lounge + open ACCESSORIES deck in front
  const R3 = {
    o: [410, 410, 0], size: [360, 520],
    front: [[0, 360, SWATCH.gold]], right: [[0, 300, SWATCH.plum], [300, 520, SWATCH.gold]],
    walls: { left: [0, 140], back: [0, 360] },
    labels: [["front", "ACCESSORIES", 14], ["right", "SOFAS & ARMCHAIRS", 232]],
    decor: [
      ({ ox, oy, oz }) => swatchChart("back", oy, ox + 18, oz + 105, 100, 82),
      ({ ox, oy, oz }) => posterOn("left", ox, oy + 25, oz + 105, 90, 80, SWATCH.plum),
      ({ ox, oy, oz }) => windowOn("back", oy, ox + 205, oz + 85, 135, 105, 3),
      ({ ox, oy, oz }) => line(P(ox, oy + 300, oz), P(ox + 360, oy + 300, oz), `stroke="${INK}" stroke-width="${MID}"`),
    ],
    items: [
      ["kafein_sofa.svg", 150, 130, 0, { hcm: 240 }],
      [PR("DOSEME_117_Joker_Lng"), 300, 80, 0],
      [PR("DOSEME_146_Punto_P_70"), 215, 235, 0],
      [PR("DOSEME_83_Lumo"), 315, 200, 0],
      ["asosyal_rock.svg", 95, 405, 0, { hcm: 320 }],
      [PR("DOSEME_240_Cliff_Middle"), 225, 455, 0],
      [PR("DOSEME_239_Cliff_Small"), 40, 490, 0],
      [PR("DOSEME_242_Avion"), 335, 470, 0],
    ],
  };
  const parts = [room(R1)];
  // stairs from the meeting room down to the break room
  parts.push(stairsY(250, 320, 300, 436, Z1, Z2, 8));
  parts.push(room(R2));
  // ladder from the lounge up to the break room's edge
  parts.push(ladder(470, 0, 334, Z2, 572));
  parts.push(room(R3));
  return parts.join("\n");
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
