// server.js
require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const databaseFunctions = require("sqlite-gui-node/dist/Utils/databaseFunctions").default;
const tablesRouter = require("sqlite-gui-node/dist/routes/tables").default;

const app = express();
const PORT = 3001;

const guiRoot = path.join(path.dirname(require.resolve("sqlite-gui-node/package.json")));

// База в папке проекта
const db = new sqlite3.Database("./services.db");

// Создаём таблицу services
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL
    )
  `);
  /*
  db.run(
    "INSERT INTO services (name, price) VALUES (?, ?)",
    ["Ремонт холодильника", 1000],
    (err) => {
      if (err && err.code !== "SQLITE_CONSTRAINT") console.log("Пример записи уже есть");
    }
  );
  */
});

// 1. API для Astro (без пароля — только чтение для фронта)
app.get("/api/services", (req, res) => {
  db.all("SELECT * FROM services", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Маршруты sqlite-gui и его статики + API изменения БД */
function isSqliteAdminPath(req) {
  const p = req.path || "/";
  if (p.startsWith("/api/tables")) return true;
  if (p === "/" || p === "/admin" || p === "/home" || p === "/query" || p === "/createtable") return true;
  if (p.startsWith("/insert/")) return true;
  if (p.startsWith("/edit/")) return true;
  if (p.startsWith("/stylesheets/") || p.startsWith("/javascripts/") || p.startsWith("/img/") || p.startsWith("/icons/"))
    return true;
  if (p === "/output.sql") return true;
  return false;
}

function createBasicAuthMiddleware(username, password) {
  return (req, res, next) => {
    if (!isSqliteAdminPath(req)) return next();

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

async function start() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUser = process.env.ADMIN_USER || "admin";

  if (!adminPassword) {
    console.warn(
      "[sqlite-gui] ADMIN_PASSWORD не задан — GUI и /api/tables не подключены. Задайте переменные в .env (см. .env.example)."
    );
    app.listen(PORT, () => {
      console.log(`Express запущен на http://localhost:${PORT}`);
      console.log(`- API: http://localhost:${PORT}/api/services`);
    });
    return;
  }

  await databaseFunctions.InitializeDB(db);

  app.use(createBasicAuthMiddleware(adminUser, adminPassword));

  app.set("view engine", "ejs");
  app.set("views", path.join(guiRoot, "views"));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(express.static(path.join(guiRoot, "public")));

  app.get("/admin", (req, res) => {
    res.redirect(302, "/home");
  });

  app.get("/query", (req, res) => {
    res.render("query", { title: "Query Page" });
  });
  app.get("/", (req, res) => {
    res.render("index", { title: "Home Page" });
  });
  app.get("/home", (req, res) => {
    res.render("index", { title: "Home Page" });
  });
  app.get("/createtable", (req, res) => {
    res.render("createTable", { title: "Create Table Page" });
  });
  app.get("/insert/:table", (req, res) => {
    res.render("insert", { tableName: req.params.table });
  });
  app.get("/edit/:table/:label/:id", (req, res) => {
    res.render("edit", { tableName: req.params.table, id: req.params.id });
  });
  app.use("/api/tables", tablesRouter(db));

  app.listen(PORT, () => {
    console.log(`Express запущен на http://localhost:${PORT}`);
    console.log(`- API: http://localhost:${PORT}/api/services`);
    console.log(`- Админка (Basic Auth): http://localhost:${PORT}/admin → /home`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
