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
const featuredDir  = path.join(__dirname, "public", "featured");
const IMAGE_EXT    = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
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
    image_filename    VARCHAR(255)
  )`);
  fs.mkdirSync(featuredDir, { recursive: true });
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

function featuredImageAbs(filename) {
  if (!filename) return "";
  const abs = path.join(featuredDir, filename);
  return fs.existsSync(abs) ? abs : "";
}

function removeFeaturedImage(filename) {
  const abs = featuredImageAbs(filename);
  if (abs) fs.unlinkSync(abs);
}

function mapFeatured(row) {
  const type = row.device_type === "mfp" ? "МФУ" : "Принтер";
  const tech = row.print_technology === "inkjet" ? "струйный" : "лазер";
  const color = row.color_mode === "color" ? "цветной" : "ч/б";
  const imageUrl = featuredImageAbs(row.image_filename) ? `/featured/${row.image_filename}` : "";
  return {
    ...row,
    typeLabel:  type,
    techLabel:  tech,
    colorLabel: color,
    meta:       `${type} · ${tech} · ${color}`,
    imageUrl,
    brandSlug:  String(row.brand).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
              color_mode = $5, is_active = $6, image_filename = $7
        WHERE id = $8`,
      [parsed.brand, parsed.model, parsed.device_type, parsed.print_technology,
       parsed.color_mode, parsed.is_active, imageFilename, req.params.id]
    );
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
