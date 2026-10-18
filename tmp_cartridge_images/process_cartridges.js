"use strict";
// Обработка выбранных фото картриджей: 600×600, белый фон (тот же конвейер, что у принтеров).
// Читает choices.txt (slug:cN), берёт tmp_cartridge_images/<slug>/<cN>.jpg,
// кладёт assets/cartridges/<slug>.jpg. Опционально: аргументы slug — только они.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const TMP = __dirname;
const OUT = path.join(TMP, "..", "assets", "cartridges");
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const lines = fs.readFileSync(path.join(TMP, "choices.txt"), "utf8")
  .split("\n").map(s => s.trim()).filter(Boolean);

(async () => {
  let ok = 0, skip = 0;
  for (const line of lines) {
    const [slug, cand] = line.split(":");
    if (only.length && !only.includes(slug)) continue;
    const src = path.join(TMP, slug, `${cand}.jpg`);
    if (!fs.existsSync(src)) { console.log(`${slug}: MISSING ${src}`); skip++; continue; }
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
  console.log(`\ndone: ${ok} processed, ${skip} skipped`);
})().catch((e) => { console.error(e); process.exit(1); });
