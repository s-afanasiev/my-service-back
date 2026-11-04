"use strict";
// Импорт docs/cartridges-catalog.csv в БД (cartridges + printer_cartridges).
// Идемпотентный: совпадающие строки (по бренду + модели/алиасам) обновляются,
// лишние связи удаляются, старые строки вне каталога удаляются (каскадом со связями).
// Запуск: node import_cartridges_csv.js [--dry]
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const dry = process.argv.includes("--dry");
const pool = new Pool({
  host: "localhost", port: 5432,
  user: "mysite_user",
  password: fs.readFileSync(__dirname + "/../.env", "utf8").match(/DB_PASSWORD=(.*)/)[1].trim(),
  database: "mysite",
});

const RU_SLUG = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const slugPart = s => String(s || "").trim().toLowerCase()
  .replace(/[а-яё]/g, ch => RU_SLUG[ch] || "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const COLOR_MAP = { mono: "black", color: "set", c: "cyan", m: "magenta", y: "yellow", bk: "black" };

function readCsv() {
  const file = path.join(__dirname, "..", "docs", "cartridges-catalog.csv");
  return fs.readFileSync(file, "utf8").trim().split("\n").slice(1).map(l => l.split(";"))
    .filter(f => f.length >= 7)
    .map(([cartridge, brand, aliases, color, type, printers, imageFile]) => ({
      cartridge, brand, imageFile,
      aliases: aliases.split(",").map(s => s.trim()).filter(Boolean),
      color: COLOR_MAP[color] || "black",
      type,
      printers: printers.split(",").map(s => s.trim()).filter(Boolean),
    }));
}

(async () => {
  const rows = readCsv();

  const { rows: printerRows } = await pool.query("SELECT id, brand, model FROM printers");
  const printerBySlug = new Map();
  for (const p of printerRows) {
    printerBySlug.set([slugPart(p.brand), slugPart(p.model)].filter(Boolean).join("-"), p.id);
  }

  // Первый картридж в файле для каждого принтера — «основной» (is_default).
  const defaultKey = new Map(); // printerSlug -> brand|cartridge
  for (const r of rows) {
    for (const p of r.printers) {
      if (!defaultKey.has(p)) defaultKey.set(p, r.brand + "|" + r.cartridge);
    }
  }

  const { rows: dbRows } = await pool.query(
    "SELECT id, brand, model, aliases, color, cartridge_type FROM cartridges ORDER BY id"
  );

  let inserted = 0, updated = 0, deleted = 0, linksAdded = 0, linksRemoved = 0, defaultsSet = 0;
  const touchedIds = new Set();
  const unmatchedStale = [];

  for (const r of rows) {
    const csvAliases = [r.cartridge, ...r.aliases].map(s => s.toLowerCase());
    const matches = dbRows.filter(d =>
      d.brand.toLowerCase() === r.brand.toLowerCase() &&
      (d.model.toLowerCase() === r.cartridge.toLowerCase() ||
        csvAliases.includes(d.model.toLowerCase()) ||
        (d.aliases || []).some(a => csvAliases.includes(a.toLowerCase())))
    );
    // Приоритет точного совпадения модели.
    matches.sort((a, b) =>
      Number(b.model.toLowerCase() === r.cartridge.toLowerCase()) -
      Number(a.model.toLowerCase() === r.cartridge.toLowerCase()));

    let id;
    if (!matches.length) {
      const { rows: ins } = await pool.query(
        `INSERT INTO cartridges (brand, model, name, color, cartridge_type, aliases)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [r.brand, r.cartridge, r.brand + " " + r.cartridge, r.color, r.type,
         [...new Set([r.cartridge, ...r.aliases])].filter(a => a.toLowerCase() !== r.cartridge.toLowerCase())]
      );
      id = ins[0].id;
      inserted++;
      console.log(`+ ${r.brand} ${r.cartridge}`);
    } else {
      id = matches[0].id;
      const aliasSet = new Set();
      for (const m of matches) {
        aliasSet.add(m.model);
        (m.aliases || []).forEach(a => aliasSet.add(a));
      }
      r.aliases.forEach(a => aliasSet.add(a));
      const aliasArr = [...aliasSet].filter(a => a.toLowerCase() !== r.cartridge.toLowerCase());
      await pool.query(
        `UPDATE cartridges SET brand = $1, model = $2, name = $3, color = $4, cartridge_type = $5, aliases = $6
         WHERE id = $7`,
        [r.brand, r.cartridge, r.brand + " " + r.cartridge, r.color, r.type, aliasArr, id]
      );
      updated++;
      if (matches[0].model.toLowerCase() !== r.cartridge.toLowerCase()) {
        console.log(`~ ${r.brand} ${matches[0].model} -> ${r.cartridge}`);
      }
      // Дубли внутри БД, сведённые к primary: переносим связи и удаляем.
      for (const dup of matches.slice(1)) {
        await pool.query(
          `INSERT INTO printer_cartridges (printer_id, cartridge_id, is_default)
           SELECT printer_id, $1, is_default FROM printer_cartridges WHERE cartridge_id = $2
           ON CONFLICT (printer_id, cartridge_id) DO UPDATE
             SET is_default = printer_cartridges.is_default OR EXCLUDED.is_default`,
          [id, dup.id]
        );
        await pool.query("DELETE FROM cartridges WHERE id = $1", [dup.id]);
        deleted++;
        console.log(`- дубль ${r.brand} ${dup.model} (слит в ${r.cartridge})`);
      }
    }
    touchedIds.add(id);

    if (dry) continue;

    // Связи с принтерами: точный набор из CSV + is_default по порядку файла.
    const desired = [];
    for (const slug of r.printers) {
      const pid = printerBySlug.get(slug);
      if (!pid) { console.log(`  ! принтер не найден по slug: ${slug} (${r.brand} ${r.cartridge})`); continue; }
      desired.push(pid);
      const isDefault = defaultKey.get(slug) === r.brand + "|" + r.cartridge;
      const { rowCount } = await pool.query(
        `INSERT INTO printer_cartridges (printer_id, cartridge_id, is_default)
         VALUES ($1, $2, $3)
         ON CONFLICT (printer_id, cartridge_id) DO UPDATE SET is_default = EXCLUDED.is_default`,
        [pid, id, isDefault]
      );
      if (rowCount) linksAdded++;
      if (isDefault) defaultsSet++;
    }
    // Убираем связи этого картриджа с принтерами вне CSV.
    const { rowCount: rm } = await pool.query(
      `DELETE FROM printer_cartridges
       WHERE cartridge_id = $1 AND printer_id <> ALL($2::int[])`,
      [id, desired.length ? desired : [0]]
    );
    linksRemoved += rm;
  }

  // Старые строки вне каталога (TL-4100, TL-4100X, TL-5100 и т.п.) — каскадом со связями.
  for (const d of dbRows) {
    if (touchedIds.has(d.id)) continue;
    unmatchedStale.push(d.brand + " " + d.model);
    if (!dry) {
      await pool.query("DELETE FROM cartridges WHERE id = $1", [d.id]);
      deleted++;
    }
  }

  console.log(`\nИтог:${dry ? " (DRY)" : ""} вставлено ${inserted}, обновлено ${updated}, удалено ${deleted}, связей +${linksAdded}/-${linksRemoved}, is_default проставлено ${defaultsSet}`);
  if (unmatchedStale.length) console.log("Удалены старые строки вне каталога: " + unmatchedStale.join(", "));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
