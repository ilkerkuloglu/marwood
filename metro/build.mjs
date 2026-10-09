// Pull the metro scene out of Zeynep's character file: an empty car (all
// characters cut out) plus one layer per character, so each can be animated.
// Writes assets/*.svg and bundles them into assets.js for the scene.
//   node build.mjs /path/to/kart2.svg
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const K = process.argv[2];
const A = (f) => path.join(HERE, "assets", f);

// Layers drawn above the window view (so the city scrolls behind them); ADHD
// also sways on her strap. Boxes come from the element index of the source.
const CH = {
  adhd: { rect: [14120, 6600, 14752, 8725], drop: [[14150.87, 7381.38, 14228.69, 7719.6]] }, // her hanging arm is redrawn
  kafein: { rect: [18150, 6780, 19050, 8368] },
  sakar: { rect: [19365, 6640, 20138, 8580] },
  // her tablet becomes a postcard: the tablet goes, the hands are a layer of their own
  asosyal: { rect: [20297, 6680, 20915, 8322], cut: [[20180, 7860, 20362, 8270]], drop: [[20534.14, 7215.49, 20701.42, 7257.84], [20534.14, 7229.35, 20698.26, 7416.55], [20495.45, 7278.08, 20588.34, 7379.15], [20513.87, 7340.15, 20587.99, 7380.96], [20534.03, 7336.63, 20590.15, 7367.41], [20535.93, 7322.06, 20590.31, 7354.41], [20483.96, 7276.47, 20590.42, 7336.08], [20512.12, 7356.64, 20529.12, 7366.92], [20641.22, 7288.86, 20734.12, 7389.93], [20641.58, 7350.93, 20715.7, 7391.74], [20639.42, 7347.41, 20695.54, 7378.19], [20639.26, 7332.84, 20693.64, 7365.19], [20639.15, 7287.25, 20745.61, 7346.86], [20700.45, 7367.42, 20714.34, 7376.37]] },
};
// Narsist's briefcase goes, and his right forearm is redrawn raised, holding
// a perfume bottle up to his neck
const DROP = [[12938, 7368, 13287, 7599], [12947, 7385, 13277, 7475], [13045, 7332, 13169, 7373],
  [13144.76, 7296.53, 13397.94, 7594.54],
  // the old briefcase handle on his lap, and the ceiling sign with its rods and text
  [13111.61, 7589.43, 13151.05, 7694.69], [18416.45, 6016.56, 20329.2, 6248.62], [18425.59, 6025.43, 20320.06, 6241.02], [18619.79, 5896.82, 18642.31, 6038.62], [20079.66, 5897.42, 20101, 6034.9], [19359.93, 6073.99, 19481.4, 6197.56], [19495.47, 6102.95, 19580.04, 6199.5], [19598.4, 6102.54, 19660.19, 6197.56], [19671.57, 6103.98, 19812.27, 6198.27], [19811.12, 6102.41, 19910.54, 6199.67], [19920.04, 6102.41, 20019.45, 6199.67], [20029.35, 6068.68, 20125.73, 6199.51], [18539.19, 6116.17, 18588.73, 6168.87], [18601.44, 6116.17, 18653.45, 6169.46], [18657.49, 6116.66, 18709.11, 6168.87], [18711.96, 6105.24, 18748.8, 6169.46], [18806.62, 6116.17, 18850.75, 6169.46], [18855.08, 6105.24, 18891.92, 6169.46], [18897.34, 6116.17, 18942.75, 6169.46], [18952.79, 6105.24, 18989.63, 6169.46], [18999.98, 6095.68, 19011.6, 6168.87], [19023.71, 6116.17, 19077.99, 6169.46], [19091.09, 6116.17, 19140.64, 6168.87], [19210.08, 6095.68, 19221.71, 6168.87], [19232.05, 6116.17, 19276.18, 6169.46]];
