"use strict";
// Партия 5 (финал): позиции 45-56 CSV (№47 Катюша M133 — фото уже было;
// №50 Катюша P247ep, №55 Deli M1820W, №56 Cactus CS-LP1120B — чистых фото
// на белом в индексе нет, оставлены заглушки + рекомендация снять самим).
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "printers");

const MAP = [
  ["m2235dn/cand2.jpg",  "kyocera_ecosys_m2235dn.jpg"],
  ["p2235dn/cand1.jpg",  "kyocera_ecosys_p2235dn.jpg"],
  ["p247ep/cand1.png",   "katyusha_p133.jpg"],
  ["p133/cand2.jpg",     "katyusha_p140.jpg"],
  ["l3250/cand1.jpg",    "epson_ecotank_l3250.jpg"],
  ["l3210/cand1.png",    "epson_ecotank_l3210.jpg"],
  ["l3550/cand5.png",    "epson_ecotank_l3550.jpg"],
  ["l210/cand1.jpg",     "epson_l210.jpg"],
];

(async () => {
  for (const [src, dest] of MAP) {
    const inPath = path.join(TMP, src);
    if (!fs.existsSync(inPath)) { console.log(`SKIP ${dest}`); continue; }
    await sharp(inPath)
      .flatten({ background: "#ffffff" })
      .trim({ threshold: 15 })
      .resize(540, 540, { fit: "contain", background: "#ffffff" })
      .extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toFile(path.join(OUT, dest));
    console.log(`${dest}: ok`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
