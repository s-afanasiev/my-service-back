"use strict";
// Синхронизация DB printers.cartridge_note / description из docs/printers-catalog.csv.
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost", port: 5432,
  user: "mysite_user",
  password: fs.readFileSync(__dirname + "/../.env", "utf8").match(/DB_PASSWORD=(.*)/)[1].trim(),
  database: "mysite",
});

(async () => {
  const lines = fs.readFileSync(path.join(__dirname, "..", "docs", "printers-catalog.csv"), "utf8")
    .trim().split("\n").slice(1);
  const header = lines.length ? null : null;
  let changed = 0;
  for (const line of lines) {
    const f = line.split(";");
    const [brand, model, , , , description, , , , , , , , , , note] = f;
    const { rows } = await pool.query(
      `UPDATE printers SET cartridge_note = $1, description = $2
       WHERE brand = $3 AND model = $4
       RETURNING id`,
      [note || null, description || null, brand, model]
    );
    if (!rows.length) console.log(`! нет в БД: ${brand} ${model}`);
    else changed++;
  }
  console.log(`printers обновлено: ${changed}`);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
