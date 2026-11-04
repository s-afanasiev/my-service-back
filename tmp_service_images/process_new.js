"use strict";
// Обработка новых фото услуг: 600×600, белый фон → assets/services/<slug>.jpg.
// Выбор кандидатов — tmp_service_images/choices.txt (slug:cN).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MAP = [
  "zamena_korpusa",
  "zapravka_lazernogo_kartridzha",
  "zapravka_struynogo_kartridzha",
  "proshivka_apparata_pod_zapravku",
  "sbros_schetchika_chernil_epson",
  "vosstanovlenie_kartridzha",
  "zamena_termoplenki_pechki",
];

const OUT = path.join(__dirname, "..", "assets", "services");
const lines = fs.readFileSync(path.join(__dirname, "choices.txt"), "utf8")
  .split("\n").map(s => s.trim()).filter(Boolean);

(async () => {
  let ok = 0;
  for (const line of lines) {
    const [slug, cand] = line.split(":");
    if (!MAP.includes(slug)) continue;
    const src = path.join(__dirname, slug, `${cand}.jpg`);
    if (!fs.existsSync(src)) { console.log(`${slug}: MISSING ${src}`); continue; }
    await sharp(src)
      .flatten({ background: "#ffffff" })
      .trim({ threshold: 15 })
      .resize(540, 540, { fit: "contain", background: "#ffffff" })
      .extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toFile(path.join(OUT, `${slug}.jpg`));
    console.log(`${slug}.jpg: ok (${cand})`);
    ok++;
  }
  console.log(`\ndone: ${ok}`);
})().catch((e) => { console.error(e); process.exit(1); });
