// Marwood ORGATEC invitation — "the Marwood line".
// A 15 s vertical spot: we ride Zeynep's metro car past the characters, each
// carrying something from one corner of the stand; the route map at the
// bottom runs Souvenir Shop → Layer Bakery → Palette Lab → Bloom Atelier →
// Marwood; the cat presses STOP, the train brakes, and the four line colours
// become the four awnings of the stand.
// Everything is a pure function of time: window.scene.seek(t) draws frame t.
import { ASSETS } from "./assets.js";

const W = 1080, H = 1920, DURATION = 15;
const C = {
  navy: "#0f233d", ink: "#1b1b1b", white: "#ffffff", beige: "#e9dcc5", beigeD: "#dccaa9",
  cream: "#fbf6ea", tan: "#d0b088", rod: "#7a4a2c",
  teal: "#3b8a84", pink: "#e3a8a1", gold: "#d0a23a", olive: "#7d7a33", red: "#b04828",
  salmon: "#f67f62", rose: "#f574a6", plum: "#621744", indigo: "#3d3e96", brown: "#852f24",
  dough: "#d9a35b", choc: "#4a2a1a",
};
const STATIONS = [
  { name: "Souvenir Shop", lines: ["SOUVENIR", "SHOP"], color: C.teal },
  { name: "Layer Bakery", lines: ["LAYER", "BAKERY"], color: C.pink },
  { name: "Palette Lab", lines: ["PALETTE", "LAB"], color: C.gold },
  { name: "Bloom Atelier", lines: ["BLOOM", "ATELIER"], color: C.olive },
  { name: "Marwood", lines: ["MARWOOD"], color: C.white },
];

