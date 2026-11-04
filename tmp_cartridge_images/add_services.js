"use strict";
// Разовые правки БД: +8 услуг, исправление 2 cartridge_note и их неверных связей.
const fs = require("fs");
const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost", port: 5432,
  user: "mysite_user",
  password: fs.readFileSync(__dirname + "/../.env", "utf8").match(/DB_PASSWORD=(.*)/)[1].trim(),
  database: "mysite",
});

const SERVICES = [
  ["Замена фотобарабана", 800,
   "Фотобарабан — сердцевина картриджа: на нём лазер рисует будущий отпечаток. Царапины, серый фон и повторяющиеся точки говорят о выработке покрытия. Меняем вал на новый или восстановленный, чистим бункер отработки и проверяем ракель — печать снова чистая."],
  ["Замена ролика захвата", 500,
   "Ролик захвата берёт первый лист из стопки. Когда он «лысый», принтер не берёт бумагу вовсе или хватает по несколько листов — классическое замятие на входе. Меняем ролик на новый, заодно чистим тормозную площадку и сепарацию."],
  ["Заправка лазерного картриджа", 600,
   "Заправляем картриджи HP, Canon, Samsung, Brother, Xerox, Pantum тонером под конкретную модель: разбираем, чистим от отходов, досыпаем по норме, при необходимости меняем чип. Большинство картриджей готовы в течение часа."],
  ["Заправка струйного картриджа", 300,
   "Заправляем чернильные картриджи HP и Canon по цветам, при засоре промываем. Головка в таких картриджах своя, поэтому после заправки выводим дюзы на тестовом листе — печать проверяем при вас."],
  ["Прошивка аппарата под заправку", 1500,
   "Современные HP, Pantum и «Катюша» блокируют печать по чипу картриджа: счётчик дошёл до предела — аппарат встал, хотя тонер ещё есть. Перепрошиваем аппарат, чтобы он не следил за ресурсом чипа и принимал заправленный картридж без замены электроники."],
  ["Сброс счётчика чернил Epson", 300,
   "Epson L-серии останавливает печать с сообщением о переполнении «подушки» — это счётчик профилактики, а не реальная поломка. Сбрасываем счётчик сервисной утилитой, при необходимости чистим памперс и обслуживаем СНПЧ. Процедура занимает несколько минут."],
  ["Восстановление картриджа", 1200,
   "Восстановление — это больше, чем заправка: меняем изношенные детали картриджа (фотовал, ракель, дозирующее лезвие, магнитный вал) на новые и заправляем свежим тонером. По ресурсу восстановленный картридж близок к новому, а стоит заметно дешевле оригинала."],
  ["Замена термоплёнки печки", 1000,
   "Термоплёнка в печке прижимает тонер к бумаге. Когда она задирается, на отпечатках появляются серые полосы или тонер стирается пальцем. Разбираем печку, меняем плёнку и смазку валов — узел снова печатает как новый."],
];

(async () => {
  for (const [name, price, description] of SERVICES) {
    const { rows } = await pool.query(
      `INSERT INTO services (name, price, description)
       SELECT $1::varchar, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE lower(name) = lower($1::varchar))
       RETURNING id, name`,
      [name, price, description]
    );
    if (rows.length) {
      console.log(`service: +#${rows[0].id} ${rows[0].name} — ${price} р.`);
    } else {
      const u = await pool.query(
        `UPDATE services SET price = $2, description = $3 WHERE lower(name) = lower($1) RETURNING id, name`,
        [name, price, description]
      );
      console.log(`service: ~#${u.rows[0].id} ${u.rows[0].name} — обновлена`);
    }
  }

  // 135a: 107A не подходит к МФУ 135-й серии (чип/регион) — только 106A.
  await pool.query(
    `UPDATE printers SET cartridge_note = '106A / W1106A',
       description = 'МФУ «печать + скан + копир» без лишней электроники. Удобно в офисе, где нужен комплект в одном корпусе. Картридж 106A хорошо заправляется.'
     WHERE brand = 'HP' AND model = 'LaserJet Pro MFP 135a'`
  );
  const un135 = await pool.query(
    `DELETE FROM printer_cartridges pc USING cartridges c, printers p
     WHERE pc.cartridge_id = c.id AND pc.printer_id = p.id
       AND p.brand = 'HP' AND p.model = 'LaserJet Pro MFP 135a' AND c.model = '107A'
     RETURNING pc.printer_id`
  );

  // LBP6030: по данным Canon Europe использует 737, а не 725.
  await pool.query(
    `UPDATE printers SET cartridge_note = '737 / CRT-737',
       description = 'Тихий компактный лазерный принтер. Мало места на столе, картридж 737 массовый и недорогой в заправке.'
     WHERE brand = 'Canon' AND model = 'i-SENSYS LBP6030'`
  );
  const unlbp = await pool.query(
    `DELETE FROM printer_cartridges pc USING cartridges c, printers p
     WHERE pc.cartridge_id = c.id AND pc.printer_id = p.id
       AND p.brand = 'Canon' AND p.model = 'i-SENSYS LBP6030' AND c.model = '725'
     RETURNING pc.printer_id`
  );

  console.log(`135a: удалено неверных связей с 107A: ${un135.rowCount}`);
  console.log(`LBP6030: удалено неверных связей с 725: ${unlbp.rowCount}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
