require("dotenv").config();

const crypto  = require("crypto");
const path    = require("path");
const express = require("express");
const mysql   = require("mysql2/promise");

const app  = express();
const PORT = 3001;

// ── Пул соединений MySQL ──────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "mysite",
  waitForConnections: true,
  connectionLimit:    10,
});

// ── Создание таблиц при первом запуске ────────────────────────────────────────
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS services (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    type  VARCHAR(255) NOT NULL,
    url   VARCHAR(2048) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#2563eb'
  )`);
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

// ── Express настройки ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Публичные маршруты ────────────────────────────────────────────────────────
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});

app.get("/", async (req, res) => {
  try {
    const [services] = await pool.query("SELECT * FROM services ORDER BY id");
    const [contacts] = await pool.query("SELECT * FROM contacts ORDER BY id");
    res.render("main", {
      title:       "Услуги по ремонту",
      description: "Качественный ремонт бытовой техники — цены на все виды услуг",
      heading:     "Услуги по ремонту",
      subheading:  "Быстро, качественно, с гарантией. Выезд мастера в день обращения.",
      services:    services.map(s => ({ ...s, priceFormatted: money.format(s.price) })),
      contacts:    contacts.map(c => ({ ...c, textColor: textColorFor(c.color) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка базы данных");
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM services");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Панель управления (только если задан пароль) ──────────────────────────────
const adminUser = process.env.ADMIN_USER     || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "";

if (!adminPass) {
  console.warn("[admin] ADMIN_PASSWORD не задан — панель управления недоступна.");
} else {
  const auth = basicAuth(adminUser, adminPass);

  async function renderAdmin(req, res) {
    try {
      const [services] = await pool.query("SELECT * FROM services ORDER BY id");
      const [contacts] = await pool.query("SELECT * FROM contacts ORDER BY id");
      res.render("admin", { services, contacts });
    } catch (err) {
      res.status(500).send("Ошибка");
    }
  }

  app.get("/home", auth, renderAdmin);

  // Услуги — редактирование
  app.get("/admin/services/:id/edit", auth, async (req, res) => {
    const [[s]] = await pool.query("SELECT * FROM services WHERE id = ?", [req.params.id]);
    if (!s) return res.redirect("/home");
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
    await pool.query("UPDATE services SET name = ?, price = ? WHERE id = ?",
      [name.trim(), parseFloat(price), req.params.id]);
    res.redirect("/home");
  });

  // Контакты — редактирование
  app.get("/admin/contacts/:id/edit", auth, async (req, res) => {
    const [[c]] = await pool.query("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
    if (!c) return res.redirect("/home");
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
    await pool.query("UPDATE contacts SET type = ?, url = ?, color = ? WHERE id = ?",
      [type.trim(), url.trim(), (color || "#2563eb").trim(), req.params.id]);
    res.redirect("/home");
  });

  // Услуги — добавление/удаление
  app.post("/admin/services/add", auth, async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) return res.redirect("/home");
    await pool.query("INSERT INTO services (name, price) VALUES (?, ?)",
      [name.trim(), parseFloat(price)]);
    res.redirect("/home");
  });

  app.post("/admin/services/:id/delete", auth, async (req, res) => {
    await pool.query("DELETE FROM services WHERE id = ?", [req.params.id]);
    res.redirect("/home");
  });

  // Контакты — добавление/удаление
  app.post("/admin/contacts/add", auth, async (req, res) => {
    const { type, url, color } = req.body;
    if (!type || !url) return res.redirect("/home");
    await pool.query("INSERT INTO contacts (type, url, color) VALUES (?, ?, ?)",
      [type.trim(), url.trim(), (color || "#2563eb").trim()]);
    res.redirect("/home");
  });

  app.post("/admin/contacts/:id/delete", auth, async (req, res) => {
    await pool.query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
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
