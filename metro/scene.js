// Marwood ORGATEC invitation — "the Marwood line" (Instagram Reels, 18 s).
// We ride Zeynep's metro car; the camera stops at each character while they
// show something from one corner of the stand, and that corner lights up on
// the line map. The cat presses STOP, the train pulls into Marwood station and
// the camera pushes through the window onto the station wall: the end card.
// Layout keeps text inside the Reels safe area (top 14 % and bottom 35 % are
// covered by the app's own interface).
// Everything is a pure function of time: window.scene.seek(t) draws frame t.
import { ASSETS } from "./assets.js";

const W = 1080, H = 1920, DURATION = 18;
const C = {
  navy: "#0f233d", ink: "#1b1b1b", beige: "#e9dcc5",
  cream: "#fbf6ea", tan: "#d0b088",
  teal: "#3b8a84", pink: "#e3a8a1", gold: "#d0a23a", olive: "#7d7a33", red: "#b04828",
  salmon: "#f67f62", rose: "#f574a6", plum: "#621744", brown: "#852f24",
  dough: "#d9a35b", choc: "#4a2a1a", tile: "#f6f4ee", grout: "#dcd8cc",
};
// the line runs from Marwood to ORGATEC; the stand's corners in between come
// in ride order, each announced as its character shows it
const ORG_RED = "#e60003";
const STATIONS = [
  { name: "Marwood", lines: ["MARWOOD"], color: "#fff" },
  { name: "Palette Lab", lines: ["PALETTE", "LAB"], color: C.gold },
  { name: "Layer Bakery", lines: ["LAYER", "BAKERY"], color: C.pink },
  { name: "Bloom Atelier", lines: ["BLOOM", "ATELIER"], color: C.olive },
  { name: "Souvenir Shop", lines: ["SOUVENIR", "SHOP"], color: C.teal },
  { name: "ORGATEC", lines: ["ORGATEC"], color: ORG_RED },
];
const LAST = STATIONS.length - 1;
// LED passenger display colours (the orange "Marwood" sign everyone liked)
const LED = "#f8b44c", LED_DOT = "#fc683c";

// ── easing & helpers ──────────────────────────────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t) => 1 - Math.pow(1 - t, 3);
// a damped spring settling at 1 (for pops)
const spring = (t, k = 7, z = 0.32) => (t <= 0 ? 0 : 1 - Math.exp(-z * k * t) * Math.cos(k * t * Math.sqrt(1 - z * z)));
const pulse = (t, a, d) => { const u = prog(t, a, a + d); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0; };
const f = (n) => +n.toFixed(2);
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ── svg builders ──────────────────────────────────────────────────────────
const S = (w = 7) => `stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const ring = (cx, cy, r, attrs) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
const star4 = (r) => { const k = r * 0.22; return `M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r}Z`; };
// eyelids: a white disc and a closed-eye stroke laid over an open eye
function lid(id, cx, cy, r, sw = 6) {
  return `<g id="${id}" opacity="0"><circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#fff"/>` +
    `<path d="M${cx - r - 3},${cy + 2} Q${cx},${cy + r} ${cx + r + 3},${cy + 2}" fill="none" ${S(sw)}/></g>`;
}
// a tapered limb from a (round cap) to b (round cap), white with ink outline
function limbPath(a, b, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const t0 = Math.atan2(ny, nx), cap = (c, w, from) => {
    const p = [];
    for (let i = 0; i <= 10; i++) { const t = from + (i / 10) * Math.PI; p.push(`${f(c[0] + Math.cos(t) * w)},${f(c[1] + Math.sin(t) * w)}`); }
    return p;
  };
  const pts = [`${f(b[0] + nx * w1)},${f(b[1] + ny * w1)}`, `${f(a[0] + nx * w0)},${f(a[1] + ny * w0)}`, ...cap(a, w0, t0),
    `${f(b[0] - nx * w1)},${f(b[1] - ny * w1)}`, ...cap(b, w1, t0 + Math.PI)];
  return `M${pts.join(" L")}Z`;
}

// ── world: Zeynep's metro, in the source file's coordinates ───────────────
const PANES = [
  { x0: 14105, x1: 15590, y0: 6855, y1: 7250, clip: [[14105, 6855], [15405, 6855], [15405, 7108], [14786, 7108], [14786, 7250], [14105, 7250]] },
  { x0: 18472, x1: 19957, y0: 6857, y1: 7251 },
  { x0: 20270, x1: 21755, y0: 6857, y1: 7251 },
];
const PERIOD = 1700;
function cityStrip(pane, layer) {
  // a strip of night city in white line art, two periods long
  let s = "";
  const base = pane.y1 + 6, x0 = pane.x0;
  if (layer === "far") {
    for (let rep = 0; rep < 2; rep++) {
      let x = x0 + rep * PERIOD;
      seed = 7;
      while (x < x0 + (rep + 1) * PERIOD - 40) {
        const w = 90 + rnd() * 150, h = 90 + rnd() * 230, top = base - h, roof = rnd();
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
        s += `<path d="M${x},${base} V${base - 300} q0,-40 40,-40 h40" fill="none" stroke="#fff" stroke-width="7"/><ellipse cx="${x + 92}" cy="${base - 334}" rx="22" ry="9" fill="#fff"/>`;
      }
      s += `<path d="M${ox},${base - 70} H${ox + PERIOD}" stroke="#fff" stroke-width="5"/>`;
      for (let x = ox; x < ox + PERIOD; x += 85) s += `<path d="M${x},${base - 70} V${base}" stroke="#fff" stroke-width="5"/>`;
    }
  }
  return s;
}
function windowView(pane, i, extra = "") {
  const clip = pane.clip || [[pane.x0, pane.y0], [pane.x1, pane.y0], [pane.x1, pane.y1], [pane.x0, pane.y1]];
  const moonX = pane.x1 - 200, moonY = pane.y0 + 110;
  let stars = "";
  seed = 31 + i;
  for (let k = 0; k < 9; k++) stars += ring(pane.x0 + 60 + rnd() * (pane.x1 - pane.x0 - 120), pane.y0 + 30 + rnd() * 120, 4 + rnd() * 3, `fill="#fff"`);
  return `<clipPath id="pane${i}"><polygon points="${clip.map((p) => p.join(",")).join(" ")}"/></clipPath>` +
    `<g clip-path="url(#pane${i})"><g>${stars}<path d="M${moonX + 40},${moonY - 46} a52,52 0 1,0 0,92 a40,40 0 1,1 0,-92Z" fill="#fff"/></g>` +
    `<g id="far${i}">${cityStrip(pane, "far")}</g><g id="near${i}">${cityStrip(pane, "near")}</g>${extra}</g>`;
}

