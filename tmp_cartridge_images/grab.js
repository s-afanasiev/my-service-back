"use strict";
// Скачивает кандидатов фото картриджа и собирает контакт-лист с подписями.
// Usage: node grab.js <slug> <url1> [url2] [url3]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const slug = process.argv[2];
const urls = process.argv.slice(3).filter(Boolean);
if (!slug || !urls.length) { console.error("usage: node grab.js <slug> <url...>"); process.exit(1); }

const DIR = path.join(__dirname, slug);
fs.mkdirSync(DIR, { recursive: true });

const LABELS = ["1", "2", "3"];

(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const saved = [];
  for (let i = 0; i < urls.length && i < 3; i++) {
    const dest = path.join(DIR, `c${LABELS[i]}.jpg`);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        if (attempt) await sleep(4000);
        const res = await fetch(urls[i]);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 3000) throw new Error("too small " + buf.length);
        fs.writeFileSync(dest, buf);
        await sharp(dest).metadata(); // валидность картинки
        saved.push(`c${LABELS[i]}`);
        ok = true;
      } catch (e) {
        if (attempt === 2) console.log(`c${LABELS[i]}: FAIL (${e.message})`);
      }
    }
    await sleep(2000);
  }
  if (!saved.length) { console.log("NO CANDIDATES"); process.exit(2); }

  const TH = 360;
  const tiles = [];
  for (let i = 0; i < saved.length; i++) {
    const img = await sharp(path.join(DIR, `${saved[i]}.jpg`))
      .flatten({ background: "#ffffff" })
      .resize(TH, TH, { fit: "contain", background: "#ffffff" })
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${TH}" height="40"><rect width="100%" height="100%" fill="black"/><text x="50%" y="30" font-size="28" fill="white" text-anchor="middle" font-family="sans-serif">${slug} #${saved[i]}</text></svg>`
    );
    tiles.push(await sharp({ create: { width: TH, height: TH + 40, channels: 3, background: "#ffffff" } })
      .composite([{ input: img, top: 40, left: 0 }, { input: label, top: 0, left: 0 }])
      .jpeg().toBuffer());
  }
  const W = TH * tiles.length, H = TH + 40;
  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite(tiles.map((t, i) => ({ input: t, top: 0, left: i * TH })))
    .jpeg({ quality: 85 })
    .toFile(path.join(DIR, "montage.jpg"));
  console.log(`${slug}: candidates ${saved.join(",")} -> montage.jpg`);
})().catch((e) => { console.error(e); process.exit(1); });
