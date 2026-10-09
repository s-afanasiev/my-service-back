"use strict";

// CLI-импорт каталога принтеров: node scripts/import-printers.js [файл.csv]
// Тот же код разбора и записи, что и импорт через админку.
// Повторный запуск безопасен: пара «бренд + модель» обновляется, а не дублируется.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { parsePrintersCsv, upsertPrinters } = require("../lib/printers-import");

async function main() {
  const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "docs", "printers-catalog.csv"));
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");

  const parsed = parsePrintersCsv(text);
  const pool = new Pool({
    host:     process.env.DB_HOST     || "localhost",
    port:     process.env.DB_PORT     || 5432,
    user:     process.env.DB_USER     || "mysite_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME     || "mysite",
  });

  try {
    const result = await upsertPrinters(pool, parsed.records);
    const failed = parsed.errors.concat(result.failed);
    console.log(`Импорт ${path.basename(file)}: добавлено ${result.inserted}, обновлено ${result.updated}, с ошибками ${failed.length}`);
    for (const f of failed) console.error(`  строка ${f.line}: ${f.error}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