// Narsist: his right arm is redrawn raised, holding a perfume bottle up to
// his neck (Palette Lab); the sleeve cuff goes over the upper arm
// Zeynep's own gripping hand (from Kafein's cup), mirrored and turned so the
// bottle stands nearly upright; the forearm runs across his chest to the
// elbow at the sleeve, as in her original folded-arms pose
const GRIP = { Wk: [18660, 7458], k: 1.05, rot: -22 };
const NARM = { E: [13338, 7306] };          // elbow, hidden inside the sleeve hem
const gripW = [13195.8, 7292.1];             // wrist
// hand frame (Kafein's drawing coordinates) → world
const gripM = (() => {
  const r = GRIP.rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), k = GRIP.k;
  // translate(W) · rotate(r) · scale(-k, k) · translate(-Wk)
  const a = -k * c, b = -k * sn, cc = -k * sn, d = k * c;
  return [a, b, cc, d, gripW[0] - (a * GRIP.Wk[0] + cc * GRIP.Wk[1]), gripW[1] - (b * GRIP.Wk[0] + d * GRIP.Wk[1])];
})();
const gripPt = ([x, y]) => [gripM[0] * x + gripM[2] * y + gripM[4], gripM[1] * x + gripM[3] * y + gripM[5]];
// the bottle sits in the grip where her cup was, its axis along the cup's
const BOTTLE_K = { c: [18786, 7372], rot: -44 };
const bottlePt = ([x, y]) => { // bottle frame → Kafein frame → world
  const r = BOTTLE_K.rot * Math.PI / 180;
  return gripPt([BOTTLE_K.c[0] + x * Math.cos(r) - y * Math.sin(r), BOTTLE_K.c[1] + x * Math.sin(r) + y * Math.cos(r)]);
};
function perfume() {
  // a classic flacon in its own upright frame, centred on the body
  const bottle = `<g transform="translate(${BOTTLE_K.c[0]} ${BOTTLE_K.c[1]}) rotate(${BOTTLE_K.rot})"><g id="bottle">` +
    `<rect x="-56" y="-150" width="112" height="176" rx="24" fill="#fff" ${S(6.5)}/>` +
    `<rect x="-44" y="-126" width="88" height="84" rx="14" fill="${C.gold}"/>` +
    `<path d="M-32,-132 V-60" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".9"/>` +
    `<path d="${star4(15)}" transform="translate(6 -84)" fill="${C.navy}"/>` +
    `<rect x="-16" y="-170" width="32" height="22" rx="4" fill="#fff" ${S(6)}/>` +
    `<g id="cap"><rect x="-23" y="-208" width="46" height="40" rx="8" fill="${C.ink}"/>` +
    `<rect x="-42" y="-200" width="21" height="12" rx="3" fill="${C.ink}"/></g></g></g>`;
  const palm = `<polygon points="18668,7432 18700,7392 18745,7338 18790,7322 18802,7398 18762,7442 18700,7470 18648,7484" fill="#fff"/>`;
  return `<g id="narm"><path d="${limbPath(NARM.E, gripW, 27, 29)}" fill="#fff" ${S(6)}/>` +
    `<g transform="matrix(${gripM.map((v) => +v.toFixed(5)).join(" ")})">${bottle}${palm}<clipPath id="gripclip"><polygon points="18600,7280 18900,7280 18900,7540 18684,7540 18684,7464 18600,7464"/></clipPath><g id="L_grip" clip-path="url(#gripclip)">${ASSETS.grip_hand.body}</g></g>` +
    `<g id="L_narsist_cuff">${ASSETS.narsist_cuff.body}</g></g>`;
}
// the spray: a fine mist from the nozzle across to his neck, then the scent
// trails up around his face
const NOZZLE = bottlePt([-44, -194]);
const NECK = [13175, 7030];
const SPRAY = (() => {
  seed = 5;
  return Array.from({ length: 26 }, (_, k) => {
    const a = Math.atan2(NECK[1] - NOZZLE[1], NECK[0] - NOZZLE[0]) + (rnd() - 0.5) * 0.6;
    return { a, d: 40 + rnd() * Math.hypot(NECK[0] - NOZZLE[0], NECK[1] - NOZZLE[1]), r: 3 + rnd() * 5, c: [C.gold, C.salmon, C.rose][k % 3], dl: rnd() * 0.12 };
  });
})();
function spritz() {
  let s = `<g id="mist" opacity="0">${[[13250, 6990, 46], [13212, 7010, 38], [13285, 6972, 30]].map(([x, y, r]) => ring(x, y, r, `fill="${C.gold}" opacity=".22"`)).join("")}</g>`;
  s += `<g id="spray">${SPRAY.map((o, k) => `<circle id="sd${k}" r="${f(o.r)}" fill="${o.c}" opacity="0"/>`).join("")}</g>`;
  const trails = [
    "M13140,7010 C13030,6990 12985,6890 12998,6800 S13052,6662 12992,6596",
    "M13230,6990 C13320,6955 13350,6875 13345,6795 S13300,6676 13352,6606",
  ];
  s += `<g id="trails">${trails.map((d, k) => `<path id="tr${k}" d="${d}" pathLength="1" fill="none" stroke="${k ? C.salmon : C.gold}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("")}</g>`;
  const SP = [[12930, 6700, 58, C.gold], [13470, 6700, 50, C.salmon], [13560, 6930, 38, C.gold], [12900, 6930, 42, C.salmon], [13200, 6560, 34, C.gold]];
  s += `<g id="sparkles">${SP.map(([sx, sy, r, col], i) => `<path id="spk${i}" data-x="${sx}" data-y="${sy}" d="${star4(r)}" transform="scale(0)" fill="${col}" ${S(5)}/>`).join("")}</g>`;
  return s;
}

