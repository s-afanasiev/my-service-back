"use strict";

// Импорт каталога принтеров из CSV.
// Общий код для админки (POST /admin/printers/import) и CLI (scripts/import-printers.js).
// Семантика upsert: ключ — пара «бренд + модель» без учёта регистра.
// Пустая ячейка = поле не менять. Разделитель «;» или «,», кодировка UTF-8.

const COLUMN_ALIASES = {
  "brand": "brand", "бренд": "brand",
  "model": "model", "модель": "model",
  "device_type": "device_type", "тип": "device_type",
  "print_technology": "print_technology", "технология": "print_technology", "печать": "print_technology",
  "color_mode": "color_mode", "цвет": "color_mode",
  "description": "description", "описание": "description",
  "paper_format": "paper_format", "формат": "paper_format", "формат_бумаги": "paper_format",
  "print_speed_ppm": "print_speed_ppm", "скорость": "print_speed_ppm",
  "resolution_dpi": "resolution_dpi", "разрешение": "resolution_dpi",
  "is_duplex": "is_duplex", "дуплекс": "is_duplex",
  "is_wifi": "is_wifi", "wifi": "is_wifi", "wi-fi": "is_wifi",
  "is_ethernet": "is_ethernet", "ethernet": "is_ethernet", "lan": "is_ethernet",
  "is_usb": "is_usb", "usb": "is_usb",
  "release_year": "release_year", "год": "release_year",
  "has_adf": "has_adf", "adf": "has_adf", "автоподатчик": "has_adf",
  "scan_resolution_dpi": "scan_resolution_dpi", "разрешение_сканера": "scan_resolution_dpi",
  "cartridge_note": "cartridge_note", "картридж": "cartridge_note",
  "is_featured": "is_featured", "витрина": "is_featured",
};

const DEVICE_TYPE_MAP = { "принтер": "printer", "printer": "printer", "мфу": "mfp", "mfp": "mfp" };
const TECH_MAP = {
  "лазер": "laser", "лазерный": "laser", "laser": "laser",
  "струйный": "inkjet", "струйник": "inkjet", "струйная": "inkjet", "inkjet": "inkjet",
};
const COLOR_MAP = {
  "ч/б": "mono", "чб": "mono", "моно": "mono", "mono": "mono",
  "цвет": "color", "цветной": "color", "цветная": "color", "color": "color",
};

const TRUTHY = new Set(["да", "yes", "true", "1", "+", "вкл", "есть", "y"]);
const FALSY  = new Set(["нет", "no", "false", "0", "-", "выкл", "n"]);

const TEXT_FIELDS = ["description", "paper_format", "resolution_dpi", "scan_resolution_dpi", "cartridge_note"];
const NUM_FIELDS  = ["print_speed_ppm"];
const INT_FIELDS  = ["release_year"];
const BOOL_FIELDS = ["is_duplex", "is_wifi", "is_ethernet", "is_usb", "has_adf"];

function detectDelimiter(headerLine) {
  let inQuotes = false, semi = 0, comma = 0;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ";") semi++;
    else if (!inQuotes && ch === ",") comma++;
  }
  return semi >= comma ? ";" : ",";
}

// Разбор CSV по RFC 4180: кавычки, удвоенные кавычки, переводы строк внутри ячеек.
function splitRows(text) {
  const delim = detectDelimiter(text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n")));
  const rows = [];
  let row = [], field = "", inQuotes = false, startLine = 1, line = 1;

  function endField() { row.push({ value: field, line: startLine }); field = ""; }
  function endRow() {
    endField();
    if (row.length > 1 || row[0].value.trim() !== "") rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delim) { endField(); continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      startLine = ++line;
      continue;
    }
    field += ch;
  }
  if (field !== "" || row.length) endRow();
  return { rows: rows.map(r => r.map(c => c.value)), delimiter: delim };
}

function triBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (TRUTHY.has(s)) return true;
  if (FALSY.has(s)) return false;
  return null;
}

