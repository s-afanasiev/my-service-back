"use strict";
// Пакетная загрузка кандидатов из queue_new.json: для каждого slug 3 URL → c1..c3 + montage.
// Запуск: node batch_grab.js [queueFile]
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const queueFile = process.argv[2] || path.join(__dirname, "queue_new.json");
const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
const grabJs = path.join(__dirname, "grab.js");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const failed = [];

(async () => {
  for (const item of queue.items) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await sleep(15000);
      const res = spawnSync("node", [grabJs, item.slug, ...item.urls], { stdio: "inherit" });
      if (res.status === 0) break;
      if (attempt === 2) failed.push(item.slug);
    }
    await sleep(3000);
  }
  console.log("\n=== ИТОГ ===");
  console.log(failed.length ? "FAILED: " + failed.join(", ") : "все slug скачаны");
  process.exit(failed.length ? 1 : 0);
})();
