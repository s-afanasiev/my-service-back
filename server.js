require("dotenv").config();

const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const express = require("express");
const multer  = require("multer");
const { Pool } = require("pg");

const app  = express();
const PORT = 3001;

const FEATURED_MAX = 8;
const featuredDir       = path.join(__dirname, "public", "featured");
const assetsPrintersDir = path.join(__dirname, "assets", "printers");
const IMAGE_EXT    = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const IMAGE_EXTS   = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const DEVICE_TYPES = new Set(["printer", "mfp"]);
const PRINT_TECHS  = new Set(["laser", "inkjet"]);
const COLOR_MODES  = new Set(["mono", "color"]);

const FEATURED_SEED = [
  ["HP",      "LaserJet P1102",        "printer", "laser",  "mono"],
  ["HP",      "LaserJet Pro MFP 135a", "mfp",     "laser",  "mono"],
  ["Canon",   "i-SENSYS MF3010",       "mfp",     "laser",  "mono"],
  ["Canon",   "i-SENSYS LBP6030",      "printer", "laser",  "mono"],
  ["Brother", "HL-1110R",              "printer", "laser",  "mono"],
  ["Xerox",   "Phaser 3020",           "printer", "laser",  "mono"],
  ["Samsung", "Xpress M2070",          "mfp",     "laser",  "mono"],
  ["Pantum",  "P2207",                 "printer", "laser",  "mono"],
];

const FEATURED_DETAILS = {
  "HP|LaserJet P1102": {
    description: "Компактный чёрно-белый лазерник для дома и небольшого офиса. Простая конструкция, недорогой расходник 85A — одна из самых частых моделей на заправке.",
    paper_format: "A4", print_speed_ppm: 18, resolution_dpi: "600×600",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2011, has_adf: false, scan_resolution_dpi: null, cartridge_note: "85A / CE285A",
  },
  "HP|LaserJet Pro MFP 135a": {
    description: "МФУ «печать + скан + копир» без лишней электроники. Удобно в офисе, где нужен комплект в одном корпусе. Картридж 106A/107A хорошо заправляется.",
    paper_format: "A4", print_speed_ppm: 20, resolution_dpi: "1200×1200",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2019, has_adf: false, scan_resolution_dpi: "1200×1200", cartridge_note: "106A / 107A (W1106A / W1107A)",
  },
  "Canon|i-SENSYS MF3010": {
    description: "Надёжное лазерное МФУ Canon: печать, сканер и копир. Картридж 725 — массовый, заправка и восстановление отработаны.",
    paper_format: "A4", print_speed_ppm: 18, resolution_dpi: "1200×600",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2012, has_adf: false, scan_resolution_dpi: "600×600", cartridge_note: "725 / 3484B002",
  },
  "Canon|i-SENSYS LBP6030": {
    description: "Тихий компактный лазерный принтер. Мало места на столе, картридж тот же 725, что и у MF3010 — удобно держать расходники.",
    paper_format: "A4", print_speed_ppm: 18, resolution_dpi: "2400×600",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2012, has_adf: false, scan_resolution_dpi: null, cartridge_note: "725 / 3484B002",
  },
  "Brother|HL-1110R": {
    description: "Недорогой лазер Brother с отдельным тонер-картриджем TN-1075. Часто выбирают из‑за низкой цены заправки и простой замены расходника.",
    paper_format: "A4", print_speed_ppm: 20, resolution_dpi: "2400×600",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2014, has_adf: false, scan_resolution_dpi: null, cartridge_note: "TN-1075",
  },
  "Xerox|Phaser 3020": {
    description: "Компактный лазер Xerox для небольшой печати. Картридж 106R02773 заправляется, аппарат неприхотлив в сервисе.",
    paper_format: "A4", print_speed_ppm: 20, resolution_dpi: "1200×1200",
    is_duplex: false, is_wifi: true, is_ethernet: false, is_usb: true,
    release_year: 2014, has_adf: false, scan_resolution_dpi: null, cartridge_note: "106R02773",
  },
  "Samsung|Xpress M2070": {
    description: "МФУ Samsung: печать, скан и копир в одном корпусе. Картридж MLT-D111S — одна из самых ходовых позиций по заправке.",
    paper_format: "A4", print_speed_ppm: 20, resolution_dpi: "1200×1200",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2014, has_adf: false, scan_resolution_dpi: "1200×1200", cartridge_note: "MLT-D111S",
  },
  "Pantum|P2207": {
    description: "Доступный лазер Pantum, который часто берут вместо дорогих брендов. Картридж PC-211EV заправляется, запчасти недорогие.",
    paper_format: "A4", print_speed_ppm: 22, resolution_dpi: "1200×1200",
    is_duplex: false, is_wifi: false, is_ethernet: false, is_usb: true,
    release_year: 2016, has_adf: false, scan_resolution_dpi: null, cartridge_note: "PC-211EV",
  },
};

