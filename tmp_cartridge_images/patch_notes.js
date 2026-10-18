"use strict";
// Точечная правка cartridge_note в docs/printers-catalog.csv по факту проверки WebSearch.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "docs", "printers-catalog.csv");

// [brand, model] -> новая заметка
const PATCH = {
  "Canon|PIXMA G3430":   "чернила GI-41",
  "Pantum|P2200":        "PC-211EV",
  "Pantum|P2207":        "PC-211EV",
  "Pantum|M6500":        "PC-211EV",
  "Pantum|M6506NW":      "PC-211EV",
  "Pantum|M6550NW":      "PC-211EV",
  "Pantum|P2506W":       "PC-211EV",
  "Pantum|BM5100ADN":    "TL-5120 / TL-5120H",
  "Pantum|BM5220ADW":    "TL-5120 / TL-5120H",
  "Samsung|SCX-4200":    "тонер-туба SCX-D4200A, заправка бункера",
  "Xerox|WorkCentre 5019 / 5021": "тонер CWAA07229, драм 013R00670",
  "Xerox|B225":          "006R04403 / 006R04404",
  "Xerox|B235":          "006R04403 / 006R04404",
  "Xerox|B305":          "006R04376 / 006R04377",
  "Катюша|M133":         "TK-133 / C-TK133",
  "Катюша|P133":         "TK-133 / C-TK133",
  "Катюша|P140":         "тонер-туба TK-240A, драм DR-240",
  "Катюша|P247ep":       "THM247",
  "Deli|M1820W":         "Deli T108",
  "Cactus|CS-LP1120B":   "HP 12A / Q2612A (Cactus CS-Q2612AS)",
};

const lines = fs.readFileSync(FILE, "utf8").split("\n");
const header = lines[0].split(";");
const iBrand = header.indexOf("brand");
const iModel = header.indexOf("model");
const iNote  = header.indexOf("cartridge_note");
let changed = 0;

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const f = lines[i].split(";");
  const key = f[iBrand] + "|" + f[iModel];
  if (PATCH[key] !== undefined && f[iNote] !== PATCH[key]) {
    console.log(`${f[iBrand]} ${f[iModel]}: "${f[iNote]}" -> "${PATCH[key]}"`);
    f[iNote] = PATCH[key];
    lines[i] = f.join(";");
    changed++;
  }
}
fs.writeFileSync(FILE, lines.join("\n"));
console.log(`\nChanged: ${changed} / ${Object.keys(PATCH).length}`);
