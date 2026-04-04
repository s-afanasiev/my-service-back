// server.js
require("dotenv").config();

const crypto = require("crypto");
const path   = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const databaseFunctions = require("sqlite-gui-node/dist/Utils/databaseFunctions").default;
const tablesRouter      = require("sqlite-gui-node/dist/routes/tables").default;

const app  = express();
const PORT = 3001;

const guiRoot = path.join(path.dirname(require.resolve("sqlite-gui-node/package.json")));

// База в папке проекта
const db = new sqlite3.Database("./services.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      price REAL NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      type  TEXT NOT NULL,
      url   TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#2563eb'
    )
  `);
});

/** Определяет цвет текста (белый/тёмный) по яркости фона hex-цвета */
function textColorFor(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1e293b" : "#ffffff";
}

// ── Публичный фронт ──────────────────────────────────────────────────────────
// Статика из public/ (CSS, картинки и т.д.) — без пароля
app.use(express.static(path.join(__dirname, "public")));

// Главная страница: рендер на сервере — данные уже в HTML (SEO-friendly)
app.get("/", (req, res) => {
  const money = new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "RUB", maximumFractionDigits: 0,
  });

  db.all("SELECT * FROM services ORDER BY id", (errS, serviceRows) => {
    if (errS) return res.status(500).send("Ошибка базы данных");

    db.all("SELECT * FROM contacts ORDER BY id", (errC, contactRows) => {
      if (errC) return res.status(500).send("Ошибка базы данных");

      const services = serviceRows.map((s) => ({
        ...s,
        priceFormatted: money.format(s.price),
      }));

      const contacts = contactRows.map((c) => ({
        ...c,
        textColor: textColorFor(c.color),
      }));

      res.render("main", {
        title:      "Услуги по ремонту",
        description:"Качественный ремонт бытовой техники — цены на все виды услуг",
        heading:    "Услуги по ремонту",
        subheading: "Быстро, качественно, с гарантией. Выезд мастера в день обращения.",
        services,
        contacts,
      });
    });
  });
});

// Публичный API: список услуг (для возможных будущих нужд)
app.get("/api/services", (req, res) => {
  db.all("SELECT * FROM services", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── Утилиты Basic Auth ───────────────────────────────────────────────────────
function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function basicAuth(username, password) {
  return (req, res, next) => {
    const hdr = req.headers.authorization;
    if (!hdr || !hdr.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SQLite admin"');
      return res.status(401).send("Требуется авторизация");
    }
    let decoded;
    try {
      decoded = Buffer.from(hdr.slice(6), "base64").toString("utf8");
    } catch {
      res.setHeader("WWW-Authenticate", 'Basic realm="SQLite admin"');
      return res.status(401).send("Неверные учётные данные");
    }
    const colon = decoded.indexOf(":");
    if (colon === -1) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SQLite admin"');
      return res.status(401).send("Неверные учётные данные");
    }
    const user = decoded.slice(0, colon);
    const pass = decoded.slice(colon + 1);
    if (timingSafeEqualString(user, username) && timingSafeEqualString(pass, password)) {
      return next();
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="SQLite admin"');
    return res.status(401).send("Неверные учётные данные");
  };
}

// ── Запуск ───────────────────────────────────────────────────────────────────
async function start() {
  const adminUser     = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;

  // EJS нужен и без пароля — для главной страницы
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  if (!adminPassword) {
    console.warn("[admin] ADMIN_PASSWORD не задан — GUI не подключён (см. .env.example).");
    app.listen(PORT, () => {
      console.log(`Express: http://localhost:${PORT}`);
      console.log(`  Сайт:  http://localhost:${PORT}/`);
      console.log(`  API:   http://localhost:${PORT}/api/services`);
    });
    return;
  }

  await databaseFunctions.InitializeDB(db);

  const auth = basicAuth(adminUser, adminPassword);

  // Статика sqlite-gui (/stylesheets/, /javascripts/, /icons/, /img/) — за паролем
  const guiStatic = express.static(path.join(guiRoot, "public"));
  app.use((req, res, next) => {
    const p = req.path;
    if (
      p.startsWith("/stylesheets/") ||
      p.startsWith("/javascripts/") ||
      p.startsWith("/icons/") ||
      p.startsWith("/img/")
    ) {
      return auth(req, res, () => guiStatic(req, res, next));
    }
    next();
  });

  // Расширяем views: теперь и наши шаблоны, и sqlite-gui
  app.set("views", [
    path.join(__dirname, "views"),
    path.join(guiRoot, "views"),
  ]);
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // Все маршруты админки — за паролем
  app.get("/home",              auth, (req, res) => res.render("index",       { title: "Admin" }));
  app.get("/query",             auth, (req, res) => res.render("query",       { title: "Query" }));
  app.get("/createtable",       auth, (req, res) => res.render("createTable", { title: "Create Table" }));
  app.get("/insert/:table",     auth, (req, res) => res.render("insert",      { tableName: req.params.table }));
  app.get("/edit/:table/:label/:id", auth, (req, res) =>
    res.render("edit", { tableName: req.params.table, id: req.params.id })
  );
  app.use("/api/tables", auth, tablesRouter(db));

  app.get("/output.sql", auth, (req, res) => {
    res.sendFile(path.join(guiRoot, "public", "output.sql"));
  });

  app.listen(PORT, () => {
    console.log(`Express: http://localhost:${PORT}`);
    console.log(`  Сайт:    http://localhost:${PORT}/`);
    console.log(`  API:     http://localhost:${PORT}/api/services`);
    console.log(`  Админка: http://localhost:${PORT}/home  (Basic Auth)`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