// ── Пул соединений PostgreSQL ─────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 5432,
  user:     process.env.DB_USER     || "mysite_user",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "mysite",
});

// ── Создание таблиц при первом запуске ────────────────────────────────────────
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS services (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(255)   NOT NULL,
    price DECIMAL(10,2)  NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id    SERIAL PRIMARY KEY,
    type  VARCHAR(255)  NOT NULL,
    url   VARCHAR(2048) NOT NULL,
    color VARCHAR(7)    NOT NULL DEFAULT '#2563eb'
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS featured_printers (
    id                SERIAL PRIMARY KEY,
    brand             VARCHAR(100) NOT NULL,
    model             VARCHAR(150) NOT NULL,
    device_type       VARCHAR(20)  NOT NULL DEFAULT 'printer',
    print_technology  VARCHAR(20)  NOT NULL DEFAULT 'laser',
    color_mode        VARCHAR(20)  NOT NULL DEFAULT 'mono',
    sort_order        SMALLINT     NOT NULL DEFAULT 0,
    is_active         BOOLEAN      NOT NULL DEFAULT true,
    image_filename    VARCHAR(255),
    description       TEXT,
    paper_format         VARCHAR(20),
    print_speed_ppm      NUMERIC(5,1),
    resolution_dpi       VARCHAR(50),
    is_duplex            BOOLEAN,
    is_wifi              BOOLEAN,
    is_ethernet          BOOLEAN,
    is_usb               BOOLEAN,
    release_year         SMALLINT,
    has_adf              BOOLEAN,
    scan_resolution_dpi  VARCHAR(50),
    cartridge_note       VARCHAR(150)
  )`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS paper_format VARCHAR(20)`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS print_speed_ppm NUMERIC(5,1)`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS resolution_dpi VARCHAR(50)`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS is_duplex BOOLEAN`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS is_wifi BOOLEAN`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS is_ethernet BOOLEAN`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS is_usb BOOLEAN`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS release_year SMALLINT`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS has_adf BOOLEAN`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS scan_resolution_dpi VARCHAR(50)`);
  await pool.query(`ALTER TABLE featured_printers ADD COLUMN IF NOT EXISTS cartridge_note VARCHAR(150)`);
  fs.mkdirSync(featuredDir, { recursive: true });
  fs.mkdirSync(assetsPrintersDir, { recursive: true });
  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS n FROM featured_printers");
  if (countRows[0].n === 0) {
    for (let i = 0; i < FEATURED_SEED.length; i++) {
      const [brand, model, deviceType, tech, color] = FEATURED_SEED[i];
      await pool.query(
        `INSERT INTO featured_printers
           (brand, model, device_type, print_technology, color_mode, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [brand, model, deviceType, tech, color, i + 1]
      );
    }
  }
  await fillFeaturedDetails();
}