function optInt(v) {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function optNum(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normName(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function enumFrom(map, value) {
  if (value == null) return null;
  return map[String(value).trim().toLowerCase()] || null;
}

// CSV-текст → { records: [{ line, values: {колонка: непустое значение} }], errors: [{ line, error }], delimiter }
function parsePrintersCsv(text) {
  const { rows, delimiter } = splitRows(text);
  const records = [], errors = [];
  if (!rows.length) {
    errors.push({ line: 1, error: "файл пустой" });
    return { records, errors, delimiter };
  }
  const header = rows[0].map(h => COLUMN_ALIASES[String(h).trim().toLowerCase()] || null);
  if (header.indexOf("brand") === -1 || header.indexOf("model") === -1) {
    errors.push({ line: 1, error: "в заголовке нет колонок brand/бренд и model/модель" });
    return { records, errors, delimiter };
  }
  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r], line = r + 1;
    if (raw.every(c => !String(c).trim())) continue;
    const rec = { line, values: {} };
    header.forEach((col, idx) => {
      if (!col || idx >= raw.length) return;
      const v = String(raw[idx]).trim();
      if (v !== "") rec.values[col] = v;
    });
    if (!rec.values.brand || !rec.values.model) {
      errors.push({ line, error: "пустые brand или model" });
      continue;
    }
    records.push(rec);
  }
  return { records, errors, delimiter };
}

// Запись в БД. Возвращает { inserted, updated, failed: [{ line, error }] }.
async function upsertPrinters(pool, records) {
  const out = { inserted: 0, updated: 0, failed: [] };

  for (const rec of records) {
    try {
      const v = rec.values;
      const { rows } = await pool.query(
        "SELECT id FROM printers WHERE lower(trim(brand)) = $1 AND lower(trim(model)) = $2 LIMIT 1",
        [normName(v.brand), normName(v.model)]
      );

      if (rows[0]) {
        const sets = ["brand = $1", "model = $2"];
        const args = [v.brand, v.model];
        function put(expr, value) {
          sets.push(expr.replace("?", "$" + (args.length + 1)));
          args.push(value);
        }
        for (const f of TEXT_FIELDS) if (v[f] != null) put(f + " = ?", v[f]);
        for (const f of NUM_FIELDS) {
          const n = optNum(v[f]);
          if (n != null) put(f + " = ?", n);
        }
        for (const f of INT_FIELDS) {
          const n = optInt(v[f]);
          if (n != null) put(f + " = ?", n);
        }
        for (const f of BOOL_FIELDS) {
          const b = triBool(v[f]);
          if (b !== null) put(f + " = ?", b);
        }
        const featured = triBool(v.is_featured);
        if (featured !== null) put("is_featured = ?", featured);
        args.push(rows[0].id);
        await pool.query("UPDATE printers SET " + sets.join(", ") + " WHERE id = $" + args.length, args);
        out.updated++;
        continue;
      }

      const { rows: maxRows } = await pool.query("SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM printers");
      await pool.query(
        `INSERT INTO printers
           (brand, model, device_type, print_technology, color_mode, sort_order,
            description, paper_format, print_speed_ppm, resolution_dpi,
            is_duplex, is_wifi, is_ethernet, is_usb, release_year, has_adf,
            scan_resolution_dpi, cartridge_note, is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          v.brand, v.model,
          enumFrom(DEVICE_TYPE_MAP, v.device_type) || "printer",
          enumFrom(TECH_MAP, v.print_technology) || "laser",
          enumFrom(COLOR_MAP, v.color_mode) || "mono",
          maxRows[0].m + 1,
          v.description ?? null,
          v.paper_format ?? null,
          optNum(v.print_speed_ppm),
          v.resolution_dpi ?? null,
          triBool(v.is_duplex), triBool(v.is_wifi), triBool(v.is_ethernet), triBool(v.is_usb),
          optInt(v.release_year), triBool(v.has_adf),
          v.scan_resolution_dpi ?? null,
          v.cartridge_note ?? null,
          triBool(v.is_featured) ?? false,
        ]
      );
      out.inserted++;
    } catch (err) {
      out.failed.push({ line: rec.line, error: err.message });
    }
  }
  return out;
}

module.exports = { parsePrintersCsv, upsertPrinters };