// ADHD: her hanging arm is replaced by a two-bone arm that lifts a cookie to
// her mouth (Layer Bakery); the sleeve cuff is redrawn over the shoulder
// elbow and hand keyframes; with the elbow forward the upper arm is foreshortened
const ARM = { S: [14180, 7362], E0: [14168, 7540], H0: [14178, 7762], E1: [14238, 7408], H1: [14302, 7160] };
const MOUTH = { x: 14392, y: 7051 };
function adhdArm() {
  const cookie = `<mask id="bitemask" maskUnits="userSpaceOnUse" x="-70" y="-70" width="140" height="140"><rect x="-70" y="-70" width="140" height="140" fill="#fff"/>` +
    `<g id="bite" opacity="0"><circle cx="44" cy="-26" r="22" fill="#000"/><circle cx="56" cy="2" r="18" fill="#000"/><circle cx="34" cy="-48" r="13" fill="#000"/></g></mask>` +
    `<g id="cookie"><g mask="url(#bitemask)"><circle r="54" fill="${C.dough}" ${S(6)}/>` +
    [[-22, -14], [10, -26], [16, 12], [-10, 22], [-30, 8], [2, -2]].map(([a, b]) => ring(a, b, 7, `fill="${C.choc}"`)).join("") + `</g></g>`;
  const hand = `<g id="hand"><path d="M-30,-14 C-30,-30 30,-30 32,-14 L34,18 C34,34 -30,34 -32,18 Z" fill="#fff" ${S(5)}/>` +
    `<path d="M-12,-26 V-6 M6,-26 V-6 M22,-24 V-6" fill="none" ${S(4)}/><path d="M-32,4 C-46,-2 -46,-22 -30,-22" fill="#fff" ${S(5)}/></g>`;
  // the cuff sits over the upper arm; the forearm passes in front of it
  // drawn as one shape: a thick outline pass under a fill pass, so the elbow has no seam
  return `<g fill="${C.ink}" stroke="${C.ink}" stroke-width="10" stroke-linejoin="round"><path id="upperO"/><path id="foreO"/></g>` +
    `<g fill="#fff"><path id="upper"/><path id="fore"/></g><g id="L_adhd_cuff">${ASSETS.adhd_cuff.body}</g>${cookie}${hand}`;
}
// two-bone IK, elbow on the outer (left) side
function ik(Sp, T, L1, L2) {
  let dx = T[0] - Sp[0], dy = T[1] - Sp[1], d = Math.hypot(dx, dy);
  d = Math.min(d, L1 + L2 - 1);
  const a = Math.atan2(dy, dx), cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), A = Math.acos(clamp(cosA, -1, 1));
  const e1 = [Sp[0] + Math.cos(a + A) * L1, Sp[1] + Math.sin(a + A) * L1], e2 = [Sp[0] + Math.cos(a - A) * L1, Sp[1] + Math.sin(a - A) * L1];
  const E = e1[0] < e2[0] ? e1 : e2;
  const ang = Math.atan2(T[1] - E[1], T[0] - E[0]);
  return { E, H: [E[0] + Math.cos(ang) * L2, E[1] + Math.sin(ang) * L2] };
}
function chewMouth() {
  return `<g id="chew" opacity="0"><ellipse cx="${MOUTH.x}" cy="${MOUTH.y}" rx="32" ry="17" fill="#fff"/>` +
    `<path id="chewline" d="M${MOUTH.x - 18},${MOUTH.y} Q${MOUTH.x},${MOUTH.y + 10} ${MOUTH.x + 18},${MOUTH.y}" fill="none" ${S(5)}/></g>` +
``;
}

// Aktivist's plant blossoms (Bloom Atelier)
const BLOSSOMS = [[15600, 6690, 1, C.salmon], [16060, 6600, 1.1, C.rose], [16330, 6830, 0.9, C.gold], [15790, 7010, 0.95, C.rose], [16200, 7090, 0.85, C.salmon], [15500, 6930, 0.8, C.gold]];
function blossom(i, [x, y, sc, col]) {
  let p = "";
  for (let k = 0; k < 5; k++) p += `<ellipse cx="0" cy="-34" rx="22" ry="34" fill="${col}" ${S(6)} transform="rotate(${k * 72})"/>`;
  return `<g id="bl${i}" transform="translate(${x} ${y}) scale(0)"><g transform="scale(${sc})">${p}${ring(0, 0, 17, `fill="${C.cream}" ${S(6)}`)}</g></g>`;
}
// Kafein's plate on the pouf (Layer Bakery): a donut and a slice of pizza
const PLATE = { x: 18205, y: 7604 };
function plate() {
  return `<g id="plate" transform="scale(0)">` +
    `<ellipse cx="0" cy="0" rx="118" ry="30" fill="#fff" ${S(7)}/>` +
    `<path d="M-30,-6 L60,-40 L72,-6 Q20,6 -30,-6Z" fill="${C.dough}" ${S(6)}/>` +
    `<path d="M-14,-10 L56,-36 L64,-14 Q20,-4 -14,-10Z" fill="${C.red}"/>` +
    ring(28, -20, 7, `fill="${C.plum}"`) + ring(48, -26, 6, `fill="${C.plum}"`) +
    `<g id="donut"><ellipse cx="-52" cy="-26" rx="56" ry="34" fill="${C.dough}" ${S(6)}/>` +
    `<ellipse cx="-52" cy="-32" rx="48" ry="26" fill="${C.rose}"/>` +
    `<ellipse cx="-52" cy="-30" rx="15" ry="9" fill="${C.dough}" ${S(5)}/>` +
    [[-80, -38, 20], [-30, -44, -30], [-70, -20, 60], [-28, -24, 10]].map(([a, b, r]) => `<rect x="${a}" y="${b}" width="12" height="4" rx="2" fill="#fff" transform="rotate(${r} ${a} ${b})"/>`).join("") +
    `</g></g>` +
    `<g id="yum">${[[-150, -150, 34, C.gold], [120, -170, 28, C.rose], [-40, -220, 22, C.salmon]].map(([x, y, r, c], i) => `<path id="ym${i}" data-x="${PLATE.x + x}" data-y="${PLATE.y + y}" d="${star4(r)}" fill="${c}" ${S(5)}/>`).join("")}</g>`;
}
// Sakar's laptop lid stickers (Souvenir Shop)
const LID = { x: 19705, y: 7335 };
const STICKERS = [
  { x: LID.x - 66, y: LID.y - 40, r: -12, body: `<circle r="36" fill="${C.salmon}" ${S(5)}/><circle cx="-12" cy="-8" r="5" fill="${C.ink}"/><circle cx="12" cy="-8" r="5" fill="${C.ink}"/><path d="M-16,8 Q0,24 16,8" fill="none" ${S(5)}/>` },
  { x: LID.x + 78, y: LID.y - 40, r: 14, body: `<path d="${star4(34)}" fill="${C.gold}" ${S(5)}/>` },
  { x: LID.x + 66, y: LID.y + 52, r: -8, body: `<path d="M0,22 C-46,-6 -30,-42 0,-20 C30,-42 46,-6 0,22Z" fill="${C.rose}" ${S(5)}/>` },
];
const stickers = () => STICKERS.map((o, k) => `<g id="st${k}" opacity="0">${o.body}</g>`).join("");
// Asosyal: DJ headphones over the hood, and notes floating up
function headphones() {
  return `<path d="M20474,6900 C20450,6596 20780,6596 20756,6900" fill="none" ${S(13)}/>` +
    `<rect x="20452" y="6866" width="44" height="108" rx="18" fill="${C.ink}"/><rect x="20734" y="6866" width="44" height="108" rx="18" fill="${C.ink}"/>`;
}
const NOTE_COLORS = [C.salmon, C.gold, C.rose, C.gold];
function note(i) {
  const d = i % 2 ? `M0,0 m-16,0 a16,12 -20 1,0 32,0 a16,12 -20 1,0 -32,0 M14,-4 V-70 L44,-58 V-30` : `M0,0 m-16,0 a16,12 -20 1,0 32,0 a16,12 -20 1,0 -32,0 M14,-4 V-74`;
  return `<g id="nt${i}" opacity="0"><path d="${d}" fill="${NOTE_COLORS[i % 4]}" ${S(6)}/></g>`;
}
// the STOP button on a floor-standing pole just right of the cart
const POLE = { x: 22440, top: 6448, bottom: 8236, btnY: 7305 };
function pole() {
  const { x, top, bottom, btnY } = POLE;
  return `<rect x="${x - 17}" y="${top}" width="34" height="${bottom - top}" fill="#fff" ${S(6)}/>` +
    `<ellipse cx="${x}" cy="${bottom}" rx="46" ry="14" fill="#fff" ${S(6)}/>` +
    `<rect x="${x - 58}" y="${btnY - 70}" width="116" height="150" rx="22" fill="#fff" ${S(7)}/>` +
    `<circle id="btn" cx="${x}" cy="${btnY - 10}" r="36" fill="#fff" ${S(7)}/>` +
    `<text x="${x}" y="${btnY + 58}" text-anchor="middle" font-size="30" font-weight="700" fill="${C.ink}" letter-spacing="2">STOP</text>` +
    `<g id="rings">${[0, 1, 2].map((k) => `<circle id="rg${k}" cx="${x}" cy="${btnY - 10}" r="40" fill="none" stroke="${C.red}" stroke-width="8" opacity="0"/>`).join("")}</g>`;
}
const CAT = { x: 22140, y: 7686, s: 0.86 };
const PAW = [CAT.x + 70, CAT.y - 240];
function cat() {
  const a = ASSETS.cat_sit, [vx, vy, vw, vh] = a.vb;
  const tx = CAT.x - (vx + vw / 2) * CAT.s, ty = CAT.y - (vy + vh) * CAT.s;
  const paw = `<g id="paw" opacity="0">` +
    `<path d="M0,-30 C80,-28 160,-24 214,-22 L214,22 C160,24 80,28 0,30 Z" fill="#fff" ${S(7)}/>` +
    `<ellipse cx="228" cy="0" rx="40" ry="31" fill="#fff" ${S(7)}/>` +
    `<path d="M246,-12 q10,0 16,-4 M250,4 q10,0 16,2 M244,18 q8,2 14,6" fill="none" ${S(5)}/></g>`;
  return `<g id="cat">${paw}<g transform="translate(${f(tx)} ${f(ty)}) scale(${CAT.s})">${a.body}${lid("lidC", 3474.3, 12736.6, 16)}</g></g>`;
}
const layer = (name) => `<g id="L_${name}">${ASSETS[name].body}</g>`;