// ── Вспомогательные функции ───────────────────────────────────────────────────
function textColorFor(hex) {
  const c = hex.replace("#", "");
  const lum = (0.299 * parseInt(c.slice(0,2),16)
             + 0.587 * parseInt(c.slice(2,4),16)
             + 0.114 * parseInt(c.slice(4,6),16)) / 255;
  return lum > 0.55 ? "#1e293b" : "#ffffff";
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(a, "utf8"), bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function pickEnum(value, allowed, fallback) {
  const v = String(value || "").trim();
  return allowed.has(v) ? v : fallback;
}

function parseOptStr(v, max) {
  const s = String(v || "").trim().slice(0, max || 255);
  return s || null;
}

function parseOptInt(v) {
  if (v === "" || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptNum(v) {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function flagLabel(v) {
  if (v === true) return "есть";
  if (v === false) return "нет";
  return "";
}

function specRows(row, labels) {
  const rows = [];
  function push(label, value) {
    if (value === "" || value == null) return;
    rows.push({ label: label, value: String(value) });
  }
  push("Тип", labels.type);
  push("Печать", labels.tech);
  push("Цвет", labels.color);
  push("Формат бумаги", row.paper_format);
  if (row.print_speed_ppm != null && row.print_speed_ppm !== "") {
    push("Скорость печати", String(row.print_speed_ppm).replace(/\.0$/, "") + " стр/мин");
  }
  push("Разрешение печати", row.resolution_dpi);
  push("Двусторонняя печать", flagLabel(row.is_duplex));
  push("USB", flagLabel(row.is_usb));
  push("Wi‑Fi", flagLabel(row.is_wifi));
  push("Ethernet", flagLabel(row.is_ethernet));
  push("Разрешение сканера", row.scan_resolution_dpi);
  if (row.device_type === "mfp") push("Автоподатчик (ADF)", flagLabel(row.has_adf));
  if (row.release_year) push("Год модели", row.release_year);
  push("Картридж", row.cartridge_note);
  return rows;
}

async function fillFeaturedDetails() {
  const { rows } = await pool.query("SELECT id, brand, model FROM featured_printers");
  for (const row of rows) {
    const extra = FEATURED_DETAILS[row.brand + "|" + row.model];
    if (!extra) continue;
    await pool.query(
      `UPDATE featured_printers SET
         description         = COALESCE(description, $1),
         paper_format        = COALESCE(paper_format, $2),
         print_speed_ppm     = COALESCE(print_speed_ppm, $3),
         resolution_dpi      = COALESCE(resolution_dpi, $4),
         is_duplex           = COALESCE(is_duplex, $5),
         is_wifi             = COALESCE(is_wifi, $6),
         is_ethernet         = COALESCE(is_ethernet, $7),
         is_usb              = COALESCE(is_usb, $8),
         release_year        = COALESCE(release_year, $9),
         has_adf             = COALESCE(has_adf, $10),
         scan_resolution_dpi = COALESCE(scan_resolution_dpi, $11),
         cartridge_note      = COALESCE(cartridge_note, $12)
       WHERE id = $13`,
      [
        extra.description, extra.paper_format, extra.print_speed_ppm, extra.resolution_dpi,
        extra.is_duplex, extra.is_wifi, extra.is_ethernet, extra.is_usb,
        extra.release_year, extra.has_adf, extra.scan_resolution_dpi, extra.cartridge_note,
        row.id,
      ]
    );
  }
}

function slugPart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function printerSlug(brand, model) {
  return [slugPart(brand), slugPart(model)].filter(Boolean).join("-");
}

function firstExisting(dir, stem) {
  for (const ext of IMAGE_EXTS) {
    const file = stem + ext;
    if (fs.existsSync(path.join(dir, file))) return file;
  }
  return "";
}

function findAssetFile(slug) {
  const hyphen = firstExisting(assetsPrintersDir, slug);
  if (hyphen) return hyphen;
  const underscore = firstExisting(assetsPrintersDir, slug.replace(/-/g, "_"));
  if (underscore) return underscore;

  const want = slug.replace(/-/g, "");
  let files = [];
  try { files = fs.readdirSync(assetsPrintersDir); } catch (err) { return ""; }
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file).toLowerCase();
    if (IMAGE_EXTS.indexOf(ext) === -1) continue;
    const stem = path.basename(file, ext).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (stem === want) return file;
  }
  return "";
}

function resolveFeaturedImage(row) {
  const slug = printerSlug(row.brand, row.model);
  if (row.image_filename && fs.existsSync(path.join(featuredDir, row.image_filename))) {
    return { url: "/featured/" + row.image_filename, source: "upload", slug, file: row.image_filename };
  }
  const uploaded = firstExisting(featuredDir, String(row.id));
  if (uploaded) {
    return { url: "/featured/" + uploaded, source: "upload", slug, file: uploaded };
  }
  const asset = findAssetFile(slug);
  if (asset) {
    return { url: "/assets/printers/" + asset, source: "asset", slug, file: asset };
  }
  return { url: "", source: "", slug, file: slug.replace(/-/g, "_") + ".jpg" };
}

function removeFeaturedImage(filename) {
  if (!filename) return;
  const abs = path.join(featuredDir, filename);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

function mapFeatured(row) {
  const type = row.device_type === "mfp" ? "МФУ" : "Принтер";
  const tech = row.print_technology === "inkjet" ? "струйный" : "лазер";
  const color = row.color_mode === "color" ? "цветной" : "ч/б";
  const image = resolveFeaturedImage(row);
  return {
    ...row,
    typeLabel:  type,
    techLabel:  tech,
    colorLabel: color,
    meta:       `${type} · ${tech} · ${color}`,
    imageUrl:    image.url,
    imageSource: image.source,
    imageFile:   image.file,
    slug:        image.slug,
    brandSlug:   slugPart(row.brand),
    description: row.description || "",
    specRows:    specRows(row, { type: type, tech: tech, color: color }),
  };
}

function basicAuth(user, pass) {
  return (req, res, next) => {
    const hdr = req.headers.authorization || "";
    if (!hdr.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
      return res.status(401).send("Требуется авторизация");
    }
    const decoded = Buffer.from(hdr.slice(6), "base64").toString("utf8");
    const colon   = decoded.indexOf(":");
    if (colon === -1 ||
        !timingSafeEq(decoded.slice(0, colon), user) ||
        !timingSafeEq(decoded.slice(colon + 1), pass)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
      return res.status(401).send("Неверные учётные данные");
    }
    next();
  };
}

// ── Загрузка файлов (multer) ──────────────────────────────────────────────────
const heroPath = path.join(__dirname, "public", "hero-bg.jpg");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "public")),
    filename:    (req, file, cb) => cb(null, "hero-bg.jpg"),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Только изображения (jpg, png, webp, gif)"));
  },
});

const featuredUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, featuredDir),
    filename: (req, file, cb) => {
      const ext = IMAGE_EXT[file.mimetype] || ".jpg";
      cb(null, `${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_EXT[file.mimetype]) cb(null, true);
    else cb(new Error("Только изображения (jpg, png, webp, gif)"));
  },
});

// ── Express настройки ─────────────────────────────────────────────────────────
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Публичные маршруты ────────────────────────────────────────────────────────
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});

const SITE_NAME = process.env.SITE_NAME || "";
const SITE_URL  = process.env.SITE_URL  || "";

app.get("/", async (req, res) => {
  try {
    const { rows: services } = await pool.query("SELECT * FROM services ORDER BY id");
    const { rows: contacts } = await pool.query("SELECT * FROM contacts ORDER BY id");
    const { rows: featured } = await pool.query(
      `SELECT * FROM featured_printers
        WHERE is_active = true
        ORDER BY sort_order, id
        LIMIT $1`,
      [FEATURED_MAX]
    );
    const hasHero = fs.existsSync(heroPath);
    res.render("main", {
      siteName:    SITE_NAME,
      siteUrl:     SITE_URL,
      title:       "Ремонт оргтехники и заправка картриджей в Курске",
      description: "Ремонт принтеров, МФУ и копиров, заправка и продажа картриджей в Курске. Выезд мастера в день обращения, гарантия на все виды работ. Звоните!",
      heading:     "Ремонт оргтехники и заправка картриджей",
      subheading:  "Принтеры, МФУ, копиры — ремонт с гарантией. Заправка и продажа картриджей. Выезд мастера в день обращения.",
      ogImage:     hasHero ? `${SITE_URL}/hero-bg.jpg` : "",
      services:    services.map(s => ({ ...s, priceFormatted: money.format(s.price) })),
      contacts:    contacts.map(c => ({ ...c, textColor: textColorFor(c.color) })),
      featured:    featured.map(mapFeatured),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка базы данных");
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM services");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Панель управления ─────────────────────────────────────────────────────────
const adminUser = process.env.ADMIN_USER     || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "";

if (!adminPass) {
  console.warn("[admin] ADMIN_PASSWORD не задан — панель управления недоступна.");
} else {
  const auth = basicAuth(adminUser, adminPass);

  async function renderAdmin(req, res) {
    try {
      const { rows: services } = await pool.query("SELECT * FROM services ORDER BY id");
      const { rows: contacts } = await pool.query("SELECT * FROM contacts ORDER BY id");
      const { rows: featured } = await pool.query(
        "SELECT * FROM featured_printers ORDER BY sort_order, id"
      );
      const hasHero = fs.existsSync(heroPath);
      res.render("admin", {
        services,
        contacts,
        hasHero,
        featured: featured.map(mapFeatured),
        featuredMax: FEATURED_MAX,
      });
    } catch (err) {
      res.status(500).send("Ошибка");
    }
  }

  app.get("/home", auth, renderAdmin);

  // Услуги — редактирование
  app.get("/admin/services/:id/edit", auth, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM services WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/home");
    const s = rows[0];
    res.render("edit", {
      title:  "Услуга",
      action: `/admin/services/${s.id}/edit`,
      fields: [
        { name: "name",  label: "Название", type: "text",   value: s.name },
        { name: "price", label: "Цена (₽)", type: "number", value: s.price, step: "0.01", min: 0 },
      ],
    });
  });

  app.post("/admin/services/:id/edit", auth, async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) return res.redirect("/home");
    await pool.query("UPDATE services SET name = $1, price = $2 WHERE id = $3",
      [name.trim(), parseFloat(price), req.params.id]);
    res.redirect("/home");
  });

  // Контакты — редактирование
  app.get("/admin/contacts/:id/edit", auth, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM contacts WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/home");
    const c = rows[0];
    res.render("edit", {
      title:  "Контакт",
      action: `/admin/contacts/${c.id}/edit`,
      fields: [
        { name: "type",  label: "Подпись",   type: "text",  value: c.type },
        { name: "url",   label: "Ссылка",    type: "text",  value: c.url },
        { name: "color", label: "Цвет фона", type: "color", value: c.color },
      ],
    });
  });

  app.post("/admin/contacts/:id/edit", auth, async (req, res) => {
    const { type, url, color } = req.body;
    if (!type || !url) return res.redirect("/home");
    await pool.query("UPDATE contacts SET type = $1, url = $2, color = $3 WHERE id = $4",
      [type.trim(), url.trim(), (color || "#2563eb").trim(), req.params.id]);
    res.redirect("/home");
  });

  // Фото шапки — загрузка и удаление
  app.post("/admin/hero-upload", auth, upload.single("hero"), (req, res) => {
    res.redirect("/home");
  });

  app.post("/admin/hero-delete", auth, (req, res) => {
    if (fs.existsSync(heroPath)) fs.unlinkSync(heroPath);
    res.redirect("/home");
  });

  // Услуги — добавление/удаление
  app.post("/admin/services/add", auth, async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) return res.redirect("/home");
    await pool.query("INSERT INTO services (name, price) VALUES ($1, $2)",
      [name.trim(), parseFloat(price)]);
    res.redirect("/home");
  });

  app.post("/admin/services/:id/delete", auth, async (req, res) => {
    await pool.query("DELETE FROM services WHERE id = $1", [req.params.id]);
    res.redirect("/home");
  });

  // Контакты — добавление/удаление
  app.post("/admin/contacts/add", auth, async (req, res) => {
    const { type, url, color } = req.body;
    if (!type || !url) return res.redirect("/home");
    await pool.query("INSERT INTO contacts (type, url, color) VALUES ($1, $2, $3)",
      [type.trim(), url.trim(), (color || "#2563eb").trim()]);
    res.redirect("/home");
  });

  app.post("/admin/contacts/:id/delete", auth, async (req, res) => {
    await pool.query("DELETE FROM contacts WHERE id = $1", [req.params.id]);
    res.redirect("/home");
  });

  function parseFeaturedBody(body) {
    const brand = String(body.brand || "").trim();
    const model = String(body.model || "").trim();
    if (!brand || !model) return null;
    return {
      brand,
      model,
      device_type:      pickEnum(body.device_type, DEVICE_TYPES, "printer"),
      print_technology: pickEnum(body.print_technology, PRINT_TECHS, "laser"),
      color_mode:       pickEnum(body.color_mode, COLOR_MODES, "mono"),
      is_active:        body.is_active === "on" || body.is_active === "true" || body.is_active === "1",
      description:      String(body.description || "").trim().slice(0, 2000),
      paper_format:     parseOptStr(body.paper_format, 20),
      print_speed_ppm:  parseOptNum(body.print_speed_ppm),
      resolution_dpi:   parseOptStr(body.resolution_dpi, 50),
      is_duplex:        body.is_duplex === "on",
      is_wifi:          body.is_wifi === "on",
      is_ethernet:      body.is_ethernet === "on",
      is_usb:           body.is_usb === "on",
      release_year:     parseOptInt(body.release_year),
      has_adf:          body.has_adf === "on",
      scan_resolution_dpi: parseOptStr(body.scan_resolution_dpi, 50),
      cartridge_note:   parseOptStr(body.cartridge_note, 150),
    };
  }

  app.get("/admin/featured/:id/edit", auth, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM featured_printers WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/home");
    res.render("edit-printer", { printer: mapFeatured(rows[0]) });
  });

  app.post("/admin/featured/:id/edit", auth, (req, res, next) => {
    featuredUpload.single("photo")(req, res, (err) => {
      if (err) return res.redirect("/home");
      next();
    });
  }, async (req, res) => {
    const parsed = parseFeaturedBody(req.body);
    if (!parsed) return res.redirect("/home");
    const { rows } = await pool.query("SELECT * FROM featured_printers WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/home");

    let imageFilename = rows[0].image_filename;
    if (req.file) {
      if (imageFilename && imageFilename !== req.file.filename) removeFeaturedImage(imageFilename);
      imageFilename = req.file.filename;
    } else if (req.body.remove_photo === "on") {
      removeFeaturedImage(imageFilename);
      imageFilename = null;
    }

    await pool.query(
      `UPDATE featured_printers
          SET brand = $1, model = $2, device_type = $3, print_technology = $4,
              color_mode = $5, is_active = $6, image_filename = $7, description = $8,
              paper_format = $9, print_speed_ppm = $10, resolution_dpi = $11,
              is_duplex = $12, is_wifi = $13, is_ethernet = $14, is_usb = $15,
              release_year = $16, has_adf = $17, scan_resolution_dpi = $18, cartridge_note = $19
        WHERE id = $20`,
      [parsed.brand, parsed.model, parsed.device_type, parsed.print_technology,
       parsed.color_mode, parsed.is_active, imageFilename, parsed.description,
       parsed.paper_format, parsed.print_speed_ppm, parsed.resolution_dpi,
       parsed.is_duplex, parsed.is_wifi, parsed.is_ethernet, parsed.is_usb,
       parsed.release_year, parsed.has_adf, parsed.scan_resolution_dpi, parsed.cartridge_note,
       req.params.id]
    );
    res.redirect("/home");
  });

  app.post("/admin/featured/:id/photo", auth, (req, res, next) => {
    featuredUpload.single("photo")(req, res, (err) => {
      if (err) return res.redirect("/home");
      next();
    });
  }, async (req, res) => {
    if (!req.file) return res.redirect("/home");
    const { rows } = await pool.query("SELECT image_filename FROM featured_printers WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/home");
    if (rows[0].image_filename && rows[0].image_filename !== req.file.filename) {
      removeFeaturedImage(rows[0].image_filename);
    }
    await pool.query("UPDATE featured_printers SET image_filename = $1 WHERE id = $2",
      [req.file.filename, req.params.id]);
    res.redirect("/home");
  });

  app.post("/admin/featured/add", auth, async (req, res) => {
    const parsed = parseFeaturedBody(req.body);
    if (!parsed) return res.redirect("/home");
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM featured_printers");
    if (rows[0].n >= FEATURED_MAX) return res.redirect("/home");
    const { rows: maxRows } = await pool.query("SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM featured_printers");
    await pool.query(
      `INSERT INTO featured_printers
         (brand, model, device_type, print_technology, color_mode, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [parsed.brand, parsed.model, parsed.device_type, parsed.print_technology,
       parsed.color_mode, maxRows[0].m + 1]
    );
    res.redirect("/home");
  });

  app.post("/admin/featured/:id/delete", auth, async (req, res) => {
    const { rows } = await pool.query("SELECT image_filename FROM featured_printers WHERE id = $1", [req.params.id]);
    if (rows[0]) removeFeaturedImage(rows[0].image_filename);
    await pool.query("DELETE FROM featured_printers WHERE id = $1", [req.params.id]);
    res.redirect("/home");
  });

  app.post("/admin/featured/:id/move", auth, async (req, res) => {
    const dir = req.body.dir === "up" ? -1 : 1;
    const { rows } = await pool.query("SELECT id FROM featured_printers ORDER BY sort_order, id");
    const idx = rows.findIndex(r => String(r.id) === String(req.params.id));
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= rows.length) return res.redirect("/home");
    const ordered = rows.map(r => r.id);
    const tmp = ordered[idx];
    ordered[idx] = ordered[swap];
    ordered[swap] = tmp;
    for (let i = 0; i < ordered.length; i++) {
      await pool.query("UPDATE featured_printers SET sort_order = $1 WHERE id = $2", [i + 1, ordered[i]]);
    }
    res.redirect("/home");
  });
}

// ── Старт ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Сайт:    http://localhost:${PORT}/`);
    console.log(`API:     http://localhost:${PORT}/api/services`);
    if (adminPass) console.log(`Админка: http://localhost:${PORT}/home  (Basic Auth)`);
  });
}

start().catch(err => { console.error(err); process.exit(1); });
