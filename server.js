require("dotenv").config();

const crypto  = require("crypto");
const path    = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app  = express();
const PORT = 3001;
const db   = new sqlite3.Database("./services.db");

// ── База данных ───────────────────────────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    price REAL NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    type  TEXT NOT NULL,
    url   TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2563eb'
  )`);
});

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

// ── Express настройки ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Публичные маршруты ────────────────────────────────────────────────────────
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});

app.get("/", (req, res) => {
  db.all("SELECT * FROM services ORDER BY id", (err, services) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    db.all("SELECT * FROM contacts ORDER BY id", (err2, contacts) => {
      if (err2) return res.status(500).send("Ошибка базы данных");
      res.render("main", {
        title:       "Услуги по ремонту",
        description: "Качественный ремонт бытовой техники — цены на все виды услуг",
        heading:     "Услуги по ремонту",
        subheading:  "Быстро, качественно, с гарантией. Выезд мастера в день обращения.",
        services:    services.map(s => ({ ...s, priceFormatted: money.format(s.price) })),
        contacts:    contacts.map(c => ({ ...c, textColor: textColorFor(c.color) })),
      });
    });
  });
});

app.get("/api/services", (req, res) => {
  db.all("SELECT * FROM services", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── Панель управления (только если задан пароль) ──────────────────────────────
const adminUser = process.env.ADMIN_USER     || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "";

if (!adminPass) {
  console.warn("[admin] ADMIN_PASSWORD не задан — панель управления недоступна.");
} else {
  const auth = basicAuth(adminUser, adminPass);

  function renderAdmin(req, res) {
    db.all("SELECT * FROM services ORDER BY id", (err, services) => {
      if (err) return res.status(500).send("Ошибка");
      db.all("SELECT * FROM contacts ORDER BY id", (err2, contacts) => {
        if (err2) return res.status(500).send("Ошибка");
        res.render("admin", { services, contacts });
      });
    });
  }

  app.get("/home", auth, renderAdmin);

  // Услуги — редактирование
  app.get("/admin/services/:id/edit", auth, (req, res) => {
    db.get("SELECT * FROM services WHERE id = ?", [req.params.id], (err, s) => {
      if (err || !s) return res.redirect("/home");
      res.render("edit", {
        title:  "Услуга",
        action: `/admin/services/${s.id}/edit`,
        fields: [
          { name: "name",  label: "Название", type: "text",   value: s.name },
          { name: "price", label: "Цена (₽)", type: "number", value: s.price, step: "0.01", min: 0 },
        ],
      });
    });
  });

  app.post("/admin/services/:id/edit", auth, (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) return res.redirect("/home");
    db.run("UPDATE services SET name = ?, price = ? WHERE id = ?",
      [name.trim(), parseFloat(price), req.params.id], () => res.redirect("/home"));
  });

  // Контакты — редактирование
  app.get("/admin/contacts/:id/edit", auth, (req, res) => {
    db.get("SELECT * FROM contacts WHERE id = ?", [req.params.id], (err, c) => {
      if (err || !c) return res.redirect("/home");
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
  });

  app.post("/admin/contacts/:id/edit", auth, (req, res) => {
    const { type, url, color } = req.body;
    if (!type || !url) return res.redirect("/home");
    db.run("UPDATE contacts SET type = ?, url = ?, color = ? WHERE id = ?",
      [type.trim(), url.trim(), (color || "#2563eb").trim(), req.params.id], () => res.redirect("/home"));
  });

  // Услуги — добавление
  app.post("/admin/services/add", auth, (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) return res.redirect("/home");
    db.run("INSERT INTO services (name, price) VALUES (?, ?)",
      [name.trim(), parseFloat(price)], () => res.redirect("/home"));
  });

  app.post("/admin/services/:id/delete", auth, (req, res) => {
    db.run("DELETE FROM services WHERE id = ?",
      [req.params.id], () => res.redirect("/home"));
  });

  // Контакты
  app.post("/admin/contacts/add", auth, (req, res) => {
    const { type, url, color } = req.body;
    if (!type || !url) return res.redirect("/home");
    db.run("INSERT INTO contacts (type, url, color) VALUES (?, ?, ?)",
      [type.trim(), url.trim(), (color || "#2563eb").trim()], () => res.redirect("/home"));
  });

  app.post("/admin/contacts/:id/delete", auth, (req, res) => {
    db.run("DELETE FROM contacts WHERE id = ?",
      [req.params.id], () => res.redirect("/home"));
  });
}

// ── Старт ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Сайт:    http://localhost:${PORT}/`);
  console.log(`API:     http://localhost:${PORT}/api/services`);
  if (adminPass) console.log(`Админка: http://localhost:${PORT}/home  (Basic Auth)`);
});