// ── end card: ORGATEC station wall (screen coordinates, 1080×1920) ───────
// It is placed in the world behind window pane 3, so the train pulls into the
// station and the camera pushes through the window onto it. The Marwood logo
// stays on top (overlay), the ORGATEC logo is the station sign.
const PUSH = { cx: 21330, cy: 7054, s: 5.2 };
const TILE_W = 72, TILE_H = 36;
function orgatecSign(cx, cy, size) {
  const a = ASSETS.orgatec_logo, k = size / a.vb[2], pad = size * 0.05;
  return `<g transform="translate(${f(cx)} ${f(cy)})"><rect x="${f(-size / 2 - pad)}" y="${f(-size / 2 - pad)}" width="${f(size + 2 * pad)}" height="${f(size + 2 * pad)}" rx="${f(pad * 1.4)}" fill="#fff" ${S(4)}/>` +
    `<g transform="translate(${f(-size / 2)} ${f(-size / 2)}) scale(${k.toFixed(5)})">${a.body}</g></g>`;
}
const FLOOR_Y = 1372;
function stationWall() {
  // a wide tiled wall with the station sign repeated, the line colours, and
  // the platform in front of it
  let s = `<defs><pattern id="tiles" patternUnits="userSpaceOnUse" width="${TILE_W}" height="${TILE_H * 2}">` +
    `<rect width="${TILE_W}" height="${TILE_H * 2}" fill="${C.tile}"/>` +
    `<path d="M0,0.5 H${TILE_W} M0,${TILE_H + 0.5} H${TILE_W} M0.5,0 V${TILE_H} M${TILE_W / 2 + 0.5},${TILE_H} V${TILE_H * 2}" stroke="${C.grout}" stroke-width="2.4"/></pattern>` +
    `<pattern id="studs" patternUnits="userSpaceOnUse" width="26" height="20"><rect width="26" height="20" fill="${C.gold}"/><circle cx="13" cy="10" r="4.5" fill="#b8892a"/></pattern>` +
    `<clipPath id="floorclip"><rect x="-6600" y="${FLOOR_Y}" width="15600" height="${1846 - FLOOR_Y}"/></clipPath></defs>`;
  s += `<rect x="-6600" y="-200" width="15600" height="${FLOOR_Y - 56 + 200}" fill="url(#tiles)"/>`;
  for (const x of [-4800, -3000, -1200, 2280, 4080, 5880]) s += orgatecSign(x + 540, 790, 300);
  STATIONS.slice(1, 5).forEach((st, i) => { s += `<rect x="-6600" y="${FLOOR_Y - 56 + i * 14}" width="15600" height="14" fill="${st.color}"/>`; });
  // platform floor: tiles in perspective, the tactile safety strip, the edge
  s += `<rect x="-6600" y="${FLOOR_Y}" width="15600" height="${1846 - FLOOR_Y}" fill="#e6e0d2"/><g clip-path="url(#floorclip)">`;
  for (const y of [1410, 1462, 1530, 1622]) s += `<path d="M-6600,${y} H9000" stroke="#d3ccbb" stroke-width="3"/>`;
  for (let k = -40; k <= 40; k++) s += `<path d="M${540 + k * 60},${FLOOR_Y} L${540 + k * 190},1846" stroke="#d3ccbb" stroke-width="3"/>`;
  s += `</g><rect x="-6600" y="${FLOOR_Y}" width="15600" height="5" fill="${C.ink}"/>`;
  s += `<rect x="-6600" y="1720" width="15600" height="60" fill="url(#studs)"/>`;
  s += `<rect x="-6600" y="1840" width="15600" height="8" fill="${C.ink}"/><rect x="-6600" y="1848" width="15600" height="300" fill="#2a2a2a"/>`;
  return s;
}
function endCard() {
  let s = `<g id="endfront">`;
  s += `<g id="e2"><text x="540" y="474" text-anchor="middle" font-size="64" font-weight="700" fill="${C.navy}">discover a place</text>` +
    `<text x="540" y="548" text-anchor="middle" font-size="64" font-weight="700" fill="${C.navy}">you’ll love to work</text></g>`;
  s += `<g id="e3">${orgatecSign(540, 790, 300)}</g>`;
  s += `<g id="e4"><text x="540" y="1046" text-anchor="middle" font-size="54" font-weight="700" fill="${C.red}">Hall 8.1 · Stand A30–B31</text></g>`;
  s += `<g id="e5"><text x="540" y="1106" text-anchor="middle" font-size="38" font-weight="600" fill="${C.ink}">27–30 October 2026 · Cologne</text></g>`;
  // the cat on a Marwood Cage pouf, on the platform
  const p = ASSETS.cage_pouf, [px, py, pw, ph] = p.vb, ps = 4.5;
  const pouf = p.body.replace(/stroke-width="[^"]*"/g, `stroke-width="${(4.2 / ps).toFixed(3)}"`).replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${C.ink}"`);
  const a = ASSETS.cat_sit, [vx, vy, vw, vh] = a.vb, cs = 0.38;
  const feet = [[513, 1623], [358, 1551], [718, 1528]], back = [563, 1456];
  s += `<g id="e6"><path d="M${feet[0][0]},${feet[0][1] + 10} L${feet[1][0] - 14},${feet[1][1] + 4} L${back[0]},${back[1] - 2} L${feet[2][0] + 14},${feet[2][1] + 2} Z" fill="#d6cfbe" stroke="#d6cfbe" stroke-width="22" stroke-linejoin="round"/>` +
    feet.map(([x, y]) => `<ellipse cx="${x}" cy="${y + 2}" rx="17" ry="6" fill="#bdb4a0"/>`).join("") +
    `<g transform="translate(${f(540 - (px + pw / 2) * ps)} ${f(1632 - (py + ph) * ps)} ) scale(${ps})">${pouf}</g>` +
    `<g transform="translate(${f(556 - (vx + vw / 2) * cs)} ${f(1458 - (vy + vh) * cs)}) scale(${cs})">${a.body}${lid("lidE", 3474.3, 12736.6, 16)}</g></g>`;
  return s + `</g>`;
}
function station() {
  const k = 1 / PUSH.s, ox = PUSH.cx - 540 * k, oy = PUSH.cy - 960 * k;
  return `<g id="station"><g transform="translate(${f(ox)} ${f(oy)}) scale(${k.toFixed(6)})">${stationWall()}${endCard()}</g></g>`;
}

function world() {
  return `<g id="world">` +
    `<rect x="11000" y="7985" width="17000" height="3000" fill="#000"/>` +
    `<rect x="11000" y="3000" width="17000" height="2840" fill="#fff"/>` +
    `<g id="car">${ASSETS.car.body}</g>` +
    windowView(PANES[0], 0) + windowView(PANES[1], 1) + windowView(PANES[2], 2, station()) +
    perfume() + spritz() + lid("lidN", 13267, 6858, 15) +
    `<g id="blossoms">${BLOSSOMS.map((b, i) => blossom(i, b)).join("")}</g>` +
    layer("kafein") + plate() +
    `<g id="adhd">${layer("adhd")}${lid("lidA1", 14339, 6955, 16)}${lid("lidA2", 14443, 6956, 16)}${chewMouth()}${adhdArm()}</g>` +
    `<g id="crumbs">${[0, 1, 2, 3, 4, 5].map((k) => `<rect id="cr${k}" width="14" height="14" rx="3" fill="${C.dough}" ${S(3)} opacity="0"/>`).join("")}</g>` +
    `<g id="sakar">${layer("sakar")}${stickers()}${lid("lidS1", 19664, 6888, 14)}${lid("lidS2", 19749, 6888, 14)}</g>` +
    `<g id="asosyal">${layer("asosyal")}${headphones()}</g>` +
    `<g id="notes">${[0, 1, 2, 3, 4, 5].map(note).join("")}</g>` +
    pole() + cat() +
    `</g>`;
}

// ── screen-space overlay: Marwood logo on top, the line map at the bottom ─
const HEAD_H = 330;
const BAND = { y0: 1622, y1: 1920 };
const MAP = { x0: 110, x1: 970, y: 1772 };
const stopX = (i) => MAP.x0 + (i * (MAP.x1 - MAP.x0)) / LAST;
function marwoodLogo(cx, cy, w) {
  // the wordmark from Marwood's own corporate file (no symbol)
  const a = ASSETS.marwood_logo_full, x0 = 4.04, x1 = 790, k = w / (x1 - x0), h = a.vb[3];
  return `<clipPath id="mwclip"><rect x="${x0}" y="0" width="${x1 - x0}" height="${h}"/></clipPath>` +
    `<g transform="translate(${f(cx - w / 2 - x0 * k)} ${f(cy - h * k / 2)}) scale(${k.toFixed(5)})"><g clip-path="url(#mwclip)">${a.body}</g></g>`;
}
function overlay() {
  let s = `<g id="overlay"><g id="header"><rect x="0" y="-20" width="${W}" height="${HEAD_H + 20}" fill="#fff"/>` +
    `<path d="M0,${HEAD_H} H${W}" stroke="${C.ink}" stroke-width="4"/>${marwoodLogo(540, 238, 440)}</g>`;
  s += `<g id="band"><rect x="0" y="${BAND.y0}" width="${W}" height="${BAND.y1 - BAND.y0 + 20}" fill="#000"/>`;
  // LED readout
  s += `<circle id="ledDot" cx="${MAP.x0 - 6}" cy="1683" r="9" fill="${LED_DOT}"/>` +
    `<text x="${MAP.x0 + 16}" y="1692" font-size="24" font-weight="600" fill="${LED}" letter-spacing="3">NEXT STATION</text>`;
  s += `<clipPath id="nextclip"><rect x="420" y="1644" width="${W - 420}" height="70"/></clipPath><g clip-path="url(#nextclip)">` +
    STATIONS.slice(1).map((st, i) => `<text id="nx${i}" x="${W - MAP.x0 + 22}" y="1698" text-anchor="end" font-size="46" font-weight="700" fill="${LED}" opacity="0">${st.name}</text>`).join("") + `</g>`;
  // the line, coloured by the stop it leads to
  for (let i = 0; i < LAST; i++) s += `<rect id="seg${i}" x="${f(stopX(i))}" y="${MAP.y - 9}" width="${f(stopX(i + 1) - stopX(i))}" height="18" fill="${STATIONS[i + 1].color}"/>`;
  for (let i = 0; i <= LAST; i++) {
    const col = STATIONS[i].color;
    const ring = i === 0 ? `<circle r="20" fill="#000" stroke="#fff" stroke-width="7"/><circle r="8" fill="#fff"/>`
      : i === LAST ? `<circle r="24" fill="${ORG_RED}" stroke="#fff" stroke-width="6"/><circle id="dot${i}" r="8" fill="#fff" opacity="0"/>`
      : `<circle r="17" fill="#000" stroke="${col}" stroke-width="7"/><circle id="dot${i}" r="9" fill="${col}" opacity="0"/>`;
    s += `<g id="stop${i}" transform="translate(${f(stopX(i))} ${MAP.y}) scale(0)"><circle id="pr${i}" r="20" fill="none" stroke="${i === LAST ? "#fff" : col}" stroke-width="6" opacity="0"/>${ring}</g>`;
    const big = i === 0 || i === LAST;
    s += `<text id="lab${i}" x="${f(stopX(i))}" y="${MAP.y + 52}" text-anchor="middle" font-size="${big ? 24 : 20}" font-weight="700" fill="${i === 0 ? LED : "#fff"}" letter-spacing="1.5" opacity="0">` +
      STATIONS[i].lines.map((l, k) => `<tspan x="${f(stopX(i))}" dy="${k ? 24 : 0}">${l}</tspan>`).join("") + `</text>`;
  }
  s += `<g id="train" opacity="0"><rect x="-32" y="-18" width="64" height="36" rx="18" fill="#fff" stroke="#000" stroke-width="4"/>` +
    `<rect x="-18" y="-9" width="14" height="12" rx="3" fill="#000"/><rect x="4" y="-9" width="14" height="12" rx="3" fill="#000"/></g>`;
  return s + `</g></g>`;
}

