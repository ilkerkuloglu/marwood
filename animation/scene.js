// Marwood characters: waving + blinking loop, animated with Motion.
//
// Every moving value lives in a plain object per character (`state`). Motion
// animates those objects on one paused timeline, and render() writes them
// into the SVG. The page exposes window.scene.seek(t) so render.mjs can step
// through the loop frame by frame for the video.
(() => {
  const { animate } = window.Motion;
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#000";
  const PAPER = "#fff";
  const STROKE = 2.3; // outline width of the drawings, in card px
  const LOOP = 14; // seconds

  const params = new URLSearchParams(location.search);
  const STAGE = { w: 1920, h: 1080, baseline: 925, scale: 1.12, left: 300, right: 1735 };

  const svg = document.getElementById("stage");
  const defs = el("defs", {}, svg);

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  // ── Hand & arm geometry ────────────────────────────────────────────────
  // Local space at the wrist: fingers point along +y, thumb on -x (towards
  // the body once the arm is raised palm-forward).
  const HAND_SCALE = 1.2;
  const HAND = scaleHand({
    palm: { cx: 0, cy: 6.8, rx: 7.0, ry: 7.6 },
    fw: 3.3,
    fingers: [
      [-4.6, 10, -9, 9.6],
      [-1.55, 11, -3, 11.2],
      [1.6, 11, 3, 10.8],
      [4.6, 10, 9.5, 8.8],
    ],
    tw: 3.7,
    thumb: [-5.4, 5.6, -55, 8.6],
  }, HAND_SCALE);
  function scaleHand(h, k) {
    const f = ([x, y, a, len]) => [x * k, y * k, a, len * k];
    return {
      palm: { cx: h.palm.cx * k, cy: h.palm.cy * k, rx: h.palm.rx * k, ry: h.palm.ry * k },
      fw: h.fw * k, tw: h.tw * k, fingers: h.fingers.map(f), thumb: f(h.thumb),
    };
  }
  const rad = (d) => (d * Math.PI) / 180;
  const tipOf = ([x, y, a, len]) => [x + len * Math.sin(rad(a)), y + len * Math.cos(rad(a))];

  // pass: "outline" | "fill" | "over" | "detail" | "hole"
  //  outline  black, every shape grown by the stroke width
  //  fill     white, exact shapes  → together: one seamless outlined arm
  //  over     forearm + hand again on top, masked off around the elbow, so
  //           the forearm reads in front of the upper arm when folded
  //  detail   finger creases, cuff seams
  //  hole     black shapes inside the body mask, so the forearm and hand
  //           show in front of the body while the upper arm stays behind it
  function passStyle(pass) {
    const grow = pass === "outline" || pass === "hole" ? STROKE * 2 : 0;
    const color = pass === "fill" ? PAPER : INK;
    return { grow, color };
  }

  function capsule(parent, x1, y1, x2, y2, width, pass, cap = "round") {
    const { grow, color } = passStyle(pass);
    el("line", { x1, y1, x2, y2, stroke: color, "stroke-width": width + grow, "stroke-linecap": cap }, parent);
  }

  function disc(parent, cx, cy, r, pass) {
    const { grow, color } = passStyle(pass);
    el("circle", { cx, cy, r: r + grow / 2, fill: color }, parent);
  }

  function hand(parent, pass) {
    const { grow, color } = passStyle(pass);
    if (pass === "over") {
      hand(parent, "outline");
      hand(parent, "fill");
      return;
    }
    if (pass === "detail") {
      // creases between fingers, from near the tips back towards the palm
      for (let i = 0; i < HAND.fingers.length - 1; i++) {
        const a = HAND.fingers[i], b = HAND.fingers[i + 1];
        const ta = tipOf(a), tb = tipOf(b);
        const top = [(ta[0] + tb[0]) / 2, (ta[1] + tb[1]) / 2 - 1.6];
        const base = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1.2];
        el("line", { x1: top[0], y1: top[1], x2: base[0], y2: base[1], stroke: INK, "stroke-width": 1.25, "stroke-linecap": "round" }, parent);
      }
      return;
    }
    const p = HAND.palm;
    el("ellipse", { cx: p.cx, cy: p.cy, rx: p.rx + grow / 2, ry: p.ry + grow / 2, fill: color }, parent);
    for (const f of HAND.fingers) capsule(parent, f[0], f[1], ...tipOf(f), HAND.fw, pass);
    capsule(parent, HAND.thumb[0], HAND.thumb[1], ...tipOf(HAND.thumb), HAND.tw, pass);
  }

  function cuff(parent, arm) {
    // seams across the sleeve end (detail pass only)
    const half = arm.w / 2 + STROKE / 2;
    const y = arm.fore;
    const line = (yy) => el("line", { x1: -half, y1: yy, x2: half, y2: yy, stroke: INK, "stroke-width": STROKE * 0.9 }, parent);
    line(y);
    if (arm.cuff === "rib") {
      line(y - 7.5);
      for (let x = -arm.w / 2 + 1.6; x < arm.w / 2 - 0.8; x += 2.4) {
        el("line", { x1: x, y1: y - 6.4, x2: x, y2: y - 1.2, stroke: INK, "stroke-width": 1.1 }, parent);
      }
    } else if (arm.cuff === "band") {
      line(y - 6);
    }
  }

  // One copy of the shoulder → elbow → wrist chain for a given pass.
  function chain(arm, parent, pass) {
    const root = el("g", { transform: `translate(${arm.pivot[0]},${arm.pivot[1]})` }, parent);
    const sh = el("g", {}, root);
    if (pass === "outline" || pass === "fill") {
      disc(sh, 0, 0, arm.w / 2, pass);
      capsule(sh, 0, 0, 0, arm.upper, arm.w, pass, "butt");
    }
    const elRoot = el("g", { transform: `translate(0,${arm.upper})` }, sh);
    const elb = el("g", {}, elRoot);
    if (pass === "over") {
      const g = el("g", { mask: `url(#${elbowMask(arm)})` }, elb);
      capsule(g, 0, 0, 0, arm.fore, arm.w, "outline", "butt");
      capsule(g, 0, 0, 0, arm.fore, arm.w, "fill", "butt");
    } else if (pass !== "detail") {
      disc(elb, 0, 0, arm.w / 2, pass);
      capsule(elb, 0, 0, 0, arm.fore, arm.w, pass, "butt");
    }
    const wrRoot = el("g", { transform: `translate(0,${arm.fore})` }, elb);
    const wr = el("g", {}, wrRoot);
    if (arm.cuff === "bare") {
      if (pass === "over") {
        disc(wr, 0, 0, arm.w / 2, "outline");
        disc(wr, 0, 0, arm.w / 2, "fill");
      } else if (pass !== "detail") disc(wr, 0, 0, arm.w / 2, pass);
      hand(wr, pass);
    } else {
      // the hand comes out of the sleeve: drawn under the sleeve end
      const handG = el("g", { transform: "translate(0,-1.5)" }, wr);
      hand(handG, pass);
      if (pass === "detail") cuff(elb, arm);
    }
    return { sh, elb, wr };
  }

  // Mask in elbow-local space (a mask's content uses the user space of the
  // element it is applied to): hides a disc around the joint.
  const elbowMasks = new Map();
  function elbowMask(arm) {
    const r = arm.w / 2 + STROKE + 4.5;
    const id = `elbow-${String(r).replace(".", "_")}`;
    if (!elbowMasks.has(id)) {
      const m = el("mask", { id, maskUnits: "userSpaceOnUse", x: -200, y: -200, width: 400, height: 400 }, defs);
      el("rect", { x: -200, y: -200, width: 400, height: 400, fill: "#fff" }, m);
      el("circle", { cx: 0, cy: 0, r, fill: "#000" }, m);
      elbowMasks.set(id, m);
    }
    return id;
  }

  // ── Logo & names ───────────────────────────────────────────────────────
  function placeTrace(t, x, y, h, anchor = "middle") {
    // place a traced block so its ink box is `h` tall, centred on x, top at y
    const [x0, y0, x1, y1] = t.bbox;
    const k = h / (y1 - y0);
    const left = anchor === "middle" ? x - ((x1 - x0) * k) / 2 : x;
    const g = el("g", { transform: `translate(${left},${y}) scale(${k}) translate(${-x0},${-y0})` }, svg);
    el("path", { d: t.d, transform: t.transform, fill: INK }, g);
    return g;
  }
  placeTrace(window.LOGO, STAGE.w / 2, 46, 104);

  // ── Characters ─────────────────────────────────────────────────────────
  const chars = window.CHARS.map((cfg, index) => buildChar(cfg, index));

  // names under the feet: same cap height for all, aligned on the baseline
  const CAP = 20;
  const capK = CAP / (window.TITLES.adhd.bbox[3] - window.TITLES.adhd.bbox[1]);
  for (const c of chars) {
    const t = window.TITLES[c.cfg.id];
    const [x0, y0, x1, y1] = t.bbox;
    const g = el("g", {
      transform: `translate(${c.cx - ((x1 - x0) * capK) / 2},${STAGE.baseline + 58 - (y1 - y0) * capK}) scale(${capK}) translate(${-x0},${-y0})`,
    }, svg);
    el("path", { d: t.d, transform: t.transform, fill: INK }, g);
  }

  function buildChar(cfg, index) {
    const fig = window.FIGURES[cfg.id];
    const [bx0, , bx1, by1] = fig.bbox;
    const feet = [(bx0 + bx1) / 2, by1];
    const cx = STAGE.left + (index * (STAGE.right - STAGE.left)) / (window.CHARS.length - 1);
    const root = el("g", {
      transform: `translate(${cx},${STAGE.baseline}) scale(${STAGE.scale}) translate(${-feet[0]},${-feet[1]})`,
    }, svg);
    const body = el("g", {}, root);

    // arm, behind the body
    const armG = el("g", { class: "arm" }, body);
    const passes = ["outline", "fill", "over", "detail"].map((p) => chain(cfg.arm, armG, p));

    // body mask: hide the drawn arm, punch a hole for the forearm + hand
    const maskId = `mask-${cfg.id}`;
    const mask = el("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: -400, y: -400, width: 2000, height: 2000 }, defs);
    el("rect", { x: -400, y: -400, width: 2000, height: 2000, fill: "#fff" }, mask);
    el("polygon", { points: cfg.hide.map((p) => p.join(",")).join(" "), fill: "#000" }, mask);
    passes.push(chain(cfg.arm, mask, "hole"));

    // redrawn outlines sit above the hidden area, but still under the forearm
    const linesMaskId = `lines-${cfg.id}`;
    const linesMask = el("mask", { id: linesMaskId, maskUnits: "userSpaceOnUse", x: -400, y: -400, width: 2000, height: 2000 }, defs);
    el("rect", { x: -400, y: -400, width: 2000, height: 2000, fill: "#fff" }, linesMask);
    passes.push(chain(cfg.arm, linesMask, "hole"));

    const base = el("g", {}, body);
    el("path", { d: fig.sil, transform: fig.transform, fill: PAPER }, base);
    el("path", { d: fig.ink, transform: fig.transform, fill: INK }, base);
    const lines = el("g", { fill: "none", stroke: INK, "stroke-width": STROKE, "stroke-linecap": "round", mask: `url(#${linesMaskId})` }, body);
    for (const d of cfg.lines) el("path", { d }, lines);

    // eyes: cover the drawn dot, redraw it as an ellipse we can squash
    const eyes = cfg.eyes.map(([ex, ey, rx, ry]) => {
      el("ellipse", { cx: ex, cy: ey, rx: rx + 1.1, ry: ry + 1.1, fill: PAPER }, base);
      return { node: el("ellipse", { cx: ex, cy: ey, rx, ry, fill: INK }, base), cx: ex, cy: ey };
    });

    // glasses glint (Asosyal)
    const glints = (cfg.glint || []).map((g, gi) => {
      const clipId = `glint-${cfg.id}-${gi}`;
      el("circle", { cx: g.cx, cy: g.cy, r: g.r }, el("clipPath", { id: clipId }, defs));
      const grp = el("g", { "clip-path": `url(#${clipId})`, visibility: "hidden" }, base);
      el("circle", { cx: g.cx, cy: g.cy, r: g.r + 1, fill: PAPER }, grp);
      const streaks = el("g", {}, grp);
      for (const [x1, y1, x2, y2] of g.lines) {
        el("line", { x1, y1, x2, y2, stroke: INK, "stroke-width": 1.7, "stroke-linecap": "round" }, streaks);
      }
      return { grp, streaks };
    });

    const state = {
      breath: 0, sway: 0, lean: 0, squash: 1,
      arm: 0, sh: cfg.arm.rest.sh, el: cfg.arm.rest.el, wr: 0,
      blink: 1, glint: 0,
    };
    return { cfg, feet, cx, body, base, lines, armG, passes, maskId, eyes, glints, state };
  }

  function render() {
    for (const c of chars) {
      const s = c.state;
      const [fx, fy] = c.feet;
      const sy = (1 + s.breath * 0.009) * s.squash;
      c.body.setAttribute("transform",
        `translate(${fx},${fy}) rotate(${s.sway + s.lean}) scale(${1 + (1 - s.squash) * 0.5},${sy}) translate(${-fx},${-fy})`);

      const up = s.arm > 0.5;
      c.armG.setAttribute("visibility", up ? "visible" : "hidden");
      c.lines.setAttribute("visibility", up ? "visible" : "hidden");
      if (up) c.base.setAttribute("mask", `url(#${c.maskId})`);
      else c.base.removeAttribute("mask");
      for (const p of c.passes) {
        p.sh.setAttribute("transform", `rotate(${s.sh})`);
        p.elb.setAttribute("transform", `rotate(${s.el})`);
        p.wr.setAttribute("transform", `rotate(${s.wr})`);
      }

      for (const e of c.eyes) {
        e.node.setAttribute("transform", `translate(${e.cx},${e.cy}) scale(1,${s.blink}) translate(${-e.cx},${-e.cy})`);
      }
      for (const g of c.glints) {
        const on = s.glint > 0 && s.glint < 1;
        g.grp.setAttribute("visibility", on ? "visible" : "hidden");
        // streaks slide out to the lower right, then come back in from the upper left
        const d = s.glint < 0.5 ? s.glint * 2 * 34 : (s.glint - 1) * 2 * 34;
        g.streaks.setAttribute("transform", `translate(${d * 0.78},${d * 0.63})`);
      }
    }
  }

  // ── Timeline ───────────────────────────────────────────────────────────
  // Deterministic pseudo-random so every render of the loop is identical.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const seq = [];
  const at = (t) => ((t % LOOP) + LOOP) % LOOP;

  function wave(c, t0, swings = 3) {
    const s = c.state;
    const rest = c.cfg.arm.rest;
    const SH = c.cfg.arm.raise || 45; // elbow out to the side
    const up = 180 - SH; // forearm straight up (sh + el = 180)
    const amp = 20;
    const raise = 0.42, swing = 0.27, lower = 0.5;
    const tWave = t0 + raise;
    const tLower = tWave + swing * 2 * swings + 0.1;

    seq.push([s, { arm: [0, 1] }, { at: t0, duration: 0.001 }]);
    seq.push([s, { squash: [1, 0.985, 1.01, 1] }, { at: t0 - 0.1, duration: 0.5, ease: "easeInOut" }]);
    seq.push([s, { lean: [0, -1.4] }, { at: t0, duration: 0.5, ease: "easeOut" }]);
    seq.push([s, { sh: [rest.sh, SH], el: [rest.el, up], wr: [0, -8] },
      { at: t0, type: "spring", visualDuration: raise, bounce: 0.3 }]);

    const elK = [up], wrK = [-8];
    for (let i = 0; i < swings; i++) { elK.push(up + amp, up - amp); wrK.push(16, -18); }
    elK.push(up); wrK.push(0);
    seq.push([s, { el: elK, wr: wrK }, { at: tWave, duration: swing * 2 * swings + 0.1, ease: "easeInOut" }]);

    seq.push([s, { sh: [SH, rest.sh], el: [up, rest.el], wr: [0, 0] }, { at: tLower, duration: lower, ease: "easeInOut" }]);
    seq.push([s, { lean: [-1.4, 0] }, { at: tLower, duration: lower + 0.1, ease: "easeInOut" }]);
    seq.push([s, { arm: [1, 0] }, { at: tLower + lower, duration: 0.001 }]);
    return tLower + lower;
  }

  function blink(c, t, double = false) {
    const k = { blink: [1, 0.08, 1] };
    if (c.cfg.glint) {
      seq.push([c.state, { glint: [0.001, 0.999] }, { at: t, duration: 0.6, ease: "easeInOut" }]);
      seq.push([c.state, { glint: [0.999, 0] }, { at: t + 0.6, duration: 0.001 }]);
      return;
    }
    seq.push([c.state, k, { at: t, duration: 0.17, ease: ["easeIn", "easeOut"] }]);
    if (double) seq.push([c.state, k, { at: t + 0.26, duration: 0.17, ease: ["easeIn", "easeOut"] }]);
  }

  // pin every animated key at t=0 so values are defined before their first event
  for (const c of chars) {
    const s = c.state;
    seq.push([s, { arm: 0, sh: s.sh, el: s.el, wr: 0, lean: 0, squash: 1, blink: 1, glint: 0 }, { at: 0, duration: 0.001 }]);
  }

  // domino wave left → right, then everyone together
  chars.forEach((c, i) => wave(c, 0.5 + i * 1.5));
  chars.forEach((c, i) => wave(c, 11.0 + i * 0.07, 3));

  // blinks: ~every 2.5–4.5 s, sometimes a double blink
  chars.forEach((c, i) => {
    let t = 0.4 + rand() * 2.2 + i * 0.13;
    while (t < LOOP - 0.5) {
      blink(c, t, rand() < 0.25);
      t += 2.5 + rand() * 2;
    }
  });

  // close the timeline exactly at LOOP
  const clock = { t: 0 };
  seq.push([clock, { t: [0, 1] }, { at: LOOP - 0.001, duration: 0.001 }]);

  const timeline = animate(seq, { defaultTransition: { ease: "easeInOut" } });
  timeline.pause();

  // idle loops (breathing, sway) as separate repeating animations, phase-shifted
  const loops = [];
  chars.forEach((c, i) => {
    const b = animate(c.state, { breath: [0, 1] }, { duration: LOOP / 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" });
    const w = animate(c.state, { sway: [-0.6, 0.6] }, { duration: LOOP / 4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" });
    b.pause(); w.pause();
    loops.push([b, (i * 0.61) % (LOOP / 4)], [w, (i * 1.37) % (LOOP / 2)]);
  });

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  async function seek(t) {
    t = at(t);
    timeline.time = t;
    for (const [a, phase] of loops) a.time = t + phase;
    await nextFrame();
    await nextFrame();
    render();
  }

  // debug: zoom the stage onto a point given in a character's card coordinates
  function focus(id, x, y, half = 40) {
    const c = chars.find((ch) => ch.cfg.id === id);
    const sx = c.cx + STAGE.scale * (x - c.feet[0]);
    const sy = STAGE.baseline + STAGE.scale * (y - c.feet[1]);
    const hw = half * STAGE.scale;
    svg.setAttribute("viewBox", `${sx - hw * 16 / 9} ${sy - hw} ${hw * 32 / 9} ${hw * 2}`);
  }

  window.scene = { seek, focus, duration: LOOP, chars, render };
  const t0 = params.has("t") ? parseFloat(params.get("t")) : 0;
  seek(t0).then(() => { document.body.dataset.ready = "1"; });
})();
