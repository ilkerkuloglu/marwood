// Rig settings for each character, in native card-pixel coordinates (the
// same space as assets/figures.js, measured on the PDF's card images).
//
// arm      the waving arm, drawn behind the body and revealed through a mask
//   pivot    shoulder joint (hidden inside the sleeve / behind the torso)
//   upper    shoulder → elbow length;  fore  elbow → wrist length
//   w        arm (or sleeve) width without outline
//   cuff     "bare" (short sleeve, skin to the hand), "rib" (knit cuff),
//            "band" (hoodie cuff)
//   rest     pose that lines up with the drawn arm, used for the hand-off
//   raise    shoulder angle while waving (default 45°, higher = elbow further out)
// hide     polygon removed from the drawing while the arm is up (the
//          original arm that hangs / goes behind the back)
// lines    outlines redrawn while the arm is up (torso edge that the arm
//          used to cover)
// eyes     eye dots that blink (cx, cy, rx, ry)
// glint    Asosyal has no visible eyes, so the glasses glint instead
window.CHARS = [
  {
    id: "kafein",
    title: "KAFEİN BAĞIMLISI",
    arm: { pivot: [121, 293], upper: 54, fore: 47, w: 22, cuff: "rib", rest: { sh: 3, el: -14 } },
    hide: [[116.8, 269], [115.9, 274], [114, 280], [112, 286], [110.5, 292], [109, 298], [106.4, 310], [104.4, 322], [102.4, 334], [101, 346], [99.4, 358], [98.8, 370], [99.2, 377], [102, 382.5], [106.8, 389.4], [112.3, 395.6], [117.3, 401.6], [122.6, 407.5], [128.5, 414.5], [131.2, 416.5], [131.2, 301], [127.5, 286], [123.6, 272.6]],
    lines: ["M119.8,270.8 C118.6,281 127,293.5 132.5,302.6"],
    eyes: [[172.5, 176.5, 5.6, 5.6], [205.5, 176.5, 5.6, 5.6]],
  },
  {
    id: "asosyal",
    title: "ASOSYAL",
    arm: { pivot: [97, 296], upper: 52, fore: 46, w: 25, cuff: "band", rest: { sh: 4, el: -12 } },
    hide: [[90, 275], [90.2, 280], [88.7, 286], [88.2, 292], [87.1, 298], [86.1, 304], [84.6, 310], [83.1, 316], [80.6, 322], [78.6, 328], [76.6, 334], [75.6, 340], [74.6, 346], [74.6, 358], [75.1, 364], [76.4, 370], [81.1, 377.4], [88.7, 383.4], [97.4, 389.8], [99.6, 390.4], [100.2, 382], [102.2, 376], [103.2, 370], [104.2, 364], [105.2, 358], [106.2, 352], [107.2, 346], [107.2, 328], [106.2, 322], [105.2, 316], [103, 306], [99.5, 293], [97, 279.5]],
    lines: ["M93.5,277 C96,290 103,303 106.8,315.5"],
    eyes: [],
    glint: [
      { cx: 156, cy: 195.5, r: 14.6, lines: [[145.8, 195.5, 153.5, 186], [149, 200.5, 160.5, 186]] },
      { cx: 200, cy: 195.5, r: 14.6, lines: [[190, 195.5, 196.5, 186], [192.5, 201, 203.5, 186.5]] },
    ],
  },
  {
    id: "narsist",
    title: "NARSİST",
    arm: { pivot: [119, 282], upper: 54, fore: 47, w: 16, cuff: "bare", rest: { sh: 2, el: -16 } },
    hide: [[105, 292.4], [131.2, 301.8], [131.2, 346], [134.9, 352], [139.9, 371.5], [141.8, 373.9],
           [150, 375.3], [158, 377.4], [161.5, 378.4], [160.5, 389], [152, 404], [138, 413.5],
           [133.6, 412], [133.6, 400], [110.2, 352], [109.4, 297]],
    // hand comes out of the pocket: redraw the hip line and an empty pocket
    lines: ["M141.5,373 Q138.2,387 135.3,399.5 L135.4,413", "M158.4,377.3 C156,392 147,403 135.6,408.6"],
    eyes: [[174, 139.5, 6, 5.6], [207.5, 139.5, 5.6, 5.6]],
  },
  {
    id: "adhd",
    title: "ADHD",
    arm: { pivot: [93, 283], upper: 54, fore: 46, w: 14.5, cuff: "bare", rest: { sh: 3, el: -12 } },
    hide: [[78.6, 291.4], [104.4, 300.9], [104.4, 396.6], [100.6, 397.2], [81, 352], [80.4, 335], [81.8, 294]],
    lines: [],
    eyes: [[143.5, 158, 4.6, 5.1], [177, 158.5, 5.1, 4.6]],
  },
  {
    id: "aktivist",
    title: "AKTİVİST",
    arm: { pivot: [121, 321], upper: 54, fore: 47, w: 15.5, cuff: "bare", raise: 55, rest: { sh: 3, el: -14 } },
    hide: [[107, 333.3], [132.8, 343.5], [132.8, 386.2], [134.4, 389.1], [138.9, 389.1], [138.9, 427], [132.5, 427],
           [111.3, 363], [111.6, 337]],
    lines: [],
    eyes: [[175.5, 177.5, 4.6, 4.6], [216.5, 177.5, 4.6, 4.6]],
  },
  {
    id: "sakar",
    title: "SAKAR STAJYER",
    arm: { pivot: [125, 312], upper: 50, fore: 45, w: 15, cuff: "bare", raise: 55, rest: { sh: 3, el: -14 } },
    hide: [[111.5, 323.3], [136.3, 333], [136.3, 359.6], [137.4, 361.3], [139.4, 361.3], [139.4, 421], [133, 421],
           [115.6, 357], [116, 325]],
    lines: [],
    eyes: [[181, 179, 5.1, 5.1], [210.5, 179, 4.6, 5.1]],
  },
];