const jobs = [];
const bgCuts = [];
for (const [name, c] of Object.entries(CH)) {
  jobs.push({ src: K, out: A(`${name}.svg`), rect: c.rect, cut: c.cut || [], drop: c.drop || [], prefix: name, tol: 4 });
  bgCuts.push(c.rect);
}
// Narsist's right sleeve cuff, redrawn over his raised arm
jobs.push({ src: K, out: A("narsist_cuff.svg"), rect: [13305, 7244, 13428, 7340], prefix: "nc", tol: 4, only: [[13313.21, 7251.04, 13419.79, 7332.58]] });
// Zeynep's hand gripping a cup (from Kafein), reused for Narsist's perfume
jobs.push({ src: K, out: A("grip_hand.svg"), rect: [18630, 7300, 18870, 7495], prefix: "gh", tol: 4, only: [
  [18778.58, 7346.64, 18860.67, 7429.95], [18699.46, 7318.6, 18823.23, 7442.22], [18664.03, 7316.35, 18825.82, 7432.06],
  [18749.72, 7348.48, 18822.45, 7370.7], [18752.39, 7362.66, 18819.1, 7393.51], [18642.75, 7379.49, 18817.98, 7487.42]] });
jobs.push({ src: K, out: A("asosyal_hands.svg"), rect: [20470, 7270, 20760, 7400], prefix: "ah", tol: 4, only: [[20495.45, 7278.08, 20588.34, 7379.15], [20513.87, 7340.15, 20587.99, 7380.96], [20534.03, 7336.63, 20590.15, 7367.41], [20535.93, 7322.06, 20590.31, 7354.41], [20483.96, 7276.47, 20590.42, 7336.08], [20512.12, 7356.64, 20529.12, 7366.92], [20641.22, 7288.86, 20734.12, 7389.93], [20641.58, 7350.93, 20715.7, 7391.74], [20639.42, 7347.41, 20695.54, 7378.19], [20639.26, 7332.84, 20693.64, 7365.19], [20639.15, 7287.25, 20745.61, 7346.86], [20700.45, 7367.42, 20714.34, 7376.37]] });
// ADHD's sleeve cuff, redrawn over her new (animated) arm
jobs.push({ src: K, out: A("adhd_cuff.svg"), rect: [14120, 7340, 14240, 7412], prefix: "ac", tol: 4, only: [[14127.32, 7344.31, 14232.85, 7406.91]] });
jobs.push({ src: K, out: A("car.svg"), rect: [11790, 5820, 27200, 8845], cut: bgCuts, drop: DROP, prefix: "car", tol: 4 });
fs.writeFileSync(A("jobs.json"), JSON.stringify(jobs));
execFileSync("node", [path.join(HERE, "../cover/tools/extract.mjs"), A("jobs.json")], { stdio: "inherit" });

// bundle: glyph <use>s are inlined so every asset is plain paths
function flatten(file) {
  const src = fs.readFileSync(A(file), "utf8");
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
  return { vb, body: body.replace(/\s+\n/g, "\n") };
}
const files = [...Object.keys(CH), "car", "narsist_cuff", "adhd_cuff", "grip_hand", "asosyal_hands"];
const extra = ["cat_sit"];
const own = ["cage_pouf", "orgatec_logo", "marwood_logo_full", "postcard"]; // already in assets/
const out = {};
for (const f of files) out[f] = flatten(`${f}.svg`);
// the two floor halves meet edge to edge, which antialiases into a grey seam:
// let the left half overlap the right one
out.car.body = out.car.body.replace('width="3997.661"', 'width="4003"');
for (const f of extra) {
  fs.copyFileSync(path.join(HERE, "../cover/assets", `${f}.svg`), A(`${f}.svg`));
  out[f] = flatten(`${f}.svg`);
}
for (const f of own) out[f] = flatten(`${f}.svg`);
fs.writeFileSync(path.join(HERE, "assets.js"), `// generated by build.mjs\nexport const ASSETS = ${JSON.stringify(out)};\n`);
console.log("assets.js", Object.keys(out).join(", "), (fs.statSync(path.join(HERE, "assets.js")).size / 1024).toFixed(0) + " KB");
