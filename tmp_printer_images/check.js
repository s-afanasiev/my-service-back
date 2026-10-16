"use strict";
// Сверка: у каждой модели каталога должно быть фото в assets/printers.
// Логика имени — как в server.js: slugPart(brand)+slugPart(model), разделители любыми.
const fs = require("fs");
const path = require("path");

const RU_SLUG = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
function slugPart(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/[а-яё]/g, (ch) => RU_SLUG[ch] || "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function printerSlug(brand, model) {
  return [slugPart(brand), slugPart(model)].filter(Boolean).join("-");
}

// Модели из CSV
const csv = fs.readFileSync(path.join(__dirname, "..", "docs", "printers-catalog.csv"), "utf8");
const lines = csv.split(/\r?\n/).filter(Boolean).slice(1);
const models = lines.map((line, i) => {
  const cols = line.split(";");
  return { pos: i + 1, brand: cols[0], model: cols[1] };
});

// Исходная девятка (была в БД до CSV; часть уже есть в CSV — дедуп по slug)
const original = [
  ["HP", "LaserJet P1102"],
  ["Samsung", "Xpress M2070"],
  ["Canon", "i-SENSYS LBP6030"],
  ["Canon", "i-SENSYS MF3010"],
  ["Brother", "HL-1110R"],
  ["HP", "LaserJet Pro MFP 135a"],
  ["Pantum", "P2207"],
  ["Катюша", "M133"],
  ["Xerox", "Phaser 3020"],
];

const bySlug = new Map();
const all = [
  ...models,
  ...original.map(([brand, model]) => ({ pos: 0, brand, model })),
];
for (const m of all) {
  const slug = printerSlug(m.brand, m.model);
  if (!bySlug.has(slug)) bySlug.set(slug, m);
}

// Файлы в assets/printers → «голый» ключ как в findAssetFile (всё не-латиницу-цифры убрать)
const assetDir = path.join(__dirname, "..", "assets", "printers");
const files = fs.readdirSync(assetDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const have = new Set(files.map((f) => path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/g, "")));

const missing = [];
for (const [slug, m] of bySlug) {
  const key = slug.replace(/-/g, "");
  if (!have.has(key)) missing.push(m);
}

console.log(`Моделей всего: ${bySlug.size}, файлов фото: ${files.length}`);
if (missing.length === 0) {
  console.log("ВСЕ МОДЕЛИ ПОКРЫТЫ ФОТО ✓");
} else {
  console.log(`БЕЗ ФОТО (${missing.length}):`);
  for (const m of missing) console.log(`  №${m.pos || "?"}: ${m.brand} | ${m.model}  →  ${printerSlug(m.brand, m.model).replace(/-/g, "_")}.jpg`);
}
