"use strict";
// Проверка покрытия: каждый картридж из docs/cartridges-catalog.csv ↔ assets/cartridges/.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const rows = fs.readFileSync(path.join(ROOT, "docs", "cartridges-catalog.csv"), "utf8")
  .trim().split("\n").slice(1)
  .map(l => l.split(";"))
  .filter(f => f.length >= 7);

const files = new Set(fs.readdirSync(path.join(ROOT, "assets", "cartridges")));
const noPhoto = [], extra = [];
for (const [cart, brand, , , , printers, img] of rows) {
  if (!files.has(img)) noPhoto.push(`${brand} ${cart} (${printers})`);
}
for (const f of files) {
  if (!rows.some(r => r[6] === f)) extra.push(f);
}

console.log(`Картриджей в каталоге: ${rows.length}`);
console.log(`С фото: ${rows.length - noPhoto.length}`);
if (noPhoto.length) {
  console.log(`\nБез фото (${noPhoto.length}):`);
  noPhoto.forEach(s => console.log("  - " + s));
}
if (extra.length) {
  console.log(`\nЛишние файлы в assets/cartridges (${extra.length}):`);
  extra.forEach(s => console.log("  - " + s));
}
