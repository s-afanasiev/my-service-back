# Фото картриджей — состояние на 2026-10-18 (финиш прохода)

Итог: **40 из 45** картриджей имеют фото в `assets/cartridges/` (600×600, белый фон).
Выборы — `choices.txt` (`slug:cN`), обработка — `node process_cartridges.js`,
покрытие — `node check.js`. Контакт-листы кандидатов лежат в `tmp_cartridge_images/<slug>/montage.jpg`.

Без фото (5) — что пробовали:
- `hp_w1100a` — в индексе только dual-pack 103AD/W1105A (его фото отдано строке W1105A);
  одиночный комплект 2,5K чисто не снят нигде.
- `hp_w1500a` — 4 запроса, все только коробки (Cactus/Hi-Black/PQ/mj).
- `xerox_106r0218` — выдача путает с 106R02181/02183 (круглые тубы) и чипами;
  точный SKU 106R0218 не найден.
- `brother_tn_2095` — индекс пуст/мусор (TN-450, TN850, Canon 069…).
- `katyusha_dr_240` — барабана в индексе нет, только тонер-картриджи TK-240X.

Компромиссы (стоят, можно улучшить позже):
- `xerox_cwaa07229` — коробка аналога ProfiLine PL-006R01513 (саму тубу не сняли).
- `pantum_tl_5120h` — оригинальная коробка Pantum без картриджа.
- `xerox_006r04377`, `xerox_013r00670` — оригинальные коробки Xerox.
- `hp_w1107a`, `pantum_tl_5120` — совместимые, SKU на фото может отличаться ёмкостью.

Наблюдения по MCP image_search: 2026-10-18 сервер лежал ~3 ч (internal_error),
после ожил; `rank=true` дестабилизирует чаще — рабочий режим `rank=false`.
Английские запросы (`Canon 052 toner cartridge`) находят то, чего нет в RU-выдаче.

## Добор 2026-10-18 (вторая сессия): услуги + новые картриджи

Сделано: +8 услуг в БД (ids 13–20, prices/descriptions в add_services.js), notes 135a (106A/W1106A вместо 106A/107A) и LBP6030 (737/CRT-737 вместо 725) исправлены, неверные связи printer_cartridges удалены. printers-catalog.csv: +5 моделей из БД (61 всего). cartridges-catalog.csv: +CE285A(85A), CRT-725, CRT-737 (48 всего).

ОСТАЛОСЬ: докачать 10 фото (7 услуг + 3 картриджа) — image_search выполнен, URL лежат в queue_new.json (root tmp_service_images) и queue_cart.json (root tmp_cartridge_images). OSS-прокси лежал с ~15:00 до 17:10+ (000/таймауты и в curl, и в node).

Возобновление, когда OSS поднимется:
1. node tmp_cartridge_images/batch_grab.js tmp_cartridge_images/queue_new.json   (услуги)
2. node tmp_cartridge_images/batch_grab.js tmp_cartridge_images/queue_cart.json  (картриджи)
3. View montage.jpg каждого slug → выбор: услуги в tmp_service_images/choices.txt (slug:cN), картриджи в tmp_cartridge_images/choices.txt
4. node tmp_service_images/process_new.js && node tmp_cartridge_images/process_cartridges.js canon_crt_725 canon_crt_737 hp_ce285a
5. Кандидаты: fotobaraban.jpg→zamena_fotobarabana.jpg и rolik_zahvata.jpg→zamena_rolika_zahvata.jpg уже переименованы — это фото услуг #13/#14.
