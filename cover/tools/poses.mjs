// New character poses built on Zeynep's line work: parts of her drawings are
// clipped away and new limbs / props are drawn in her style (white fills,
// round-capped black outlines of the same weight).
//   node tools/poses.mjs        → assets/narsist_point.svg, adhd_reach.svg, …
import fs from "node:fs";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const A = (f) => path.join(HERE, "..", "assets", f);

function read(file) {
  const s = fs.readFileSync(A(file), "utf8");
  const vb = s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const inner = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return { vb, inner };
}
function write(file, vb, body) {
  const v = vb.map((n) => +n.toFixed(2));
  fs.writeFileSync(A(file), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${v.join(" ")}" width="${v[2]}" height="${v[3]}">\n${body}\n</svg>\n`);
  console.log(file, v.join(" "));
}
// drawing in her style
const f2 = (n) => +n.toFixed(2);
const P2 = (pts) => pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" L");
const stroke = (w) => `stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
// a tapered limb from p0 (round cap) to p1 (open, covered by a hand or sleeve)
function limb(p0, p1, w0, w1, sw, fill = "#fff") {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;           // left normal
  const a0 = [p0[0] + nx * w0, p0[1] + ny * w0], b0 = [p0[0] - nx * w0, p0[1] - ny * w0];
  const a1 = [p1[0] + nx * w1, p1[1] + ny * w1], b1 = [p1[0] - nx * w1, p1[1] - ny * w1];
  const t0 = Math.atan2(ny, nx), cap = [];
  for (let i = 0; i <= 12; i++) { const t = t0 + (i / 12) * Math.PI; cap.push([p0[0] + Math.cos(t) * w0, p0[1] + Math.sin(t) * w0]); }
  return `<path d="M${P2([a1, a0])} L${P2(cap)} L${P2([b0, b1])}" fill="${fill}" ${stroke(sw)}/>`;
}
const rrect = (x, y, w, h, r, attrs) => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${r}" ${attrs}/>`;
// remove a region of the source drawing (evenodd hole in a clip path)
let NCLIP = 0;
function without(inner, vb, holes) {
  const id = `cut${++NCLIP}`, big = 1e5;
  const d = `M${vb[0] - big},${vb[1] - big}H${vb[0] + big}V${vb[1] + big}H${vb[0] - big}Z ` +
    holes.map((h) => "M" + h.map(([x, y]) => `${x},${y}`).join("L") + "Z").join(" ");
  return `<defs><clipPath id="${id}"><path clip-rule="evenodd" d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

// ── Narsist: forearm up, index finger raised, headset on (ten calls at once)
{
  const { vb, inner } = read("narsist_stand.svg");
  const SW = 5.6;
  let s = without(inner, vb, [[[551, 5262], [700, 5262], [700, 5520], [551, 5520]]]);
  const elbow = [572, 5256], wrist = [637, 5046];
  s += limb(elbow, wrist, 27, 22, SW);
  // fist with the index finger up
  s += rrect(624, 4962, 19, 66, 9.5, `fill="#fff" ${stroke(SW)}`);
  s += `<path d="M612,5040 C610,5020 616,5012 630,5012 L652,5014 C664,5016 667,5030 664,5046 C661,5064 650,5070 634,5068 C620,5066 613,5058 612,5040 Z" fill="#fff" ${stroke(SW)}/>`;
  s += `<path d="M640,5030 L658,5031 M639,5046 L657,5047" fill="none" ${stroke(SW * 0.8)}/>`;
  s += `<path d="M613,5046 C622,5036 634,5034 644,5040" fill="none" ${stroke(SW * 0.8)}/>`;
  // headset: band over the head, ear cup, boom mic to the mouth
  s += `<path d="M284,4768 C276,4572 524,4572 516,4768" fill="none" ${stroke(10)}/>`;
  s += rrect(262, 4728, 36, 78, 14, `fill="#000"`);
  s += rrect(506, 4742, 22, 48, 9, `fill="#000"`);
  s += `<path d="M280,4800 C286,4880 340,4892 382,4884" fill="none" ${stroke(6)}/>`;
  s += rrect(376, 4874, 30, 18, 9, `fill="#000"`);
  write("narsist_point.svg", [170, 4565, 510, vb[1] + vb[3] - 4565], s);
}

// ── ADHD: the strap hand becomes a hand holding a sticky note up to the wall
{
  const { vb, inner } = read("src_adhd_reach.svg");
  const SW = 4.7, SALMON = "#f67f62";
  let s = inner;
  // the note (behind the fingers), slightly tilted
  const cx = 14650, cy = 6548, h = 62, a = -10 * Math.PI / 180;
  const R = ([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
  s += `<path d="M${P2([[-h, -h], [h, -h], [h, h], [-h, h]].map(R))}Z" fill="${SALMON}" ${stroke(SW)}/>`;
  s += `<path d="M${P2([[-34, -22], [30, -22]].map(R))} M${P2([[-34, 0], [18, 0]].map(R))}" fill="none" ${stroke(SW * 0.8)}/>`;
  // hand: fingers together holding the note's lower edge, thumb in front
  s += `<path d="M14622,6722 C14600,6690 14594,6640 14606,6602 C14610,6590 14690,6584 14694,6600 C14704,6640 14694,6694 14678,6724 Z" fill="#fff" ${stroke(SW)}/>`;
  s += `<path d="M14630,6596 L14632,6630 M14652,6592 L14654,6628 M14674,6592 L14675,6626" fill="none" ${stroke(SW * 0.8)}/>`;
  s += `<path d="M14606,6668 C14592,6640 14600,6618 14622,6624" fill="none" ${stroke(SW)}/>`;
  write("adhd_reach.svg", [vb[0], 6470, vb[2] + 10, vb[1] + vb[3] - 6470], s);
}

// ── Sakar: the burning laptop becomes a mug flying off her hand — the spill
//    that lands as the Marwood motif is drawn on the floor in the scene
{
  const { vb, inner } = read("sakar_run.svg");
  const SW = 4.6, BROWN = "#852f24";
  let s = without(inner, vb, [[[6890, 2070], [7238, 2070], [7238, 2200], [7262, 2275], [7262, 2368], [7310, 2368], [7310, 2414], [6890, 2414]]]);
  // coffee stream from the mug down toward the floor, with drops
  s += `<path d="M7052,2318 C7020,2350 6996,2400 6988,2470 C6984,2500 6962,2504 6962,2476 C6964,2420 6992,2352 7034,2306 Z" fill="${BROWN}" ${stroke(SW)}/>`;
  for (const [x, y, r] of [[6950, 2530, 9], [6978, 2562, 6], [6936, 2585, 7]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${BROWN}" ${stroke(SW * 0.7)}/>`;
  // the mug, tumbling (mouth down-left), handle on its side
  const mc = [7098, 2286], ma = -35 * Math.PI / 180;
  const M = ([x, y]) => [mc[0] + x * Math.cos(ma) - y * Math.sin(ma), mc[1] + x * Math.sin(ma) + y * Math.cos(ma)];
  s += `<path d="M${P2([[-46, -34], [44, -34], [44, 34], [-46, 34]].map(M))}Z" fill="#fff" ${stroke(SW)}/>`;
  s += `<path d="M${P2([[-24, 34]].map(M))} C${[[-24, 76], [26, 76], [26, 34]].map(M).map(([x, y]) => `${f2(x)},${f2(y)}`).join(" ")}" fill="none" ${stroke(SW * 1.25)}/>`;
  s += `<path d="M${P2([[-46, -34], [-46, 34]].map(M))}" fill="none" ${stroke(SW * 1.8)}/>`;
  // motion lines
  s += `<path d="M7170,2232 L7196,2210 M7178,2258 L7212,2246" fill="none" ${stroke(SW * 0.8)}/>`;
  write("sakar_spill.svg", [6930, vb[1], vb[0] + vb[2] - 6930, vb[3] + 40], s);
}

// ── Asosyal: big DJ headphones over her hood (cyber security by day, DJ by night)
{
  const { vb, inner } = read("src_asosyal_sit.svg");
  let s = inner;
  s += `<path d="M20378,6930 C20354,6610 20712,6610 20688,6930" fill="none" ${stroke(13)}/>`;
  s += rrect(20348, 6880, 44, 104, 18, `fill="#000"`);
  s += rrect(20674, 6880, 44, 104, 18, `fill="#000"`);
  write("asosyal_sit.svg", [vb[0], 6630, vb[2], vb[1] + vb[3] - 6630], s);
}
