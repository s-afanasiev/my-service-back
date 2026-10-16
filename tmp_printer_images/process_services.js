"use strict";
// Фото услуг/запчастей: та же обработка, что у принтеров, только в assets/services/.
const path = require("path");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "services");

const MAP = [
  ["svc/val_zaryada_1.jpg",  "zamena_vala_zaryada.jpg"],
  ["svc/chip_2.jpg",         "proshivka_chipa.jpg"],
  ["svc/bunker_1.jpg",       "chistka_bunkera_otrabotki.jpg"],
  ["svc/plata_1.jpg",        "zamena_platy.jpg"],
  ["svc/kontroler_1.jpg",    "remont_kontrollera.jpg"],
  ["svc/lotok_1.jpg",        "zamena_lotka.jpg"],
  ["svc/kartridzh_1.jpg",    "kartridzh_neoriginalnyy.jpg"],
  ["svc/natyazhitel_1.jpg",  "zamena_rolika_natyazhitelya.jpg"],
  ["svc/mikrovolnovka_1.jpg","remont_mikrovolnovki.jpg"],
];

(async () => {
  for (const [src, dest] of MAP) {
    await sharp(path.join(TMP, src))
      .flatten({ background: "#ffffff" })
      .trim({ threshold: 15 })
      .resize(540, 540, { fit: "contain", background: "#ffffff" })
      .extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toFile(path.join(OUT, dest));
    console.log(`${dest}: ok`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
