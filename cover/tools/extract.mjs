// Pick the parts of a source SVG that lie inside a region and write them as
// a standalone, flattened asset SVG. Works per sub-path, because Illustrator
// often merges many shapes into one compound path. Transforms are baked and
// near-black colours are normalised to pure black.
//   node extract.mjs spec.json
// spec: [{ src, out, rect:[x0,y0,x1,y1], tol, prefix, cut:[[x0,y0,x1,y1],...] }]
//   cut  regions inside rect whose sub-paths are dropped (stray neighbours)
import { chromium } from "playwright-core";
import fs from "node:fs";
const jobs = [].concat(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pages = {};
for (const job of jobs) {
  if (!pages[job.src]) {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><body>${fs.readFileSync(job.src, "utf8")}</body>`);
    pages[job.src] = page;
  }
  const res = await pages[job.src].evaluate((job) => {
    const [x0, y0, x1, y1] = job.rect, tol = job.tol ?? 1;
    const cuts = job.cut || [];
    const root = document.querySelector("svg");
    const rootInv = root.getScreenCTM().inverse();
    const inside = (b) => b[0] >= x0 - tol && b[1] >= y0 - tol && b[2] <= x1 + tol && b[3] <= y1 + tol &&
      !cuts.some((c) => b[0] >= c[0] && b[1] >= c[1] && b[2] <= c[2] && b[3] <= c[3]);
    const norm = (c) => {
      if (!c || c === "none") return "none";
      const m = c.match(/\d+(\.\d+)?/g);
      if (!m) return c;
      const [r, g, b] = m.map(Number);
      if (r < 70 && g < 70 && b < 70) return "#000";
      if (r > 225 && g > 225 && b > 225) return "#fff";
      return `rgb(${r},${g},${b})`;
    };
    const boxOf = (el, sw) => {
      const bb = el.getBBox();
      const m = rootInv.multiply(el.getScreenCTM());
      const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
        .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const s = sw * Math.hypot(m.a, m.b) / 2;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { box: [Math.min(...xs) - s, Math.min(...ys) - s, Math.max(...xs) + s, Math.max(...ys) + s], m };
    };
    const leaves = [...root.querySelectorAll("path, use, rect, circle, ellipse, line, polyline, polygon")]
      .filter((el) => !el.closest("defs") && !el.closest("clipPath") && !el.closest("mask"));
    const defs = new Map();
    let body = "", ext = [Infinity, Infinity, -Infinity, -Infinity], n = 0;
    for (const el of leaves) {
      const cs = getComputedStyle(el);
      const sw = cs.stroke !== "none" ? parseFloat(cs.strokeWidth) : 0;
      let d = null, keepBoxes = [];
      if (el.tagName === "path") {
        const subs = (el.getAttribute("d") || "").split(/(?=M)/).filter((s) => s.trim());
        const kept = [];
        for (const sp of subs) {
          const t = el.cloneNode(false);
          t.setAttribute("d", sp);
          el.parentNode.insertBefore(t, el);
          let b;
          try { b = boxOf(t, sw).box; } catch { b = null; }
          t.remove();
          if (b && inside(b)) { kept.push(sp); keepBoxes.push(b); }
        }
        if (!kept.length) continue;
        d = kept.join(" ");
      } else {
        let b;
        try { b = boxOf(el, sw).box; } catch { continue; }
        if (!inside(b)) continue;
        keepBoxes.push(b);
      }
      const m = rootInv.multiply(el.getScreenCTM());
      const c = el.cloneNode(false);
      for (const a of ["style", "class", "clip-path", "mask", "id"]) c.removeAttribute(a);
      if (d) c.setAttribute("d", d);
      c.setAttribute("transform", `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(5)).join(" ")})`);
      c.setAttribute("fill", norm(cs.fill));
      if (cs.fillRule === "evenodd") c.setAttribute("fill-rule", "evenodd");
      const st = norm(cs.stroke);
      c.setAttribute("stroke", st);
      if (st !== "none") {
        c.setAttribute("stroke-width", cs.strokeWidth);
        c.setAttribute("stroke-linecap", cs.strokeLinecap);
        c.setAttribute("stroke-linejoin", cs.strokeLinejoin);
        c.setAttribute("stroke-miterlimit", cs.strokeMiterlimit);
      }
      if (+cs.opacity < 1) c.setAttribute("opacity", cs.opacity);
      if (el.tagName === "use") {
        const href = el.getAttribute("xlink:href") || el.getAttribute("href");
        const ref = document.querySelector(href);
        if (ref) defs.set(href, ref.outerHTML);
      }
      for (const b of keepBoxes) {
        ext = [Math.min(ext[0], b[0]), Math.min(ext[1], b[1]), Math.max(ext[2], b[2]), Math.max(ext[3], b[3])];
      }
      n++;
      body += new XMLSerializer().serializeToString(c).replace(/ xmlns(:xlink)?="[^"]*"/g, "") + "\n";
    }
    return { body, defs: [...defs.values()].join("\n"), ext, n };
  }, job);
  const vb = [res.ext[0], res.ext[1], res.ext[2] - res.ext[0], res.ext[3] - res.ext[1]].map((v) => +v.toFixed(2));
  const pre = job.prefix || "a";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.join(" ")}" width="${vb[2]}" height="${vb[3]}">\n` +
    (res.defs ? `<defs>${res.defs}</defs>\n` : "") + `<g>${res.body}</g>\n</svg>\n`;
  fs.writeFileSync(job.out, svg.replace(/(id="|href="#)(glyph-)/g, `$1${pre}-$2`));
  console.log(job.out, res.n, "elements, viewBox", vb.join(" "));
}
await browser.close();