// ── assemble ──────────────────────────────────────────────────────────────
document.getElementById("stage").innerHTML =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${world()}${overlay()}</svg>`;
const $ = (id) => document.getElementById(id);
const set = (id, attrs) => { const el = typeof id === "string" ? $(id) : id; for (const k in attrs) el.setAttribute(k, attrs[k]); };

// ── timeline ──────────────────────────────────────────────────────────────
const T = {
  spritz: 0.25, wink: 1.05, pull: [1.4, 2.3], band: [1.2, 1.65], line: [1.35, 2.0],
  armUp: [2.75, 3.2], bite: 3.25, armDown: [3.7, 4.1],
  bloom: 4.85, plate: 6.95, stick: [8.35, 8.6, 8.85], notes: 9.7,
  paw: [11.6, 11.95], press: 11.95, brake: [12.1, 13.1], push: [13.15, 14.2], end: 14.2,
};
// the train marker: [time, position on the line]; it leaves Marwood, arrives
// at each corner as its character shows it, and at ORGATEC as the train stops
const RUN = [[2.0, 0], [2.4, 1], [2.6, 1], [3.25, 2], [3.75, 2], [4.85, 3], [5.4, 3], [8.35, 4], [8.85, 4], [13.05, 5]];
const ARRIVE = [-1, 2.4, 3.25, 4.85, 8.35, 13.05];
// what the displays announce: [from time, station index]
const NEXT = [[0, 1], [2.6, 2], [3.75, 3], [5.4, 4], [8.85, 5]];
function trainPos(t) {
  if (t <= RUN[0][0]) return RUN[0][1];
  for (let i = 1; i < RUN.length; i++) {
    if (t <= RUN[i][0]) return lerp(RUN[i - 1][1], RUN[i][1], eio(prog(t, RUN[i - 1][0], RUN[i][0])));
  }
  return RUN[RUN.length - 1][1];
}
// camera stops (world centre x, scale); y keeps the car framed under the band
const RIDE_S = 0.465, RIDE_CY = 7300;
const STOPS = [
  { at: 2.3, until: 4.15, cx: 13870 }, // Narsist + ADHD
  { at: 4.75, until: 5.9, cx: 15960 }, // Aktivist
  { at: 6.85, until: 7.8, cx: 18560 }, // Kafein
  { at: 8.3, until: 9.35, cx: 19690 }, // Sakar
  { at: 9.85, until: 10.85, cx: 20600 }, // Asosyal
];
function camera(t) {
  // hook: close on Narsist, slight push, then pull back to the ride framing
  const s0 = Math.exp(lerp(Math.log(1.22), Math.log(1.05), eo(prog(t, 0, 0.55))));
  const punch = 0.035 * pulse(t, T.spritz, 0.35);
  const z = eio(prog(t, ...T.pull));
  let s = Math.exp(lerp(Math.log(s0 + punch), Math.log(RIDE_S), z));
  let cx = lerp(13150, STOPS[0].cx, z), cy = lerp(7180, RIDE_CY, z);
  // glide from stop to stop
  for (let i = 1; i < STOPS.length; i++) {
    const u = eio(prog(t, STOPS[i - 1].until, STOPS[i].at));
    cx += (STOPS[i].cx - STOPS[i - 1].cx) * u;
  }
  // to the cat, closer
  const c = eio(prog(t, 10.85, 11.45));
  s = Math.exp(lerp(Math.log(s), Math.log(0.62), c));
  cx = lerp(cx, 22120, c); cy = lerp(cy, 7400, c);
  // brake jolt
  const b = prog(t, T.brake[0], T.brake[0] + 0.9);
  if (b > 0 && b < 1) cx += Math.sin(b * Math.PI * 3) * 22 * (1 - b);
  // push through the window onto the station wall
  const p = eio(prog(t, ...T.push));
  s = Math.exp(lerp(Math.log(s), Math.log(PUSH.s), p));
  cx = lerp(cx, PUSH.cx, eo(prog(t, T.push[0], T.push[1] - 0.15)));
  cy = lerp(cy, PUSH.cy, eo(prog(t, T.push[0], T.push[1] - 0.15)));
  return { s, cx, cy };
}
// distance travelled by the train (window view), braking to a stop
function travelled(t) {
  const v = 2300;
  if (t < T.brake[0]) return v * t;
  const d = T.brake[1] - T.brake[0], u = prog(t, ...T.brake);
  return v * T.brake[0] + v * d * (1 - Math.pow(1 - u, 4)) / 4;
}

function seek(t) {
  const cam = camera(t);
  set("world", { transform: `translate(${f(540 - cam.cx * cam.s)} ${f(960 - cam.cy * cam.s)}) scale(${cam.s.toFixed(5)})` });
  const dist = travelled(t);
  PANES.forEach((p, i) => {
    set(`far${i}`, { transform: `translate(${f(-((dist * 0.35) % PERIOD))} 0)` });
    set(`near${i}`, { transform: `translate(${f(-((dist * 1.25) % PERIOD))} 0)` });
  });
  // the station wall slides into the window as the train brakes
  const sb = prog(t, T.brake[0] - 0.1, T.brake[1]);
  set("station", { transform: `translate(${f(2000 * Math.pow(1 - sb, 2.4))} 0)` });

  // ── Narsist: lifts the bottle, sprays, the scent reaches him, he winks
  const lift = eo(prog(t, 0, T.spritz));
  set("narm", { transform: `translate(${f(6 * (1 - lift))} ${f(26 * (1 - lift))})` });
  set("cap", { transform: `translate(0 ${f(7 * pulse(t, T.spritz - 0.02, 0.22))})` });
  SPRAY.forEach((o, k) => {
    const p = prog(t, T.spritz + o.dl, T.spritz + o.dl + 0.75), d = o.d * eo(p);
    set(`sd${k}`, { cx: f(NOZZLE[0] + Math.cos(o.a) * d), cy: f(NOZZLE[1] + Math.sin(o.a) * d - 20 * p), opacity: p > 0 && p < 1 ? f(1 - p * p) : 0 });
  });
  const mi = prog(t, T.spritz + 0.15, T.spritz + 1.0);
  set("mist", { opacity: f(Math.sin(Math.PI * mi)), transform: `translate(13250 6995) scale(${f(0.6 + 0.6 * eo(mi))}) translate(-13250 -6995)` });
  [0, 1].forEach((k) => {
    const dr = eio(prog(t, T.spritz + 0.25 + k * 0.08, T.spritz + 0.85 + k * 0.08));
    set(`tr${k}`, { "stroke-dashoffset": f(1 - dr), opacity: f(1 - eo(prog(t, 0.95, 1.3))) });
  });
  [0, 1, 2, 3, 4].forEach((i) => {
    const el = $(`spk${i}`), sp = prog(t, T.spritz + 0.1 + i * 0.08, T.spritz + 1.3 + i * 0.08);
    const sc = sp <= 0 || sp >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, sp * 1.4));
    set(el, { transform: `translate(${el.dataset.x} ${el.dataset.y}) rotate(${f(t * 90)}) scale(${f(Math.max(0, sc))})` });
  });
  set("lidN", { opacity: t > T.wink && t < T.wink + 0.32 ? 1 : 0 });

  // ── ADHD: lifts the cookie to her mouth, bites, chews, lowers it
  set("adhd", { transform: `rotate(${f(1.6 * Math.sin(t * 2.4))} 14700 6640)` });
  const up = eio(prog(t, ...T.armUp)), down = eio(prog(t, ...T.armDown)), u = up * (1 - down);
  const E = [lerp(ARM.E0[0], ARM.E1[0], u) - 14 * Math.sin(Math.PI * u), lerp(ARM.E0[1], ARM.E1[1], u)];
  const hand = [lerp(ARM.H0[0], ARM.H1[0], u) - 40 * Math.sin(Math.PI * u), lerp(ARM.H0[1], ARM.H1[1], u)];
  const dU = limbPath(ARM.S, E, 31, 29), dF = limbPath(E, hand, 29, 26);
  set("upperO", { d: dU }); set("foreO", { d: dF }); set("upper", { d: dU }); set("fore", { d: dF });
  // the fist points along the forearm and holds the cookie just beyond it
  const fl = Math.hypot(hand[0] - E[0], hand[1] - E[1]), dir = [(hand[0] - E[0]) / fl, (hand[1] - E[1]) / fl];
  const rot = Math.atan2(dir[1], dir[0]) * 180 / Math.PI + 90;
  set("hand", { transform: `translate(${f(hand[0] + dir[0] * 8)} ${f(hand[1] + dir[1] * 8)}) rotate(${f(rot)})` });
  let ck = [hand[0] + dir[0] * 62, hand[1] + dir[1] * 62];
  const nudge = 26 * pulse(t, T.bite - 0.08, 0.2), toM = [MOUTH.x - ck[0], MOUTH.y - ck[1]], ml = Math.hypot(...toM);
  ck = [ck[0] + toM[0] / ml * nudge, ck[1] + toM[1] / ml * nudge];
  set("cookie", { transform: `translate(${f(ck[0])} ${f(ck[1])})` });
  set("bite", { opacity: t >= T.bite ? 1 : 0 });
  const chewing = t > T.bite && t < T.bite + 0.85;
  set("chew", { opacity: chewing ? 1 : 0 });
  set("chewline", { transform: `translate(0 ${f(chewing ? 5 * Math.abs(Math.sin((t - T.bite) * 14)) : 0)})` });
  [0, 1, 2, 3, 4, 5].forEach((k) => {
    const c = prog(t, T.bite + 0.02 + k * 0.03, T.bite + 1.0 + k * 0.05);
    const x = MOUTH.x - 30 + (k - 2.5) * 14 + c * (k - 2.5) * 16, y = MOUTH.y + 40 + c * c * 700 + k * 8;
    set(`cr${k}`, { x: f(x), y: f(y), opacity: c > 0 && c < 1 ? 1 : 0, transform: `rotate(${f(c * 320 + k * 40)} ${f(x + 7)} ${f(y + 7)})` });
  });
  const blinkA = [2.45, 4.4].some((b) => t > b && t < b + 0.14);
  set("lidA1", { opacity: blinkA ? 1 : 0 }); set("lidA2", { opacity: blinkA ? 1 : 0 });

  // ── Aktivist's plant blooms
  BLOSSOMS.forEach(([x, y], i) => {
    const b = spring(t - T.bloom - i * 0.12, 9, 0.35);
    set(`bl${i}`, { transform: `translate(${x} ${y}) rotate(${f(Math.sin(t * 2.2 + i) * 4 + (1 - Math.min(1, b)) * -60)}) scale(${f(Math.max(0, b))})` });
  });

  // ── Kafein's plate pops onto the pouf; the donut bounces
  const pl = spring(t - T.plate, 9, 0.4);
  set("plate", { transform: `translate(${PLATE.x} ${PLATE.y}) scale(${f(Math.max(0, pl))})` });
  set("donut", { transform: `translate(0 ${f(-26 * pulse(t, T.plate + 0.45, 0.3) - 12 * pulse(t, T.plate + 0.75, 0.22))})` });
  [0, 1, 2].forEach((i) => {
    const el = $(`ym${i}`), sp = prog(t, T.plate + 0.25 + i * 0.1, T.plate + 1.05 + i * 0.1);
    const sc = sp <= 0 || sp >= 1 ? 0 : Math.sin(Math.PI * sp);
    set(el, { transform: `translate(${el.dataset.x} ${el.dataset.y}) rotate(${f(t * 80)}) scale(${f(sc)})` });
  });

  // ── Sakar: stickers slap onto her laptop
  T.stick.forEach((ts, k) => {
    const o = STICKERS[k], p = prog(t, ts, ts + 0.28), sc = p <= 0 ? 0 : lerp(2.1, 1, eo(p));
    set(`st${k}`, { opacity: p > 0 ? 1 : 0, transform: `translate(${o.x} ${o.y}) rotate(${f(o.r + (1 - eo(p)) * 25)}) scale(${f(sc)})` });
  });
  const blinkS = [9.15].some((b) => t > b && t < b + 0.14);
  set("lidS1", { opacity: blinkS ? 1 : 0 }); set("lidS2", { opacity: blinkS ? 1 : 0 });

  // ── Asosyal nods to her music; notes drift up from the ear cups
  const nod = t > T.notes - 0.2 ? Math.max(0, Math.sin((t - T.notes) * Math.PI * 2 * 1.1)) * 8 : 0;
  set("asosyal", { transform: `translate(0 ${f(nod)})` });
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    const per = 1.6, st = T.notes + i * 0.27, ph = (((t - st) % per) + per) % per, uu = ph / per;
    const side = i % 2 ? 1 : -1;
    const x = (side > 0 ? 20820 : 20410) + side * (40 + 150 * uu) + Math.sin(uu * 6 + i) * 22, y = 6930 - uu * 420;
    set(`nt${i}`, { opacity: t > st ? f(Math.sin(uu * Math.PI)) : 0, transform: `translate(${f(x)} ${f(y)}) rotate(${f(Math.sin(uu * 5 + i) * 14)}) scale(${f(0.8 + 0.4 * Math.sin(uu * Math.PI))})` });
  });

  // ── the cat presses STOP
  set("lidC", { opacity: [11.25].some((b) => t > b && t < b + 0.13) ? 1 : 0 });
  const pw = eio(prog(t, ...T.paw)) * (1 - eio(prog(t, T.press + 0.4, T.press + 0.8)));
  set("paw", { opacity: f(clamp(pw * 4)), transform: `translate(${PAW[0]} ${PAW[1]}) rotate(${f(lerp(55, -33.5, pw))})` });
  set("btn", { fill: t >= T.press ? C.red : "#fff" });
  [0, 1, 2].forEach((k) => {
    const r = prog(t, T.press + k * 0.18, T.press + 0.9 + k * 0.18);
    set(`rg${k}`, { r: f(40 + 140 * eo(r)), opacity: r > 0 && r < 1 ? f(1 - r) : 0 });
  });
  const sway = t > T.brake[0] ? -3 * Math.exp(-(t - T.brake[0]) * 3) * Math.sin((t - T.brake[0]) * 9) : 0;
  set("cat", { transform: `rotate(${f(sway)} ${CAT.x} ${CAT.y})` });

  // ── overlay: line map and LED readouts (the logo header stays all along)
  const out = eio(prog(t, T.push[0], T.push[0] + 0.45)); // the band leaves as we push through the window
  const hu = eo(prog(t, ...T.band));
  set("band", { transform: `translate(0 ${f(330 * (1 - hu) + 330 * out)})` });
  const ln = eio(prog(t, ...T.line));
  for (let i = 0; i < LAST; i++) set(`seg${i}`, { width: f((stopX(i + 1) - stopX(i)) * clamp(ln * LAST - i)) });
  for (let i = 0; i <= LAST; i++) {
    const p = Math.max(0, spring(t - T.line[0] - i * 0.1, 10, 0.4));
    const arr = ARRIVE[i], extra = i === LAST ? [T.press] : [];
    const bump = [arr, ...extra].reduce((m, tt) => Math.max(m, pulse(t, tt, 0.4)), 0);
    set(`stop${i}`, { transform: `translate(${f(stopX(i))} ${MAP.y}) scale(${f(p * (1 + 0.4 * bump))})` });
    if (i > 0) set(`dot${i}`, { opacity: t >= arr ? 1 : 0 });
    const pr = [arr, ...extra].map((tt) => prog(t, tt, tt + 0.6)).find((v) => v > 0 && v < 1);
    set(`pr${i}`, { r: f(20 + 34 * (pr ?? 0)), opacity: pr !== undefined ? f(1 - pr) : 0 });
    set(`lab${i}`, { opacity: f(eo(prog(t, T.line[0] + 0.25 + i * 0.08, T.line[0] + 0.65 + i * 0.08))) });
  }
  const pos = trainPos(t), seg = Math.min(LAST - 1, Math.floor(pos));
  set("train", { transform: `translate(${f(lerp(stopX(seg), stopX(seg + 1), pos - seg))} ${MAP.y})`, opacity: f(eo(prog(t, T.line[1] - 0.2, T.line[1] + 0.1))) });
  // readouts: the name slides up on the band and flickers over on the LED sign
  NEXT.forEach(([from, idx], k) => {
    const until = k + 1 < NEXT.length ? NEXT[k + 1][0] : 99;
    const a2 = k === 0 ? 1 : eo(prog(t, from + 0.12, from + 0.42)), b2 = eo(prog(t, until, until + 0.2));
    const vis = t < until + 0.2 && (k === 0 || t >= from);
    set(`nx${idx - 1}`, { opacity: vis ? f(a2 * (1 - b2)) : 0, transform: `translate(0 ${f(72 * (1 - a2) - 72 * b2)})` });
  });
  const blink = t >= T.press && t < T.press + 1.2 ? (Math.floor((t - T.press) * 8) % 2 ? 0.25 : 1) : 1;
  set("ledDot", { opacity: f(blink) });

  // ── end card builds once we are through the window
  [["e2", 0.05], ["e3", 0.3], ["e4", 0.55], ["e5", 0.7]].forEach(([id, d]) => {
    const p = eo(prog(t, T.end + d, T.end + d + 0.45));
    set(id, { opacity: f(p), transform: `translate(0 ${f(36 * (1 - p))})` });
  });
  const ec = Math.max(0, spring(t - T.end - 0.95, 9, 0.4));
  set("e6", { opacity: ec > 0 ? 1 : 0, transform: `translate(540 1640) scale(${f(ec)}) translate(-540 -1640)` });
  set("lidE", { opacity: [16.2, 17.3].some((b) => t > b && t < b + 0.13) ? 1 : 0 });
}

await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px M`)));
await document.fonts.ready;
seek(0);
window.scene = { duration: DURATION, seek };
document.body.dataset.ready = "1";
