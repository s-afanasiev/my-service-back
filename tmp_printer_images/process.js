"use strict";
// Приводит скачанные картинки к формату каталога: белый фон, 600×600, JPEG.
// flatten -> trim (обрезка белых полей) -> contain 540x540 на белом -> поля 30px -> 600x600.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "printers");

const MAP = [
  ["m428dw/cand3.jpg",         "hp_laserjet_pro_mfp_m428dw.jpg"],
  ["m141w/cand1.jpg",          "hp_laserjet_mfp_m141w.jpg"],
  ["neverstop1000w/cand1.jpg", "hp_neverstop_laser_1000w.jpg"],
  ["m227fdw/cand1.jpg",        "hp_laserjet_pro_mfp_m227fdw.jpg"],
  ["3003dw/cand1.png",         "hp_laserjet_pro_3003dw.jpg"],
  ["laser108w/cand3.jpg",      "hp_laser_108w.jpg"],
  ["m111w/cand2.jpg",          "hp_laserjet_m111w.jpg"],
  ["m211dw/cand3.jpg",         "hp_laserjet_m211dw.jpg"],
  ["mf445dw/cand3.png",        "canon_isensys_mf446x.jpg"],
  ["mf445dw/cand2.jpg",        "canon_isensys_mf445dw.jpg"],
];

(async () => {
  for (const [src, dest] of MAP) {
    const inPath = path.join(TMP, src);
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
