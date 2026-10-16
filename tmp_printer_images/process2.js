"use strict";
// Партия 2: модели 11-21 из docs/printers-catalog.csv (позиция 16 Pantum P2207 пропущена —
// фото уже есть). Тот же конвейер, что process.js: flatten -> trim -> contain 540 -> extend 30 -> 600x600.
const path = require("path");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "printers");

const MAP = [
  ["lbp122dw/cand1.jpg",   "canon_isensys_lbp122dw.jpg"],
  ["lbp2900/cand1.jpg",    "canon_isensys_lbp2900.jpg"],
  ["mf4410/cand1.jpg",     "canon_isensys_mf4410.jpg"],
  ["g3430/cand1.jpg",      "canon_pixma_g3430.jpg"],
  ["p2200/cand5.png",      "pantum_p2200.jpg"],
  ["m6500/cand3.jpg",      "pantum_m6500.jpg"],
  ["m6506nw/cand1.png",    "pantum_m6506nw.jpg"],
  ["bm5100adn/cand3.jpg",  "pantum_bm5100adn.jpg"],
  ["bm5220adw/cand1.jpg",  "pantum_bm5220adw.jpg"],
  ["p2200/cand1.jpg",      "pantum_p2506w.jpg"],
];

(async () => {
  for (const [src, dest] of MAP) {
    const outPath = path.join(OUT, dest);
    await sharp(path.join(TMP, src))
      .flatten({ background: "#ffffff" })
      .trim({ threshold: 15 })
      .resize(540, 540, { fit: "contain", background: "#ffffff" })
      .extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toFile(outPath);
    const meta = await sharp(outPath).metadata();
    console.log(`${dest}: ${meta.width}x${meta.height}`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
