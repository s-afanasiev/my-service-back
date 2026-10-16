"use strict";
// Партия 4: позиции 34-44 CSV (№35 HL-1110R пропущен — фото уже было).
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "printers");

const MAP = [
  ["b235/cand1.jpg",        "xerox_b235.jpg"],
  ["hl1210wr/cand1.jpg",    "brother_hl_1210wr.jpg"],
  ["dcp1512r/cand1.jpg",    "brother_dcp_1512r.jpg"],
  ["dcpl2550dw/cand1.jpg",  "brother_dcp_l2550dw.jpg"],
  ["mfcl2700dwr/cand1.jpg", "brother_mfc_l2700dwr.jpg"],
  ["dcp1602r/cand1.jpg",    "brother_dcp_1602r.jpg"],
  ["fs1040/cand1.jpg",      "kyocera_fs_1040.jpg"],
  ["fs1060dn/cand1.jpg",    "kyocera_fs_1060dn.jpg"],
  ["fs1120mfp/cand1.jpg",   "kyocera_fs_1120mfp.jpg"],
  ["m2040dn/cand1.jpg",     "kyocera_ecosys_m2040dn.jpg"],
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
