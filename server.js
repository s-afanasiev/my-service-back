// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { SqliteGuiNodeMiddleware } = require("sqlite-gui-node");

const app = express();
const PORT = 3001;

// База в папке проекта
//test
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

  // Пример: "ремонт холодильника" за 1000
  db.run(
    "INSERT INTO services (name, price) VALUES (?, ?)",
    ["Ремонт холодильника", 1000],
    (err) => {
      if (err && err.code !== "SQLITE_CONSTRAINT") console.log("Пример записи уже есть");
    }
  );
});

// 1. API для Astro
app.get("/api/services", (req, res) => {
  db.all("SELECT * FROM services", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Админка по /admin (легко для нетехна)
app.use("/admin", (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  next();
});
app.use("/admin", SqliteGuiNodeMiddleware(app, db));

// Старт сервера
app.listen(PORT, () => {
  console.log(`Express запущен на http://localhost:${PORT}`);
  console.log(`- API: http://localhost:${PORT}/api/services`);
  console.log(`- Админка: http://localhost:${PORT}/admin`);
});

