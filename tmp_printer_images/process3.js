"use strict";
// Партия 3: позиции 22-32 CSV + №33 (позиция 31 WC 5019/5021 пропущена — чистого фото нет,
// №30 Phaser 3020 пропущен — фото уже было). Тот же конвейер: flatten->trim->contain 540->extend 30.
const path = require("path");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "printers");

const MAP = [
  ["m6550nw/cand1.jpg",  "pantum_m6550nw.jpg"],
  ["m2020/cand1.jpg",    "samsung_xpress_m2020.jpg"],
  ["m2875fd/cand1.jpg",  "samsung_sl_m2875fd.jpg"],
  ["ml2160/cand1.jpg",   "samsung_ml_2160.jpg"],
  ["scx3400/cand1.jpg",  "samsung_scx_3400.jpg"],
  ["scx4200/cand1.jpg",  "samsung_scx_4200.jpg"],
  ["clx3305/cand1.jpg",  "samsung_clx_3305.jpg"],
  ["ph3010/cand1.jpg",   "xerox_phaser_3010.jpg"],
  ["b225/cand1.jpg",     "xerox_b225.jpg"],
  ["b305/cand1.jpg",     "xerox_b305.jpg"],
];

(async () => {
  for (const [src, dest] of MAP) {
    const inPath = path.join(TMP, src);
    if (!require("fs").existsSync(inPath)) { console.log(`SKIP ${dest} (нет исходника)`); continue; }
    const outPath = path.join(OUT, dest);
    await sharp(inPath)
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