// ── easing & helpers ──────────────────────────────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t) => 1 - Math.pow(1 - t, 3);
const ei = (t) => t * t * t;
const back = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const sine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
// a damped spring settling at 1 (for pops)
const spring = (t, k = 7, z = 0.32) => (t <= 0 ? 0 : 1 - Math.exp(-z * k * t) * Math.cos(k * t * Math.sqrt(1 - z * z)));
const f = (n) => +n.toFixed(2);
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ── svg builders ──────────────────────────────────────────────────────────
const S = (w = 7) => `stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const ring = (cx, cy, r, attrs) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
const star4 = (r) => { const k = r * 0.22; return `M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r}Z`; };
// the Marwood motif: two circles and a pill rotated −32°, centred, width w
function motif(w, color, attrs = "") {
  const k = w / 100.9, r = 9.9 * k;
  const cx0 = -40.55 * k, cx1 = -16.55 * k, pc = 24 * k, L = 50 * k;
  return `<g ${attrs}><circle cx="${f(cx0)}" cy="0" r="${f(r)}" fill="${color}"/><circle cx="${f(cx1)}" cy="0" r="${f(r)}" fill="${color}"/>` +
    `<rect x="${f(pc - L / 2)}" y="${f(-r)}" width="${f(L)}" height="${f(2 * r)}" rx="${f(r)}" fill="${color}" transform="rotate(-32 ${f(pc)} 0)"/></g>`;
}

// ── world (Zeynep's metro, source-file coordinates) ───────────────────────
const PANES = [
  { x0: 14105, x1: 15590, y0: 6855, y1: 7250, clip: [[14105, 6855], [15405, 6855], [15405, 7108], [14786, 7108], [14786, 7250], [14105, 7250]] },
  { x0: 18472, x1: 19957, y0: 6857, y1: 7251 },
  { x0: 20270, x1: 21755, y0: 6857, y1: 7251 },
];
const PERIOD = 1700;
function cityStrip(pane, layer) {
  // a long strip of night city in white line art, two periods long
  seed = layer === "far" ? 7 : 19;
  let s = "";
  const base = pane.y1 + 6, x0 = pane.x0;
  if (layer === "far") {
    for (let rep = 0; rep < 2; rep++) {
      let x = x0 + rep * PERIOD;
      seed = 7;
      while (x < x0 + (rep + 1) * PERIOD - 40) {
        const w = 90 + rnd() * 150, h = 90 + rnd() * 230, top = base - h;
        const roof = rnd();
        if (roof < 0.25) s += `<path d="M${f(x)},${base} V${f(top + 30)} L${f(x + w / 2)},${f(top)} L${f(x + w)},${f(top + 30)} V${base}" fill="none" stroke="#fff" stroke-width="5"/>`;
        else if (roof < 0.45) s += `<path d="M${f(x)},${base} V${f(top)} H${f(x + w)} V${base} M${f(x + w * 0.4)},${f(top)} V${f(top - 40)}" fill="none" stroke="#fff" stroke-width="5"/>`;
        else s += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(h + 10)}" fill="none" stroke="#fff" stroke-width="5"/>`;
        for (let wy = top + 34; wy < base - 20; wy += 34) for (let wx = x + 18; wx < x + w - 18; wx += 30) if (rnd() < 0.42) s += `<rect x="${f(wx)}" y="${f(wy)}" width="11" height="13" fill="#fff"/>`;
        x += w + 10 + rnd() * 40;
      }
    }
  } else {
    // near: lamp posts and a rail fence rushing past
    for (let rep = 0; rep < 2; rep++) {
      const ox = x0 + rep * PERIOD;
      for (let i = 0; i < 4; i++) {
        const x = ox + i * (PERIOD / 4) + 60;
        s += `<path d="M${x},${base} V${base - 300} q0,-40 40,-40 h40" fill="none" stroke="#fff" stroke-width="7"/>` +
          `<ellipse cx="${x + 92}" cy="${base - 334}" rx="22" ry="9" fill="#fff"/>`;
      }
      s += `<path d="M${ox},${base - 70} H${ox + PERIOD}" stroke="#fff" stroke-width="5"/>`;
      for (let x = ox; x < ox + PERIOD; x += 85) s += `<path d="M${x},${base - 70} V${base}" stroke="#fff" stroke-width="5"/>`;
    }
  }
  return s;
}
function windowView(pane, i) {
  const id = `pane${i}`;
  const clip = pane.clip || [[pane.x0, pane.y0], [pane.x1, pane.y0], [pane.x1, pane.y1], [pane.x0, pane.y1]];
  const moonX = pane.x1 - 200, moonY = pane.y0 + 110;
  let stars = "";
  seed = 31 + i;
  for (let k = 0; k < 9; k++) stars += ring(pane.x0 + 60 + rnd() * (pane.x1 - pane.x0 - 120), pane.y0 + 30 + rnd() * 120, 4 + rnd() * 3, `fill="#fff"`);
  return `<clipPath id="${id}"><polygon points="${clip.map((p) => p.join(",")).join(" ")}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    `<g>${stars}<path d="M${moonX + 40},${moonY - 46} a52,52 0 1,0 0,92 a40,40 0 1,1 0,-92Z" fill="#fff"/></g>` +
    `<g id="far${i}">${cityStrip(pane, "far")}</g>` +
    `<g id="near${i}">${cityStrip(pane, "near")}</g>` +
    `<g id="streak${i}" opacity="0"></g>` +
    `</g>`;
}

// Narsist holds a perfume bottle where his briefcase was; the clip keeps the
// bottle behind his folded forearms
const BOTTLE = { x: 13128, y: 7395 };
function perfume() {
  const { x, y } = BOTTLE;
  const clip = `<clipPath id="armsclip"><polygon points="12700,6600 13560,6600 13560,7452 13330,7520 13175,7566 13090,7570 12955,7533 12700,7470"/></clipPath>`;
  const body = `<rect x="${x - 62}" y="${y}" width="124" height="190" rx="26" fill="#fff" ${S(8)}/>` +
    `<rect x="${x - 50}" y="${y + 52}" width="100" height="126" rx="16" fill="${C.gold}"/>` +
    `<path d="M${x - 36},${y + 26} V${y + 150}" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".9"/>` +
    `<g transform="translate(${x + 6} ${y + 108})">${motif(62, C.navy)}</g>` +
    `<rect x="${x - 22}" y="${y - 30}" width="44" height="34" rx="6" fill="#fff" ${S(8)}/>` +
    `<rect x="${x - 30}" y="${y - 78}" width="60" height="52" rx="10" fill="${C.ink}"/>` +
    `<rect x="${x - 46}" y="${y - 64}" width="18" height="12" rx="4" fill="${C.ink}"/>`;
  return `${clip}<g clip-path="url(#armsclip)"><g id="bottle">${body}</g></g>`;
}
// nozzle tip once the bottle is lifted (translate −46, rotate −8° about the base)
const NOZZLE = [13060, 7299];
const SPRAY = (() => {
  seed = 5;
  return Array.from({ length: 22 }, (_, k) => {
    const a = (198 + rnd() * 52) * Math.PI / 180;
    return { a, d: 130 + rnd() * 240, r: 7 + rnd() * 9, c: [C.gold, C.salmon, C.rose][k % 3], dl: rnd() * 0.12 };
  });
})();
function spritz() {
  let s = `<g id="spray">`;
  SPRAY.forEach((o, k) => { s += `<circle id="sd${k}" r="${f(o.r)}" fill="${o.c}" opacity="0"/>`; });
  s += `</g>`;
  // scent trail: two wavy strokes from the cloud up to his nose
  const [nx, ny] = NOZZLE;
  const trails = [
    `M${nx - 250},${ny - 150} C${nx - 330},${ny - 330} ${nx - 120},${ny - 380} ${nx - 150},${ny - 520} S${nx + 60},${ny - 520} ${nx + 120},${ny - 410}`,
    `M${nx - 190},${ny - 90} C${nx - 230},${ny - 250} ${nx - 30},${ny - 270} ${nx - 60},${ny - 400} S${nx + 120},${ny - 430} ${nx + 150},${ny - 380}`,
  ];
  s += `<g id="trails">${trails.map((d, k) => `<path id="tr${k}" d="${d}" pathLength="1" fill="none" stroke="${k ? C.salmon : C.gold}" stroke-width="12" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("")}</g>`;
  s += `<g id="sparkles">`;
  const SP = [[12930, 6700, 62, C.gold], [13390, 6660, 52, C.salmon], [13450, 6880, 40, C.gold], [12900, 6930, 44, C.salmon], [13250, 6540, 36, C.gold]];
  SP.forEach(([sx, sy, r, col], i) => { s += `<path id="spk${i}" d="${star4(r)}" transform="translate(${sx} ${sy}) scale(0)" fill="${col}" ${S(5)}/>`; });
  s += `</g>`;
  return s;
}
// eyelids: a white disc and a closed-eye stroke laid over an open eye
function lid(id, cx, cy, r) {
  return `<g id="${id}" opacity="0"><circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#fff"/>` +
    `<path d="M${cx - r - 3},${cy + 2} Q${cx},${cy + r} ${cx + r + 3},${cy + 2}" fill="none" ${S(6)}/></g>`;
}
// Aktivist's plant blossoms (Bloom Atelier)
const BLOSSOMS = [[15600, 6690, 1, C.salmon], [16060, 6600, 1.1, C.rose], [16330, 6830, 0.9, C.gold], [15790, 7010, 0.95, C.rose], [16200, 7090, 0.85, C.salmon], [15500, 6930, 0.8, C.gold]];
function blossom(i, [x, y, sc, col]) {
  let p = "";
  for (let k = 0; k < 5; k++) p += `<ellipse cx="0" cy="-34" rx="22" ry="34" fill="${col}" ${S(6)} transform="rotate(${k * 72})"/>`;
  return `<g id="bl${i}" transform="translate(${x} ${y}) scale(0)"><g transform="scale(${sc})">${p}${ring(0, 0, 17, `fill="${C.cream}" ${S(6)}`)}</g></g>`;
}
// Kafein's plate on the pouf (Layer Bakery): a donut and a slice of pizza
function plate() {
  const x = 18205, y = 7604;
  return `<g id="plate" transform="translate(${x} ${y}) scale(0)">` +
    `<ellipse cx="0" cy="0" rx="118" ry="30" fill="#fff" ${S(7)}/>` +
    `<path d="M-30,-6 L60,-40 L72,-6 Q20,6 -30,-6Z" fill="${C.dough}" ${S(6)}/>` +
    `<path d="M-14,-10 L56,-36 L64,-14 Q20,-4 -14,-10Z" fill="${C.red}"/>` +
    ring(28, -20, 7, `fill="${C.plum}"`) + ring(48, -26, 6, `fill="${C.plum}"`) +
    `<ellipse cx="-52" cy="-26" rx="56" ry="34" fill="${C.dough}" ${S(6)}/>` +
    `<ellipse cx="-52" cy="-32" rx="48" ry="26" fill="${C.rose}"/>` +
    `<ellipse cx="-52" cy="-30" rx="15" ry="9" fill="${C.dough}" ${S(5)}/>` +
    [[-80, -38, 20], [-30, -44, -30], [-70, -20, 60], [-28, -24, 10]].map(([a, b, r]) => `<rect x="${a}" y="${b}" width="12" height="4" rx="2" fill="#fff" transform="rotate(${r} ${a} ${b})"/>`).join("") +
    `</g>`;
}
// Sakar's laptop lid stickers (Souvenir Shop)
const LID = { x: 19705, y: 7335 };
function stickers() {
  const st = [
    { id: "st0", x: LID.x - 72, y: LID.y - 44, r: -12, body: `<rect x="-52" y="-24" width="104" height="48" rx="24" fill="${C.salmon}" ${S(5)}/><g transform="translate(4 0)">${motif(78, "#fff")}</g>` },
    { id: "st1", x: LID.x + 78, y: LID.y - 40, r: 14, body: `<path d="${star4(34)}" fill="${C.gold}" ${S(5)}/>` },
    { id: "st2", x: LID.x + 66, y: LID.y + 52, r: -8, body: `<path d="M0,22 C-46,-6 -30,-42 0,-20 C30,-42 46,-6 0,22Z" fill="${C.rose}" ${S(5)}/>` },
  ];
  return st.map((o) => `<g id="${o.id}" data-x="${o.x}" data-y="${o.y}" data-r="${o.r}" opacity="0">${o.body}</g>`).join("");
}
// Asosyal: DJ headphones over the hood, and notes floating up
function headphones() {
  // band over the hood, ear cups in the gap between the face ruffle and the hood
  return `<path d="M20474,6900 C20450,6596 20780,6596 20756,6900" fill="none" ${S(13)}/>` +
    `<rect x="20452" y="6866" width="44" height="108" rx="18" fill="${C.ink}"/><rect x="20734" y="6866" width="44" height="108" rx="18" fill="${C.ink}"/>`;
}
const NOTE_COLORS = [C.salmon, C.gold, C.rose, C.gold];
function note(i) {
  const col = NOTE_COLORS[i % 4];
  const d = i % 2 ? `M0,0 m-16,0 a16,12 -20 1,0 32,0 a16,12 -20 1,0 -32,0 M14,-4 V-70 L44,-58 V-30` : `M0,0 m-16,0 a16,12 -20 1,0 32,0 a16,12 -20 1,0 -32,0 M14,-4 V-74`;
  return `<g id="nt${i}" opacity="0"><path d="${d}" fill="${col}" ${S(6)}/></g>`;
}
// the STOP button on a grab pole next to the cart, and the cat that presses it
const POLE = { x: 22200, top: 6448, bottom: 7995, btnY: 7315 };
function pole() {
  const { x, top, bottom, btnY } = POLE;
  return `<rect x="${x - 17}" y="${top}" width="34" height="${bottom - top}" fill="#fff" ${S(6)}/>` +
    `<rect x="${x - 58}" y="${btnY - 70}" width="116" height="150" rx="22" fill="#fff" ${S(7)}/>` +
    `<circle id="btn" cx="${x}" cy="${btnY - 10}" r="36" fill="#fff" ${S(7)}/>` +
    `<text x="${x}" y="${btnY + 58}" text-anchor="middle" font-size="30" font-weight="700" fill="${C.ink}" letter-spacing="2">STOP</text>` +
    `<g id="rings" opacity="0">${[0, 1, 2].map((k) => `<circle id="rg${k}" cx="${x}" cy="${btnY - 10}" r="40" fill="none" stroke="${C.red}" stroke-width="8"/>`).join("")}</g>`;
}
const CAT = { x: 21905, y: 7686, s: 0.86 };
function cat() {
  const a = ASSETS.cat_sit, [vx, vy, vw, vh] = a.vb;
  const tx = CAT.x - (vx + vw / 2) * CAT.s, ty = CAT.y - (vy + vh) * CAT.s;
  // paw: a white foreleg that swings up to the button
  const paw = `<g id="paw" opacity="0" transform="translate(${CAT.x + 70} ${CAT.y - 240}) rotate(70)">` +
    `<path d="M0,-30 C80,-28 160,-24 214,-22 L214,22 C160,24 80,28 0,30 Z" fill="#fff" ${S(7)}/>` +
    `<ellipse cx="228" cy="0" rx="40" ry="31" fill="#fff" ${S(7)}/>` +
    `<path d="M246,-12 q10,0 16,-4 M250,4 q10,0 16,2 M244,18 q8,2 14,6" fill="none" ${S(5)}/></g>`;
  return `<g id="cat">${paw}<g transform="translate(${f(tx)} ${f(ty)}) scale(${CAT.s})">${a.body}${lid("lidC", 3474.3, 12736.6, 16)}</g></g>`;
}
function layer(name) {
  return `<g id="L_${name}">${ASSETS[name].body}</g>`;
}

function world() {
  return `<g id="world">` +
    `<rect x="11000" y="7985" width="17000" height="3000" fill="#000"/>` +
    `<rect x="11000" y="3000" width="17000" height="2840" fill="#fff"/>` +
    `<g id="car">${ASSETS.car.body}</g>` +
    PANES.map(windowView).join("") +
    perfume() + spritz() + lid("lidN", 13267, 6858, 15) +
    `<g id="blossoms">${BLOSSOMS.map((b, i) => blossom(i, b)).join("")}</g>` +
    layer("kafein") + plate() +
    `<g id="adhd">${layer("adhd")}${lid("lidA1", 14339, 6955, 16)}${lid("lidA2", 14443, 6956, 16)}` +
    `<mask id="bitemask" maskUnits="userSpaceOnUse" x="-80" y="-80" width="160" height="160"><rect x="-80" y="-80" width="160" height="160" fill="#fff"/><g id="bite" opacity="0"><circle cx="38" cy="-36" r="24" fill="#000"/><circle cx="52" cy="-10" r="16" fill="#000"/></g></mask>` +
    `<g id="cookie" transform="translate(14156 7612)"><g mask="url(#bitemask)"><circle r="54" fill="${C.dough}" ${S(7)}/>` +
    [[-20, -14], [14, -22], [18, 14], [-10, 20], [-28, 6]].map(([a, b]) => ring(a, b, 7, `fill="${C.choc}"`)).join("") +
    `</g></g></g>` +
    `<g id="crumbs">${[0, 1, 2, 3, 4].map((k) => `<rect id="cr${k}" width="12" height="12" rx="3" fill="${C.dough}" ${S(3)} opacity="0"/>`).join("")}</g>` +
    `<g id="sakar">${layer("sakar")}${stickers()}${lid("lidS1", 19664, 6888, 14)}${lid("lidS2", 19749, 6888, 14)}</g>` +
    `<g id="asosyal">${layer("asosyal")}${headphones()}</g>` +
    `<g id="notes">${[0, 1, 2, 3, 4, 5].map(note).join("")}</g>` +
    pole() + cat() +
    `</g>`;
}

// ── screen-space parts ────────────────────────────────────────────────────
function header() {
  return `<g id="header"><rect x="0" y="-10" width="${W}" height="372" fill="#fff"/>` +
    `<g id="h1" transform="translate(540 186)"><text x="0" y="0" text-anchor="middle" font-size="86" font-weight="700" fill="${C.navy}">You’re Invited</text></g>` +
    `<g id="h2"><text x="540" y="262" text-anchor="middle" font-size="36" font-weight="600" fill="${C.navy}">Cologne · 27–30 October 2026</text>` +
    `<text x="540" y="312" text-anchor="middle" font-size="36" font-weight="600" fill="${C.navy}">Hall 8.1 · Stand A30–B31</text></g></g>`;
}
const MAP = { x0: 120, x1: 960, y: 1772 };
const stopX = (i) => MAP.x0 + (i * (MAP.x1 - MAP.x0)) / 4;
function hud() {
  let s = `<g id="hud"><rect x="0" y="1622" width="${W}" height="320" fill="#000"/>`;
  s += `<text x="${MAP.x0 - 24}" y="1690" font-size="24" font-weight="600" fill="#fff" opacity=".6" letter-spacing="3">NEXT STATION</text>`;
  s += `<g id="nextWrap"><clipPath id="nextclip"><rect x="380" y="1650" width="640" height="56"/></clipPath><g clip-path="url(#nextclip)">` +
    STATIONS.slice(1).map((st, i) => `<text id="nx${i}" x="${W - MAP.x0 + 24}" y="1693" text-anchor="end" font-size="38" font-weight="700" fill="#fff" opacity="0">${st.name}</text>`).join("") + `</g></g>`;
  for (let i = 0; i < 4; i++) s += `<rect id="seg${i}" x="${stopX(i)}" y="${MAP.y - 9}" width="${stopX(i + 1) - stopX(i)}" height="18" fill="${STATIONS[i].color}"/>`;
  s += `<g id="train" transform="translate(${stopX(0)} ${MAP.y})" opacity="0"><rect x="-30" y="-17" width="60" height="34" rx="17" fill="#fff" stroke="#000" stroke-width="4"/>` +
    `<rect x="-17" y="-8" width="13" height="11" rx="3" fill="#000"/><rect x="3" y="-8" width="13" height="11" rx="3" fill="#000"/></g>`;
  for (let i = 0; i < 5; i++) {
    const last = i === 4;
    s += `<g id="stop${i}" transform="translate(${stopX(i)} ${MAP.y}) scale(0)">` +
      (last ? `<circle id="pulse" r="30" fill="none" stroke="#fff" stroke-width="5" opacity="0"/><circle r="22" fill="#fff"/>${motif(30, "#000")}`
            : `<circle r="17" fill="#000" stroke="${STATIONS[i].color}" stroke-width="7"/><circle id="dot${i}" r="8" fill="${STATIONS[i].color}" opacity="0"/>`) + `</g>`;
    const ls = STATIONS[i].lines;
    s += `<text id="lab${i}" x="${stopX(i)}" y="${MAP.y + 56}" text-anchor="middle" font-size="${last ? 25 : 21}" font-weight="${last ? 700 : 600}" fill="#fff" letter-spacing="1.5" opacity="0">` +
      ls.map((l, k) => `<tspan x="${stopX(i)}" dy="${k ? 26 : 0}">${l}</tspan>`).join("") + `</text>`;
  }
  return s + `</g>`;
}

// ── end card: the stand ───────────────────────────────────────────────────
const BAY = { x0: 48, w: 234, gap: 16, signY: 286, awnY: 392, awnH: 104, shelfY: 512, shelfH: 330 };
const bayX = (i) => BAY.x0 + i * (BAY.w + BAY.gap);
function awningShape(i) {
  const x = bayX(i), y = BAY.awnY, w = BAY.w, h = BAY.awnH, n = 5, sw = w / n;
  let stripes = "";
  for (let k = 0; k < n; k++) stripes += `<rect x="${f(x + k * sw)}" y="${y}" width="${f(sw)}" height="${h}" fill="${k % 2 ? "#fff" : STATIONS[i].color}"/>`;
  let sc = `M${x},${y + h}`;
  for (let k = 0; k < n; k++) sc += ` a${f(sw / 2)},${f(sw / 2.4)} 0 0 0 ${f(sw)},0`;
  let scal = "";
  for (let k = 0; k < n; k++) scal += `<path d="M${f(x + k * sw)},${y + h - 1} a${f(sw / 2)},${f(sw / 2.4)} 0 0 0 ${f(sw)},0 Z" fill="${k % 2 ? "#fff" : STATIONS[i].color}"/>`;
  return { stripes, scal, outline: `<path d="M${x},${y} H${x + w} V${y + h} ${sc.slice(sc.indexOf(" "))} " fill="none" ${S(4)}/>` };
}
// shelf goods, drawn in the original end card's flat style
function goods(i, shelf) {
  const L = S(3.5);
  const G = {
    "0a": // postcards fanned out
      `<g transform="rotate(-10)"><rect x="-70" y="-46" width="96" height="66" rx="5" fill="${C.teal}" ${L}/>${motif(52, "#fff", 'transform="translate(-22 -12)"')}</g>` +
      `<g transform="rotate(6)"><rect x="-20" y="-40" width="96" height="66" rx="5" fill="#fff" ${L}/><rect x="52" y="-34" width="18" height="22" fill="${C.salmon}" ${S(2.5)}/><path d="M-8,-12 h44 M-8,0 h50 M-8,12 h36" ${S(3)}/></g>`,
    "0b": // business cards, a charm and stickers
      `<g transform="translate(-48 6) rotate(-8)"><rect x="-38" y="-24" width="76" height="46" rx="4" fill="#fff" ${L}/><rect x="-34" y="-30" width="76" height="46" rx="4" fill="${C.navy}" ${L}/>${motif(44, "#fff", 'transform="translate(4 -7)"')}</g>` +
      `<g transform="translate(40 -6)"><circle cx="0" cy="-36" r="12" fill="none" ${S(4)}/><path d="M0,-24 v14" ${S(3)}/><circle cx="0" cy="8" r="22" fill="${C.gold}" ${L}/>${motif(26, C.navy, 'transform="translate(1 8)"')}</g>` +
      `<g transform="translate(66 34)"><circle r="18" fill="${C.rose}" ${L}/><path d="${star4(9)}" fill="#fff"/></g>`,
    "1a": // pizza slice and donut
      `<g transform="translate(-40 6)"><path d="M-46,-30 Q0,-52 46,-30 L0,46Z" fill="${C.dough}" ${L}/><path d="M-38,-22 Q0,-40 38,-22 L0,38Z" fill="${C.red}"/>${ring(-12, -16, 7, `fill="${C.plum}"`)}${ring(14, -12, 7, `fill="${C.plum}"`)}${ring(0, 10, 6, `fill="${C.plum}"`)}</g>` +
      `<g transform="translate(46 8)"><circle r="38" fill="${C.dough}" ${L}/><circle r="32" fill="${C.rose}"/><circle r="12" fill="${C.cream}" ${L}/>` +
      [[-16, -20, 20], [12, -24, -30], [22, 6, 60], [-24, 8, 10], [4, 22, 80]].map(([a, b, r]) => `<rect x="${a}" y="${b}" width="10" height="4" rx="2" fill="#fff" transform="rotate(${r} ${a} ${b})"/>`).join("") + `</g>`,
    "1b": // cookie and sandwich biscuit
      `<g transform="translate(-44 4)"><circle r="40" fill="${C.dough}" ${L}/>${[[-16, -14], [12, -20], [16, 12], [-8, 18], [-24, 4], [2, -2]].map(([a, b]) => ring(a, b, 5.5, `fill="${C.choc}"`)).join("")}</g>` +
      `<g transform="translate(46 6)"><rect x="-40" y="-30" width="80" height="20" rx="10" fill="${C.choc}" ${L}/><rect x="-36" y="-10" width="72" height="16" rx="8" fill="${C.cream}" ${L}/><rect x="-40" y="6" width="80" height="20" rx="10" fill="${C.choc}" ${L}/></g>`,
    "2a": // perfume bottles
      `<g transform="translate(-58 6)"><rect x="-22" y="-34" width="44" height="66" rx="10" fill="${C.salmon}" ${L}/><rect x="-10" y="-50" width="20" height="16" rx="3" fill="${C.ink}"/></g>` +
      `<g transform="translate(0 10)"><circle r="34" fill="${C.gold}" ${L}/><rect x="-9" y="-50" width="18" height="18" rx="3" fill="${C.ink}"/><path d="M-18,-12 Q-22,0 -16,12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></g>` +
      `<g transform="translate(58 4)"><path d="M-24,36 L-18,-26 H18 L24,36Z" fill="${C.plum}" ${L}/><rect x="-8" y="-44" width="16" height="18" rx="3" fill="${C.ink}"/></g>`,
    "2b": // scent strips in a jar, and a little scent cloud
      `<g transform="translate(-30 10)"><rect x="-34" y="-8" width="68" height="44" rx="8" fill="#fff" ${L}/>` +
      [-22, -8, 6, 20].map((a, k) => `<rect x="${a}" y="${-70 + k * 4}" width="9" height="${70 - k * 4}" rx="3" fill="${[C.salmon, C.gold, C.plum, C.teal][k]}" ${S(2.5)} transform="rotate(${-8 + k * 6} ${a} 0)"/>`).join("") + `</g>` +
      `<g transform="translate(58 -6)">${ring(-10, 6, 14, `fill="#fff" ${L}`)}${ring(8, -6, 18, `fill="#fff" ${L}`)}${ring(22, 10, 12, `fill="#fff" ${L}`)}<path d="M-24,-28 q8,-10 0,-20 M0,-34 q8,-10 0,-20" fill="none" ${S(3)}/></g>`,
    "3a": // bouquet in a vase
      `<g transform="translate(0 14)"><path d="M-26,40 L-20,-6 H20 L26,40Z" fill="${C.red}" ${L}/>` +
      [[-34, -64, C.salmon], [0, -84, C.rose], [32, -62, C.gold], [-12, -48, C.plum], [18, -40, C.salmon]].map(([a, b, col]) => `<path d="M0,-6 L${a},${b}" ${S(3)}/>` + [0, 72, 144, 216, 288].map((r) => `<ellipse cx="${a}" cy="${b - 9}" rx="7" ry="11" fill="${col}" ${S(2.5)} transform="rotate(${r} ${a} ${b})"/>`).join("") + ring(a, b, 5, `fill="${C.cream}" ${S(2)}`)).join("") + `</g>`,
    "3b": // potted flower and single stems
      `<g transform="translate(-40 12)"><path d="M-24,36 L-18,0 H18 L24,36Z" fill="${C.tan}" ${L}/><path d="M0,0 V-34" ${S(3)}/><path d="M0,-18 q-20,-6 -24,-22 q18,2 24,16Z" fill="${C.olive}" ${S(2.5)}/>` +
      [0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-48" rx="9" ry="14" fill="${C.rose}" ${S(2.5)} transform="rotate(${r} 0 -38)"/>`).join("") + ring(0, -38, 6, `fill="${C.gold}" ${S(2)}`) + `</g>` +
      `<g transform="translate(46 14)"><rect x="-22" y="-4" width="44" height="40" rx="6" fill="${C.teal}" ${L}/>` +
      [[-12, -60, C.gold], [4, -72, C.salmon], [16, -54, C.plum]].map(([a, b, col]) => `<path d="M0,-4 L${a},${b + 10}" ${S(3)}/><circle cx="${a}" cy="${b}" r="11" fill="${col}" ${S(2.5)}/>`).join("") + `</g>`,
  };
  return G[`${i}${shelf}`];
}
function endCard() {
  let s = `<g id="end" opacity="0">`;
  // back wall planks and the floor
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.beige}"/>`;
  for (let x = 90; x < W; x += 135) s += `<path d="M${x},0 V${BAY.signY - 20}" stroke="${C.beigeD}" stroke-width="3"/>`;
  const FY = 1372;
  s += `<rect x="0" y="${FY}" width="${W}" height="${H - FY}" fill="#e3d2b3"/>`;
  for (let k = -8; k <= 8; k++) s += `<path d="M${540 + k * 30},${FY} L${540 + k * 170},${H}" stroke="${C.beigeD}" stroke-width="3"/>`;
  s += `<path d="M0,${FY} H${W}" stroke="${C.ink}" stroke-width="4"/>`;
  s += `<g id="inv" opacity="0"><rect x="250" y="112" width="580" height="104" rx="52" fill="${C.beige}"/><text x="540" y="186" text-anchor="middle" font-size="68" font-weight="700" fill="${C.navy}">You’re Invited</text></g>`;
  // stalls
  s += `<g id="stalls">`;
  for (let i = 0; i < 4; i++) {
    const x = bayX(i);
    s += `<g id="bay${i}">`;
    s += `<rect x="${x}" y="${BAY.shelfY}" width="${BAY.w}" height="${BAY.shelfH}" fill="${C.cream}" ${S(4)}/>`;
    s += `<path d="M${x},${BAY.shelfY + BAY.shelfH / 2} H${x + BAY.w}" ${S(4)}/>`;
    for (const sh of ["a", "b"]) {
      const cy = BAY.shelfY + (sh === "a" ? BAY.shelfH * 0.27 : BAY.shelfH * 0.77);
      s += `<g id="gd${i}${sh}" data-cx="${x + BAY.w / 2}" data-cy="${cy}" transform="translate(${x + BAY.w / 2} ${cy}) scale(0)">${goods(i, sh)}</g>`;
    }
    s += `</g>`;
  }
  s += `<rect x="0" y="${BAY.shelfY + BAY.shelfH}" width="${W}" height="52" fill="${C.tan}" ${S(4)}/>`;
  s += `<rect x="0" y="${BAY.shelfY + BAY.shelfH + 52}" width="${W}" height="18" fill="#b8956a" ${S(4)}/>`;
  s += `</g>`;
  // signs (navy boards) appear as the route labels arrive
  for (let i = 0; i < 4; i++) {
    const x = bayX(i);
    s += `<g id="sign${i}" opacity="0"><rect x="${x + 4}" y="${BAY.signY}" width="${BAY.w - 8}" height="82" rx="14" fill="${C.navy}"/>` +
      STATIONS[i].lines.map((l, k) => `<text x="${x + BAY.w / 2}" y="${BAY.signY + 36 + k * 28}" text-anchor="middle" font-size="23" font-weight="700" fill="#fff" letter-spacing="2">${l}</text>`).join("") + `</g>`;
  }
  // rod over the awnings
  s += `<rect id="rod" x="${BAY.x0 - 6}" y="${BAY.awnY - 12}" width="${bayX(3) + BAY.w - BAY.x0 + 12}" height="14" rx="7" fill="${C.rod}" opacity="0"/>`;
  // text
  s += `<g id="t1" opacity="0"><text x="540" y="992" text-anchor="middle" font-size="50" font-weight="600" fill="${C.ink}">Marwood</text></g>`;
  s += `<g id="t2" opacity="0"><text x="540" y="1082" text-anchor="middle" font-size="74" font-weight="700" fill="${C.navy}">discover a place</text>` +
    `<text x="540" y="1164" text-anchor="middle" font-size="74" font-weight="700" fill="${C.navy}">you’ll love to work</text></g>`;
  s += `<g id="t3" opacity="0"><text x="540" y="1236" text-anchor="middle" font-size="36" font-weight="700" fill="${C.red}">ORGATEC · Hall 8.1 · Stand A30–B31</text></g>`;
  s += `<g id="t4" opacity="0"><text x="540" y="1294" text-anchor="middle" font-size="33" font-weight="600" fill="${C.ink}">27–30 October 2026, Cologne</text></g>`;
  // the cat by its Marwood bowl
  const a = ASSETS.cat_sit, [vx, vy, vw, vh] = a.vb, cs = 0.62;
  s += `<g id="endcat" opacity="0" transform="translate(0 0)"><g transform="translate(${f(230 - (vx + vw / 2) * cs)} ${f(1770 - (vy + vh) * cs)}) scale(${cs})">${a.body}${lid("lidE", 3474.3, 12736.6, 16)}</g>` +
    `<g transform="translate(420 1742)"><path d="M-78,-26 L-62,28 Q0,40 62,28 L78,-26Z" fill="#fff" ${S(5)}/><ellipse cx="0" cy="-26" rx="78" ry="16" fill="${C.brown}" ${S(5)}/>` +
    `<text x="0" y="14" text-anchor="middle" font-size="22" font-weight="700" fill="${C.ink}">Marwood</text></g></g>`;
  return s + `</g>`;
}
// moving pieces of the morph: one per line segment, from map to awning
function morph() {
  let s = `<g id="morph" opacity="0">`;
  for (let i = 0; i < 4; i++) {
    const aw = awningShape(i);
    s += `<g id="mo${i}"><rect id="mob${i}" fill="${STATIONS[i].color}"/><path id="msc${i}" fill="${STATIONS[i].color}"/>` +
      `<g id="mos${i}" opacity="0">${aw.stripes}${aw.scal}${aw.outline}</g></g>`;
  }
  return s + `</g>`;
}

// ── assemble ──────────────────────────────────────────────────────────────
const stage = document.getElementById("stage");
stage.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="#fff"/>` +
  world() + header() + hud() +
  `<g id="wipe"><clipPath id="wipeclip"><rect id="wiperect" x="0" y="${H}" width="${W}" height="${H}"/></clipPath>` +
  `<g clip-path="url(#wipeclip)">${endCard().replace('id="end" opacity="0"', 'id="end"')}</g></g>` +
  morph() + `</svg>`;
const $ = (id) => document.getElementById(id);
const set = (id, attrs) => { const el = typeof id === "string" ? $(id) : id; for (const k in attrs) el.setAttribute(k, attrs[k]); };

// ── timeline ──────────────────────────────────────────────────────────────
const T = {
  spritz: 0.25, wink: 0.95, zoom: [0.7, 1.75], header: [1.0, 1.55], hud: [1.25, 1.7], line: [1.45, 2.3],
  pan: [1.75, 9.15], stops: [2.2, 3.15, 4.1, 5.05, 10.3], bite: 2.55, bloom: 3.05, plate: 5.0, stick: [6.15, 6.4, 6.65],
  paw: [9.0, 9.45], press: 9.45, brake: [9.75, 10.5], morph: [10.55, 12.0], end: 11.95,
};
// camera: close on Narsist, pull back, then glide along the car
function camera(t) {
  const z = eio(prog(t, ...T.zoom));
  const s0 = Math.exp(lerp(Math.log(1.22), Math.log(1.05), eo(prog(t, 0, 0.55))));
  const punch = 0.035 * Math.sin(Math.PI * prog(t, T.spritz, T.spritz + 0.35));
  const s = Math.exp(lerp(Math.log(s0 + punch), Math.log(0.42), z));
  let cx = lerp(13150, 13700, z), cy = lerp(7180, 7261, z);
  const p = prog(t, ...T.pan);
  cx += (21960 - 13700) * (p < 1 ? sine(p) : 1);
  // push in on the cat and the STOP button
  const z2 = eio(prog(t, 8.7, 9.35));
  const sOut = Math.exp(lerp(Math.log(s), Math.log(0.6), z2));
  cx = lerp(cx, 22030, z2); cy = lerp(cy, 7380, z2);
  // brake jolt
  const b = prog(t, T.brake[0], T.brake[0] + 0.9);
  if (b > 0 && b < 1) cx += Math.sin(b * Math.PI * 3) * 26 * (1 - b);
  return { s: sOut, cx, cy };
}
// train speed (fraction of full) and distance travelled, for the window view
const speed = (t) => (t < T.brake[0] ? 1 : 1 - eo(prog(t, ...T.brake)));
function travelled(t) {
  const v = 2300; // world units per second at full speed
  if (t < T.brake[0]) return v * t;
  const d = T.brake[1] - T.brake[0], u = prog(t, ...T.brake);
  // ∫(1 − eo(u)) du = u − ∫eo = u − (u − (1−(1−u)^4)/4 ... ) → closed form of 1−(1−(1−u)^3)
  const integ = (1 - Math.pow(1 - u, 4)) / 4; // ∫0^u (1−u')^3 du'
  return v * T.brake[0] + v * d * integ;
}

function seek(t) {
  // world
  const cam = camera(t);
  set("world", { transform: `translate(${f(540 - cam.cx * cam.s)} ${f(960 - cam.cy * cam.s)}) scale(${cam.s.toFixed(5)})` });
  const dist = travelled(t);
  PANES.forEach((p, i) => {
    set(`far${i}`, { transform: `translate(${f(-((dist * 0.35) % PERIOD))} 0)` });
    set(`near${i}`, { transform: `translate(${f(-((dist * 1.25) % PERIOD))} 0)` });
  });

  // Narsist: lifts the bottle, spritzes, winks
  const lift = eo(prog(t, 0.05, T.spritz)) * (1 - eio(prog(t, 1.3, 1.8)));
  set("bottle", { transform: `translate(0 ${f(-46 * lift)}) rotate(${f(-8 * lift)} ${BOTTLE.x} ${BOTTLE.y + 100})` });
  SPRAY.forEach((o, k) => {
    const p = prog(t, T.spritz + o.dl, T.spritz + o.dl + 0.75);
    const e = eo(p), d = o.d * e;
    set(`sd${k}`, { cx: f(NOZZLE[0] + Math.cos(o.a) * d), cy: f(NOZZLE[1] + Math.sin(o.a) * d - 50 * p), opacity: p > 0 && p < 1 ? f(1 - p * p) : 0, transform: "" });
  });
  [0, 1].forEach((k) => {
    const dr = eio(prog(t, T.spritz + 0.25 + k * 0.08, T.spritz + 0.85 + k * 0.08));
    const fade = 1 - eo(prog(t, 0.95, 1.3));
    set(`tr${k}`, { "stroke-dashoffset": f(1 - dr), opacity: f(fade) });
  });
  [0, 1, 2, 3, 4].forEach((i) => {
    const sp = prog(t, T.spritz + 0.1 + i * 0.08, T.spritz + 1.3 + i * 0.08);
    const sc = sp <= 0 || sp >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, sp * 1.4)) * (1 + 0.1 * Math.sin(t * 20));
    const el = $(`spk${i}`), tr = el.getAttribute("transform").replace(/scale\([^)]*\)/, `scale(${f(Math.max(0, sc))})`);
    el.setAttribute("transform", tr.replace(/rotate\([^)]*\)/, "") + ` rotate(${f(t * 90)})`);
  });
  const wink = prog(t, T.wink, T.wink + 0.32);
  set("lidN", { opacity: wink > 0 && wink < 1 ? 1 : 0 });

  // Aktivist's plant blooms
  BLOSSOMS.forEach(([x, y], i) => {
    const b = spring(t - T.bloom - i * 0.11, 9, 0.35);
    const sway = Math.sin(t * 2.2 + i) * 4;
    set(`bl${i}`, { transform: `translate(${x} ${y}) rotate(${f(sway + (1 - Math.min(1, b)) * -60)}) scale(${f(Math.max(0, b))})` });
  });

  // Kafein's plate
  const pl = spring(t - T.plate, 9, 0.4);
  set("plate", { transform: `translate(18205 7604) scale(${f(Math.max(0, pl))})` });

  // ADHD sways on her strap; bites the cookie, crumbs fall
  const brakeKick = t > T.brake[0] ? -7 * Math.exp(-(t - T.brake[0]) * 2.4) * Math.sin((t - T.brake[0]) * 7) : 0;
  set("adhd", { transform: `rotate(${f(1.8 * Math.sin(t * 2.4) + brakeKick)} 14700 6640)` });
  const blinkA = [2.9, 6.2].some((b) => t > b && t < b + 0.14);
  set("lidA1", { opacity: blinkA ? 1 : 0 }); set("lidA2", { opacity: blinkA ? 1 : 0 });
  const bt = prog(t, T.bite, T.bite + 0.15);
  set("bite", { opacity: bt >= 1 ? 1 : 0 });
  const ck = Math.max(0, Math.sin(prog(t, T.bite - 0.25, T.bite + 0.1) * Math.PI));
  set("cookie", { transform: `translate(${f(14156 + 40 * ck)} ${f(7612 - 150 * ck)})` });
  [0, 1, 2, 3, 4].forEach((k) => {
    const c = prog(t, T.bite + 0.05 + k * 0.03, T.bite + 1.0 + k * 0.05);
    const x = 14200 + (k - 2) * 30 + c * (k - 2) * 40, y = 7450 + c * c * 560 + k * 10;
    set(`cr${k}`, { x: f(x), y: f(y), opacity: c > 0 && c < 1 ? 1 : 0, transform: `rotate(${f(c * 300 + k * 40)} ${f(x + 6)} ${f(y + 6)})` });
  });

  // Sakar: stickers slap onto her laptop
  T.stick.forEach((ts, k) => {
    const el = $(`st${k}`), x = +el.dataset.x, y = +el.dataset.y, r = +el.dataset.r;
    const p = prog(t, ts, ts + 0.28), sc = p <= 0 ? 0 : lerp(1.9, 1, eo(p));
    set(el, { opacity: p > 0 ? 1 : 0, transform: `translate(${x} ${y}) rotate(${f(r + (1 - eo(p)) * 25)}) scale(${f(sc)})` });
  });
  const blinkS = [5.4, 7.3].some((b) => t > b && t < b + 0.14);
  set("lidS1", { opacity: blinkS ? 1 : 0 }); set("lidS2", { opacity: blinkS ? 1 : 0 });

  // Asosyal nods to her music; notes drift up
  const nod = Math.max(0, Math.sin(t * Math.PI * 2 * 1.1)) * 6;
  const lean = t > T.brake[0] ? -3 * Math.exp(-(t - T.brake[0]) * 3) * Math.sin((t - T.brake[0]) * 8) : 0;
  set("asosyal", { transform: `translate(0 ${f(nod)}) rotate(${f(lean)} 20600 8300)` });
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    const per = 2.4, ph = ((t - 5.6 - i * 0.4) % per + per) % per, u = ph / per;
    const on = t > 5.6 + i * 0.4;
    const side = i % 2 ? 1 : -1;
    const x = (side > 0 ? 20820 : 20410) + side * (40 + 150 * u) + Math.sin(u * 6 + i) * 22, y = 6930 - u * 420;
    set(`nt${i}`, { opacity: on ? f(Math.sin(u * Math.PI)) : 0, transform: `translate(${f(x)} ${f(y)}) rotate(${f(Math.sin(u * 5 + i) * 14)}) scale(${f(0.8 + 0.4 * Math.sin(u * Math.PI))})` });
  });

  // the cat presses STOP
  const pw = eio(prog(t, ...T.paw)) * (1 - eio(prog(t, T.press + 0.35, T.press + 0.75)));
  set("paw", { opacity: f(clamp(pw * 4)), transform: `translate(${CAT.x + 70} ${CAT.y - 240}) rotate(${f(lerp(55, -31, pw))})` });
  const pressed = t >= T.press;
  set("btn", { fill: pressed ? C.red : "#fff" });
  set("rings", { opacity: pressed ? 1 : 0 });
  [0, 1, 2].forEach((k) => {
    const r = prog(t, T.press + k * 0.18, T.press + 0.9 + k * 0.18);
    set(`rg${k}`, { r: f(40 + 140 * eo(r)), opacity: r > 0 && r < 1 ? f(1 - r) : 0 });
  });

  set("lidC", { opacity: [8.1, 8.3].some((b) => t > b && t < b + 0.12) ? 1 : 0 });
  set("lidE", { opacity: [13.3, 14.4].some((b) => t > b && t < b + 0.13) ? 1 : 0 });
  // header
  const hd = prog(t, ...T.header);
  set("header", { transform: `translate(0 ${f(-380 * (1 - eo(hd)))})` });
  const h1 = spring(t - T.header[0] - 0.15, 8, 0.38);
  set("h1", { transform: `translate(540 186) scale(${f(Math.max(0.001, h1))})` });
  const h2 = eo(prog(t, T.header[0] + 0.3, T.header[0] + 0.8));
  set("h2", { opacity: f(h2), transform: `translate(0 ${f(20 * (1 - h2))})` });

  // route map
  const hu = eo(prog(t, ...T.hud));
  set("hud", { transform: `translate(0 ${f(330 * (1 - hu))})` });
  const ln = eio(prog(t, ...T.line));
  for (let i = 0; i < 4; i++) {
    const a = clamp(ln * 4 - i);
    set(`seg${i}`, { width: f((stopX(i + 1) - stopX(i)) * a) });
  }
  for (let i = 0; i < 5; i++) {
    const p = spring(t - T.line[0] - i * 0.17, 10, 0.4);
    const bump = i === 4 ? 0.35 * Math.max(0, Math.sin(prog(t, T.stops[4] - 0.05, T.stops[4] + 0.45) * Math.PI)) : 0;
    set(`stop${i}`, { transform: `translate(${stopX(i)} ${MAP.y}) scale(${f(Math.max(0, p) * (i === 4 ? 1.25 + bump : 1))})` });
    set(`lab${i}`, { opacity: f(eo(prog(t, T.line[0] + 0.3 + i * 0.12, T.line[0] + 0.7 + i * 0.12))) });
  }
  // train marker between stops
  const st = T.stops;
  let pos = 0;
  if (t >= st[0]) {
    for (let i = 0; i < 4; i++) {
      if (t < st[i + 1]) { const u = prog(t, st[i], st[i + 1]); pos = i + (i === 3 ? 1 - Math.pow(1 - u, 1.6) : eio(u)); break; }
      pos = 4;
    }
  }
  const tx = lerp(stopX(Math.floor(pos)), stopX(Math.min(4, Math.floor(pos) + 1)), pos - Math.floor(pos));
  set("train", { transform: `translate(${f(pos >= 4 ? stopX(4) : tx)} ${MAP.y})`, opacity: f(eo(prog(t, T.line[1] - 0.2, T.line[1] + 0.2)) * (1 - eo(prog(t, st[4] - 0.15, st[4] + 0.1)))) });
  for (let i = 0; i < 4; i++) set(`dot${i}`, { opacity: pos >= i ? 1 : 0 });
  // "next station" label slides between names
  const nextIdx = Math.min(3, Math.floor(pos));
  for (let i = 0; i < 4; i++) {
    const el = $(`nx${i}`);
    const enter = i === 0 ? T.line[1] : st[i];
    const leave = i === 3 ? 99 : st[i + 1];
    const a = eo(prog(t, enter, enter + 0.35)), b = eo(prog(t, leave, leave + 0.35));
    set(el, { opacity: f(a * (1 - b)), transform: `translate(0 ${f(40 * (1 - a) - 40 * b)})` });
  }
  const arrived = t >= st[4];
  const pu = prog(t, st[4] - 0.6, st[4] + 0.8);
  set("pulse", { opacity: pu > 0 && pu < 1 ? f(Math.sin(pu * Math.PI)) : 0, r: f(24 + 12 * pu) });
  void arrived; void nextIdx;

  // morph: the line segments lift off the map to the top of the screen, drop
  // like four shop shutters, and roll back up into the awnings of the stand
  const m0 = T.morph[0];
  set("morph", { opacity: t >= m0 ? 1 : 0 });
  for (let i = 0; i < 4; i++) {
    const d = i * 0.05;
    const uA = eio(prog(t, m0 + d, m0 + 0.32 + d));
    const uB = eo(prog(t, m0 + 0.34 + d, m0 + 0.7 + d));
    const uC = eio(prog(t, m0 + 0.98 + d, m0 + 1.4 + d));
    const a0 = [stopX(i), MAP.y - 9, stopX(i + 1) - stopX(i), 18];
    const a1 = [i * 270 - 1, -12, 272, 52], a2 = [i * 270 - 1, -12, 272, H + 24], a3 = [bayX(i), BAY.awnY, BAY.w, BAY.awnH];
    const r = a0.map((v, k) => uC > 0 ? lerp(a2[k], a3[k], uC) : uB > 0 ? lerp(a1[k], a2[k], uB) : lerp(v, a1[k], uA));
    set(`mob${i}`, { x: f(r[0]), y: f(r[1]), width: f(r[2]), height: f(r[3]) });
    // scalloped hem under each shutter
    const sw = r[2] / 5, sh = Math.min(sw / 2.4, r[3] * 0.6);
    let hem = `M${f(r[0])},${f(r[1] + r[3] - 1)}`;
    for (let k = 0; k < 5; k++) hem += ` a${f(sw / 2)},${f(sh)} 0 0 0 ${f(sw)},0`;
    set(`msc${i}`, { d: hem + " Z", opacity: uA > 0.6 ? 1 : 0 });
    set(`mos${i}`, { opacity: f(eo(prog(t, m0 + 1.34 + d, m0 + 1.48 + d))) });
  }
  set("wiperect", { y: t >= m0 + 0.9 ? 0 : H });
  for (let i = 0; i < 4; i++) set(`sign${i}`, { opacity: f(eo(prog(t, m0 + 1.25 + i * 0.05, m0 + 1.5 + i * 0.05))) });
  set("rod", { opacity: f(eo(prog(t, m0 + 1.15, m0 + 1.4))) });
  const iv = eo(prog(t, m0 + 1.3, m0 + 1.7));
  set("inv", { opacity: f(iv), transform: `translate(0 ${f(-30 * (1 - iv))})` });

  // end card build
  for (let i = 0; i < 4; i++) for (const [k, sh] of [[0, "a"], [1, "b"]]) {
    const el = $(`gd${i}${sh}`), p = spring(t - T.end - 0.15 - i * 0.12 - k * 0.07, 10, 0.38);
    set(el, { transform: `translate(${el.dataset.cx} ${el.dataset.cy}) scale(${f(Math.max(0, p) * 1.16)})` });
  }
  [["t1", 0.45], ["t2", 0.6], ["t3", 0.85], ["t4", 1.0]].forEach(([id, d]) => {
    const p = eo(prog(t, T.end + d, T.end + d + 0.45));
    set(id, { opacity: f(p), transform: `translate(0 ${f(36 * (1 - p))})` });
  });
  const ec = spring(t - T.end - 1.05, 9, 0.4);
  set("endcat", { opacity: ec > 0 ? 1 : 0, transform: `translate(0 ${f(120 * (1 - Math.min(1, Math.max(0, ec))))})` });
}

await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px M`)));
await document.fonts.ready;
seek(0);
window.scene = { duration: DURATION, seek };
document.body.dataset.ready = "1";
